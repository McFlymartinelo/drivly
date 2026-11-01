import { createHmac, randomInt, timingSafeEqual } from "node:crypto"
import { normalizeEmail } from "./validate.mjs"

/**
 * Stockage et vérification des codes OTP.
 *
 * - code à 6 chiffres, tiré avec crypto.randomInt ;
 * - stocké hashé en HMAC-SHA256 avec le secret de l'app (un dump SQL ne suffit
 *   pas à rejouer un code) ;
 * - un seul code actif par (email, purpose) ;
 * - expiration, nombre de tentatives et cooldown de renvoi configurables.
 */

export const OTP_PURPOSES = Object.freeze(["register", "login", "reset"])
const OTP_LENGTH = 6

function now() {
  return Date.now()
}

function iso(ms) {
  return new Date(ms).toISOString()
}

function parseTime(value) {
  const time = Date.parse(String(value ?? ""))
  return Number.isFinite(time) ? time : Number.NaN
}

export function createOtpStore({ db, config, secret }) {
  const pepper = secret

  function hash(code) {
    return createHmac("sha256", pepper).update(String(code)).digest("hex")
  }

  function assertPurpose(purpose) {
    if (!OTP_PURPOSES.includes(purpose)) {
      throw new Error(`Purpose OTP invalide : ${purpose}`)
    }
  }

  async function cleanup() {
    await db.run("DELETE FROM aura_email_otps WHERE expires_at <= ?", [iso(now())])
  }

  async function issue({ userId = null, email, purpose }) {
    assertPurpose(purpose)
    const mail = normalizeEmail(email)
    if (!mail) throw new Error("Aucune adresse mail")

    await cleanup()

    const code = String(randomInt(0, 10 ** OTP_LENGTH)).padStart(OTP_LENGTH, "0")
    const createdAt = iso(now())
    const expiresAt = iso(now() + config.otpTtlMs)

    await db.run(
      "DELETE FROM aura_email_otps WHERE email = ? AND purpose = ?",
      [mail, purpose],
    )
    if (userId) {
      await db.run(
        "DELETE FROM aura_email_otps WHERE user_id = ? AND purpose = ?",
        [userId, purpose],
      )
    }

    await db.run(
      `INSERT INTO aura_email_otps
         (user_id, email, purpose, code_hash, expires_at, attempts, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`,
      [userId, mail, purpose, hash(code), expiresAt, createdAt],
    )

    return { code, expiresAt }
  }

  async function latest({ userId = null, email, purpose }) {
    const byUser = Boolean(userId)
    const row = await db.get(
      `SELECT * FROM aura_email_otps
       WHERE ${byUser ? "user_id = ?" : "email = ?"} AND purpose = ?
       ORDER BY id DESC LIMIT 1`,
      [byUser ? userId : normalizeEmail(email), purpose],
    )
    return row ?? null
  }

  async function cooldown({ userId = null, email, purpose }) {
    const row = await latest({ userId, email, purpose })
    if (!row) return { ok: true }

    if (parseTime(row.expires_at) <= now()) return { ok: true }

    const createdAt = parseTime(row.created_at)
    if (!Number.isFinite(createdAt)) return { ok: true }

    const waitMs = config.otpResendMs - (now() - createdAt)
    return waitMs > 0 ? { ok: false, waitMs } : { ok: true }
  }

  async function remove(id) {
    await db.run("DELETE FROM aura_email_otps WHERE id = ?", [id])
  }

  async function verify({ userId = null, email, purpose, code }) {
    assertPurpose(purpose)

    const row = await latest({ userId, email, purpose })
    if (!row) {
      return {
        ok: false,
        code: "otp_missing",
        error: "Aucun code en cours — demande-en un nouveau",
      }
    }

    if (parseTime(row.expires_at) <= now()) {
      await remove(row.id)
      return {
        ok: false,
        code: "otp_expired",
        error: "Code expiré — renvoie-en un",
      }
    }

    const attempts = Number(row.attempts) || 0
    if (attempts >= config.otpMaxAttempts) {
      await remove(row.id)
      return {
        ok: false,
        code: "otp_attempts",
        error: "Trop de tentatives — renvoie un nouveau code",
      }
    }

    const expected = Buffer.from(String(row.code_hash), "hex")
    const provided = Buffer.from(hash(code), "hex")
    const match =
      expected.length === provided.length &&
      expected.length > 0 &&
      timingSafeEqual(expected, provided)

    if (!match) {
      const next = attempts + 1
      if (next >= config.otpMaxAttempts) {
        await remove(row.id)
        return {
          ok: false,
          code: "otp_attempts",
          error: "Trop de tentatives — renvoie un nouveau code",
        }
      }
      await db.run("UPDATE aura_email_otps SET attempts = ? WHERE id = ?", [
        next,
        row.id,
      ])
      return { ok: false, code: "otp_invalid", error: "Code incorrect" }
    }

    await remove(row.id)
    return { ok: true, row }
  }

  return { issue, verify, cooldown, cleanup }
}
