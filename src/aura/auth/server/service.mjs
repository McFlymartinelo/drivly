import { timingSafeEqual } from "node:crypto"
import { AuthError } from "./errors.mjs"
import { resolveConfig } from "./config.mjs"
import { signJwt, verifyJwt } from "./tokens.mjs"
import { dummyHash, hashPassword, verifyPassword } from "./password.mjs"
import { createOtpStore } from "./otp.mjs"
import { createRateLimiter } from "./rate-limit.mjs"
import { normalizeMailer } from "./mailer.mjs"
import {
  maskEmail,
  normalizeEmail,
  validateDisplayName,
  validateEmail,
  validatePassword,
  validateUsername,
} from "./validate.mjs"

const OTP_PURPOSES = new Set(["register", "login", "reset"])

function nowIso() {
  return new Date().toISOString()
}

function publicUser(row) {
  return {
    id: Number(row.id),
    email: row.email,
    emailVerified: Boolean(row.email_verified),
    displayName: row.display_name ?? null,
    username: row.username ?? null,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at,
  }
}

/**
 * Service d'authentification Aura.
 *
 * Indépendant du framework HTTP et de la base : on lui passe `db` (get/all/run)
 * et `mailer`. Les adaptateurs Express et Web ne font que traduire la requête.
 *
 * Toutes les méthodes renvoient `{ status, body, session?, clearSession? }`
 * et lèvent une `AuthError` en cas d'échec.
 */
export function createAuthService(options = {}) {
  const { db } = options
  if (!db || typeof db.get !== "function" || typeof db.run !== "function") {
    throw new Error("createAuthService : db requis (get, all, run)")
  }

  const config = resolveConfig(options.config)
  const sendOtpMail = normalizeMailer(options.mailer, config)
  const otp = createOtpStore({ db, config, secret: config.secret })

  const authLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
  })
  const otpLimiter = createRateLimiter({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitOtpMax,
  })

  function limit(ip, kind = "auth") {
    if (kind === "otp") otpLimiter.check(ip ?? "unknown")
    else authLimiter.check(ip ?? "unknown")
  }

  async function findById(id) {
    if (!id) return null
    const row = await db.get("SELECT * FROM aura_users WHERE id = ?", [id])
    return row ?? null
  }

  async function findByEmail(email) {
    const row = await db.get(
      "SELECT * FROM aura_users WHERE email = ? COLLATE NOCASE",
      [normalizeEmail(email)],
    )
    return row ?? null
  }

  function issueSession(row, status = 200) {
    const token = signJwt(
      { sub: Number(row.id), tv: Number(row.token_version) || 0 },
      config.secret,
      config.sessionTtlSeconds,
    )
    const body = { user: publicUser(row) }
    if (config.exposeToken) body.token = token
    return {
      status,
      body,
      session: { token, maxAge: config.sessionTtlSeconds },
    }
  }

  async function startOtp(row, purpose) {
    const { code } = await otp.issue({
      userId: Number(row.id),
      email: row.email,
      purpose,
    })

    try {
      await sendOtpMail({
        to: row.email,
        code,
        purpose,
        appName: config.appName,
      })
    } catch (error) {
      console.error("[aura-auth] envoi OTP échoué :", error?.message ?? error)
      throw new AuthError(
        503,
        "Impossible d'envoyer le mail. Réessaie dans un instant.",
        { code: "mail_failed" },
      )
    }

    const otpToken = signJwt(
      {
        sub: Number(row.id),
        purpose: "otp",
        otpPurpose: purpose,
      },
      config.secret,
      config.otpTokenTtlSeconds,
    )

    const body = {
      needsOtp: true,
      otpToken,
      emailMasked: maskEmail(row.email),
    }
    if (config.echoOtp) body.devOtp = code
    return { status: 200, body }
  }

  function readOtpToken(token) {
    let payload
    try {
      payload = verifyJwt(token, config.secret)
    } catch {
      throw new AuthError(401, "Code expiré — reconnecte-toi", {
        code: "otp_token_expired",
      })
    }

    if (
      payload?.purpose !== "otp" ||
      !payload.sub ||
      !OTP_PURPOSES.has(payload.otpPurpose)
    ) {
      throw new AuthError(401, "Session OTP invalide", {
        code: "otp_token_invalid",
      })
    }
    return payload
  }

  function assertOtp(result) {
    if (!result.ok) {
      throw new AuthError(400, result.error, { code: result.code })
    }
  }

  async function markVerified(userId) {
    await db.run(
      "UPDATE aura_users SET email_verified = 1, updated_at = ? WHERE id = ?",
      [nowIso(), userId],
    )
  }

  // -------------------------------------------------------------------------
  // Inscription
  // -------------------------------------------------------------------------

  async function register(input = {}) {
    limit(input.ip)

    if (config.registrationCode) {
      const provided = Buffer.from(String(input.code ?? ""))
      const expected = Buffer.from(config.registrationCode)
      const valid =
        provided.length === expected.length &&
        provided.length > 0 &&
        timingSafeEqual(provided, expected)
      if (!valid) {
        throw new AuthError(403, "Code d'inscription invalide", {
          code: "invalid_signup_code",
        })
      }
    }

    const emailError = validateEmail(input.email)
    if (emailError) throw new AuthError(400, emailError, { code: "invalid_email" })

    const passwordError = validatePassword(
      input.password,
      config.minPasswordLength,
      config.maxPasswordLength,
    )
    if (passwordError) {
      throw new AuthError(400, passwordError, { code: "invalid_password" })
    }

    const usernameCheck = validateUsername(input.username)
    if (usernameCheck.error) {
      throw new AuthError(400, usernameCheck.error, { code: "invalid_username" })
    }

    const email = normalizeEmail(input.email)
    const displayCheck = validateDisplayName(input.displayName)
    if (displayCheck.error) {
      throw new AuthError(400, displayCheck.error, { code: "invalid_display_name" })
    }

    const existingEmail = await findByEmail(email)
    if (existingEmail) {
      throw new AuthError(409, "Cette adresse mail est déjà utilisée", {
        code: "email_taken",
      })
    }

    if (usernameCheck.value) {
      const existingUsername = await db.get(
        "SELECT id FROM aura_users WHERE username = ? COLLATE NOCASE",
        [usernameCheck.value],
      )
      if (existingUsername) {
        throw new AuthError(409, "Ce pseudo existe déjà", { code: "username_taken" })
      }
    }

    let verified = 0
    if (input.emailToken) {
      let payload
      try {
        payload = verifyJwt(input.emailToken, config.secret)
      } catch {
        throw new AuthError(401, "Vérification email expirée — renvoie un code", {
          code: "email_token_expired",
        })
      }
      if (payload?.purpose !== "email-verified" || payload.email !== email) {
        throw new AuthError(400, "Email non vérifié", { code: "email_not_verified" })
      }
      verified = 1
    }

    // Si la vérification d'email est désactivée, le compte est utilisable
    // immédiatement (sinon la connexion redemanderait un OTP à chaque fois).
    if (!config.requireEmailVerification) verified = 1

    const displayName =
      displayCheck.value ??
      usernameCheck.display ??
      email.slice(0, email.indexOf("@")) ??
      email

    const passwordHash = await hashPassword(input.password)
    const timestamp = nowIso()

    let result
    try {
      result = await db.run(
        `INSERT INTO aura_users
           (email, password_hash, display_name, username, email_verified, is_admin,
            token_version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?)`,
        [
          email,
          passwordHash,
          displayName,
          usernameCheck.value,
          verified,
          timestamp,
          timestamp,
        ],
      )
    } catch (error) {
      const message = String(error?.message ?? "")
      if (/UNIQUE.*email/i.test(message)) {
        throw new AuthError(409, "Cette adresse mail est déjà utilisée", {
          code: "email_taken",
        })
      }
      if (/UNIQUE.*username/i.test(message)) {
        throw new AuthError(409, "Ce pseudo existe déjà", {
          code: "username_taken",
        })
      }
      throw error
    }

    const row = await findById(result.lastInsertRowid)
    if (!row) throw new AuthError(500, "Compte créé mais introuvable")

    if (verified || !config.requireEmailVerification) {
      return issueSession(row, 201)
    }

    const challenge = await startOtp(row, "register")
    return { ...challenge, status: 201 }
  }

  // -------------------------------------------------------------------------
  // Connexion
  // -------------------------------------------------------------------------

  async function login(input = {}) {
    limit(input.ip)

    const identifier = String(
      input.identifier ?? input.email ?? input.username ?? "",
    )
      .trim()
      .toLowerCase()
    const password = typeof input.password === "string" ? input.password : ""

    if (!identifier || !password) {
      throw new AuthError(401, "Identifiants incorrects", {
        code: "invalid_credentials",
      })
    }

    const row = await db.get(
      `SELECT * FROM aura_users
       WHERE email = ? COLLATE NOCASE OR username = ? COLLATE NOCASE`,
      [identifier, identifier],
    )

    const passwordOk = await verifyPassword(
      password,
      row?.password_hash ?? (await dummyHash()),
    )

    if (!row || !passwordOk) {
      throw new AuthError(401, "Identifiants incorrects", {
        code: "invalid_credentials",
      })
    }

    if (config.requireOtpOnLogin || !row.email_verified) {
      return startOtp(row, "login")
    }

    return issueSession(row)
  }

  // -------------------------------------------------------------------------
  // OTP
  // -------------------------------------------------------------------------

  /** Parcours « email d'abord » : envoie un code à une adresse inconnue. */
  async function sendOtp(input = {}) {
    limit(input.ip, "otp")

    const emailError = validateEmail(input.email)
    if (emailError) throw new AuthError(400, emailError, { code: "invalid_email" })

    const email = normalizeEmail(input.email)
    const row = await findByEmail(email)
    const purpose = row ? "login" : "register"

    const wait = await otp.cooldown({
      userId: row ? Number(row.id) : null,
      email,
      purpose,
    })
    if (!wait.ok) {
      const retryAfter = Math.max(1, Math.ceil(wait.waitMs / 1000))
      throw new AuthError(429, `Attends encore ${retryAfter}s`, {
        code: "otp_cooldown",
        retryAfter,
      })
    }

    const { code } = await otp.issue({
      userId: row ? Number(row.id) : null,
      email,
      purpose,
    })

    try {
      await sendOtpMail({ to: email, code, purpose, appName: config.appName })
    } catch (error) {
      console.error("[aura-auth] envoi OTP échoué :", error?.message ?? error)
      throw new AuthError(
        503,
        "Impossible d'envoyer le mail. Réessaie dans un instant.",
        { code: "mail_failed" },
      )
    }

    const body = { ok: true, emailMasked: maskEmail(email) }
    if (config.echoOtp) body.devOtp = code
    return { status: 200, body }
  }

  async function verifyOtp(input = {}) {
    limit(input.ip)

    const code = String(input.code ?? input.otp ?? "").trim()
    if (!/^\d{6}$/.test(code)) {
      throw new AuthError(400, "Code à 6 chiffres invalide", {
        code: "invalid_otp",
      })
    }

    // Mode email + code : inscription ou connexion sans session OTP.
    if (input.email) {
      const emailError = validateEmail(input.email)
      if (emailError) throw new AuthError(400, emailError, { code: "invalid_email" })

      const email = normalizeEmail(input.email)
      const row = await findByEmail(email)
      const purpose = row ? "login" : "register"

      const result = await otp.verify({
        userId: row ? Number(row.id) : null,
        email,
        purpose,
        code,
      })
      assertOtp(result)

      if (!row) {
        const emailToken = signJwt(
          { purpose: "email-verified", email },
          config.secret,
          config.emailTokenTtlSeconds,
        )
        return {
          status: 200,
          body: {
            needsProfile: true,
            email,
            emailMasked: maskEmail(email),
            emailToken,
          },
        }
      }

      await markVerified(row.id)
      const fresh = await findById(row.id)
      return issueSession(fresh)
    }

    // Mode session OTP : token court émis par register/login/resend.
    if (!input.otpToken) {
      throw new AuthError(400, "Session OTP manquante", {
        code: "otp_token_missing",
      })
    }

    const payload = readOtpToken(input.otpToken)
    const row = await findById(payload.sub)
    if (!row) throw new AuthError(404, "Utilisateur introuvable")

    const result = await otp.verify({
      userId: Number(row.id),
      email: row.email,
      purpose: payload.otpPurpose,
      code,
    })
    assertOtp(result)

    await markVerified(row.id)
    const fresh = await findById(row.id)
    return issueSession(fresh)
  }

  async function resendOtp(input = {}) {
    limit(input.ip, "otp")

    if (!input.otpToken) {
      throw new AuthError(400, "Session OTP manquante", {
        code: "otp_token_missing",
      })
    }

    const payload = readOtpToken(input.otpToken)
    const row = await findById(payload.sub)
    if (!row) throw new AuthError(404, "Utilisateur introuvable")

    const wait = await otp.cooldown({
      userId: Number(row.id),
      email: row.email,
      purpose: payload.otpPurpose,
    })
    if (!wait.ok) {
      const retryAfter = Math.max(1, Math.ceil(wait.waitMs / 1000))
      throw new AuthError(429, `Attends encore ${retryAfter}s`, {
        code: "otp_cooldown",
        retryAfter,
      })
    }

    return startOtp(row, payload.otpPurpose)
  }

  // -------------------------------------------------------------------------
  // Mot de passe
  // -------------------------------------------------------------------------

  async function forgotPassword(input = {}) {
    limit(input.ip, "otp")

    const emailError = validateEmail(input.email)
    if (emailError) throw new AuthError(400, emailError, { code: "invalid_email" })

    const email = normalizeEmail(input.email)
    const row = await findByEmail(email)

    // Réponse identique que le compte existe ou non (anti-énumération).
    if (!row) return { status: 200, body: { ok: true } }

    const wait = await otp.cooldown({
      userId: Number(row.id),
      email,
      purpose: "reset",
    })
    if (!wait.ok) {
      const retryAfter = Math.max(1, Math.ceil(wait.waitMs / 1000))
      throw new AuthError(429, `Attends encore ${retryAfter}s`, {
        code: "otp_cooldown",
        retryAfter,
      })
    }

    const { code } = await otp.issue({
      userId: Number(row.id),
      email,
      purpose: "reset",
    })

    try {
      await sendOtpMail({ to: email, code, purpose: "reset", appName: config.appName })
    } catch (error) {
      console.error("[aura-auth] envoi OTP échoué :", error?.message ?? error)
      throw new AuthError(
        503,
        "Impossible d'envoyer le mail. Réessaie dans un instant.",
        { code: "mail_failed" },
      )
    }

    return { status: 200, body: { ok: true } }
  }

  async function resetPassword(input = {}) {
    limit(input.ip)

    const emailError = validateEmail(input.email)
    if (emailError) throw new AuthError(400, emailError, { code: "invalid_email" })

    const passwordError = validatePassword(
      input.password,
      config.minPasswordLength,
      config.maxPasswordLength,
    )
    if (passwordError) {
      throw new AuthError(400, passwordError, { code: "invalid_password" })
    }

    const code = String(input.code ?? input.otp ?? "").trim()
    if (!/^\d{6}$/.test(code)) {
      throw new AuthError(400, "Code à 6 chiffres invalide", {
        code: "invalid_otp",
      })
    }

    const email = normalizeEmail(input.email)
    const row = await findByEmail(email)
    if (!row) {
      throw new AuthError(400, "Code incorrect", { code: "otp_invalid" })
    }

    const result = await otp.verify({
      userId: Number(row.id),
      email,
      purpose: "reset",
      code,
    })
    assertOtp(result)

    const passwordHash = await hashPassword(input.password)
    await db.run(
      `UPDATE aura_users
       SET password_hash = ?, token_version = token_version + 1,
           email_verified = 1, updated_at = ?
       WHERE id = ?`,
      [passwordHash, nowIso(), row.id],
    )

    return { status: 200, body: { ok: true } }
  }

  async function changePassword(input = {}) {
    limit(input.ip)

    const row = await findById(input.userId)
    if (!row) throw new AuthError(401, "Authentification requise")

    const passwordError = validatePassword(
      input.newPassword,
      config.minPasswordLength,
      config.maxPasswordLength,
    )
    if (passwordError) {
      throw new AuthError(400, passwordError, { code: "invalid_password" })
    }

    const currentOk = await verifyPassword(
      String(input.currentPassword ?? ""),
      row.password_hash,
    )
    if (!currentOk) {
      throw new AuthError(401, "Mot de passe actuel incorrect", {
        code: "invalid_current_password",
      })
    }

    const passwordHash = await hashPassword(input.newPassword)
    await db.run(
      `UPDATE aura_users
       SET password_hash = ?, token_version = token_version + 1, updated_at = ?
       WHERE id = ?`,
      [passwordHash, nowIso(), row.id],
    )

    const fresh = await findById(row.id)
    const session = issueSession(fresh)
    return {
      ...session,
      body: { ok: true, user: session.body.user },
    }
  }

  // -------------------------------------------------------------------------
  // Session et profil
  // -------------------------------------------------------------------------

  async function requireSession(input = {}) {
    const token = input.token
    if (!token) {
      throw new AuthError(401, "Authentification requise", {
        code: "auth_required",
      })
    }

    let payload
    try {
      payload = verifyJwt(token, config.secret)
    } catch {
      throw new AuthError(401, "Session invalide ou expirée", {
        code: "invalid_session",
      })
    }

    if (!payload?.sub) {
      throw new AuthError(401, "Session invalide", { code: "invalid_session" })
    }

    const row = await findById(payload.sub)
    if (!row) {
      throw new AuthError(401, "Session invalide", { code: "invalid_session" })
    }

    if (Number(payload.tv ?? 0) !== Number(row.token_version ?? 0)) {
      throw new AuthError(401, "Session révoquée — reconnecte-toi", {
        code: "session_revoked",
      })
    }

    return publicUser(row)
  }

  async function me(input = {}) {
    const user = await requireSession(input)
    return { status: 200, body: { user } }
  }

  async function updateProfile(input = {}) {
    const user = await requireSession({ token: input.token })
    const patch = input.patch ?? {}

    const updates = []
    const params = []

    if (Object.hasOwn(patch, "displayName")) {
      const check = validateDisplayName(patch.displayName)
      if (check.error) {
        throw new AuthError(400, check.error, { code: "invalid_display_name" })
      }
      if (!check.value) {
        throw new AuthError(400, "Le nom affiché ne peut pas être vide", {
          code: "invalid_display_name",
        })
      }
      updates.push("display_name = ?")
      params.push(check.value)
    }

    if (Object.hasOwn(patch, "username")) {
      const check = validateUsername(patch.username)
      if (check.error) {
        throw new AuthError(400, check.error, { code: "invalid_username" })
      }
      if (!check.value) {
        throw new AuthError(400, "Le pseudo ne peut pas être vide", {
          code: "invalid_username",
        })
      }
      const existing = await db.get(
        "SELECT id FROM aura_users WHERE username = ? COLLATE NOCASE AND id <> ?",
        [check.value, user.id],
      )
      if (existing) {
        throw new AuthError(409, "Ce pseudo existe déjà", {
          code: "username_taken",
        })
      }
      updates.push("username = ?")
      params.push(check.value)
    }

    if (updates.length === 0) {
      throw new AuthError(400, "Rien à mettre à jour", { code: "empty_patch" })
    }

    updates.push("updated_at = ?")
    params.push(nowIso(), user.id)

    await db.run(
      `UPDATE aura_users SET ${updates.join(", ")} WHERE id = ?`,
      params,
    )

    const row = await findById(user.id)
    return { status: 200, body: { user: publicUser(row) } }
  }

  async function logout() {
    return { status: 200, body: { ok: true }, clearSession: true }
  }

  return {
    config,
    register,
    login,
    logout,
    sendOtp,
    verifyOtp,
    resendOtp,
    forgotPassword,
    resetPassword,
    changePassword,
    requireSession,
    me,
    updateProfile,
  }
}
