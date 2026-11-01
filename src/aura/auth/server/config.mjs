/**
 * Configuration du service d'auth.
 *
 * Un seul secret obligatoire : `AUTH_SECRET` (ou `config.secret`).
 * 32 caractères minimum, jamais une valeur de démonstration en production.
 */

const DEFAULTS = Object.freeze({
  appName: "Aura",
  sessionTtlSeconds: 60 * 60 * 24 * 30,
  otpTokenTtlSeconds: 60 * 15,
  emailTokenTtlSeconds: 60 * 30,
  otpTtlMs: 10 * 60 * 1000,
  otpMaxAttempts: 5,
  otpResendMs: 30_000,
  requireOtpOnLogin: true,
  requireEmailVerification: true,
  minPasswordLength: 8,
  maxPasswordLength: 128,
  cookieName: "aura_session",
  cookiePath: "/",
  cookieDomain: undefined,
  cookieSameSite: "Lax",
  secureCookies: false,
  exposeToken: false,
  echoOtp: false,
  rateLimitWindowMs: 15 * 60 * 1000,
  rateLimitMax: 20,
  rateLimitOtpMax: 8,
  registrationCode: null,
})

const MIN_SECRET_LENGTH = 32

function env(name) {
  return typeof process !== "undefined" ? process.env?.[name] : undefined
}

function number(value, fallback, { min = 0 } = {}) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= min ? parsed : fallback
}

function boolean(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback
  if (typeof value === "boolean") return value
  return String(value).toLowerCase() === "true"
}

/**
 * Fusionne les options avec les valeurs par défaut et les variables d'env.
 * Les options explicites gagnent toujours sur l'environnement.
 */
export function resolveConfig(input = {}) {
  const isProduction = env("NODE_ENV") === "production"
  const secret = String(input.secret ?? env("AUTH_SECRET") ?? "").trim()

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      "Aura Auth : AUTH_SECRET manquant ou trop court (32 caractères minimum). " +
        "Génère-le avec : node -e \"console.log(require('node:crypto').randomBytes(32).toString('base64url'))\"",
    )
  }

  const config = {
    ...DEFAULTS,
    appName: String(input.appName ?? env("AUTH_APP_NAME") ?? DEFAULTS.appName).trim(),
    secret,
    sessionTtlSeconds: number(
      input.sessionTtlSeconds ?? env("AUTH_SESSION_TTL"),
      DEFAULTS.sessionTtlSeconds,
      { min: 60 },
    ),
    otpTokenTtlSeconds: number(
      input.otpTokenTtlSeconds,
      DEFAULTS.otpTokenTtlSeconds,
      { min: 60 },
    ),
    emailTokenTtlSeconds: number(
      input.emailTokenTtlSeconds,
      DEFAULTS.emailTokenTtlSeconds,
      { min: 60 },
    ),
    otpTtlMs: number(input.otpTtlMs, DEFAULTS.otpTtlMs, { min: 60_000 }),
    otpMaxAttempts: number(input.otpMaxAttempts, DEFAULTS.otpMaxAttempts, {
      min: 1,
    }),
    otpResendMs: number(input.otpResendMs, DEFAULTS.otpResendMs),
    requireOtpOnLogin: boolean(
      input.requireOtpOnLogin ?? env("AUTH_OTP_ON_LOGIN"),
      DEFAULTS.requireOtpOnLogin,
    ),
    requireEmailVerification: boolean(
      input.requireEmailVerification,
      DEFAULTS.requireEmailVerification,
    ),
    minPasswordLength: number(
      input.minPasswordLength,
      DEFAULTS.minPasswordLength,
      { min: 6 },
    ),
    maxPasswordLength: number(
      input.maxPasswordLength,
      DEFAULTS.maxPasswordLength,
      { min: 32 },
    ),
    cookieName: String(input.cookieName ?? DEFAULTS.cookieName),
    cookiePath: String(input.cookiePath ?? DEFAULTS.cookiePath),
    cookieDomain: input.cookieDomain,
    cookieSameSite: input.cookieSameSite ?? DEFAULTS.cookieSameSite,
    secureCookies: boolean(
      input.secureCookies ?? env("AUTH_SECURE_COOKIES"),
      isProduction,
    ),
    exposeToken: boolean(input.exposeToken, DEFAULTS.exposeToken),
    echoOtp: boolean(input.echoOtp ?? env("AUTH_OTP_ECHO"), DEFAULTS.echoOtp),
    rateLimitWindowMs: number(
      input.rateLimitWindowMs,
      DEFAULTS.rateLimitWindowMs,
      { min: 1000 },
    ),
    rateLimitMax: number(input.rateLimitMax, DEFAULTS.rateLimitMax, { min: 1 }),
    rateLimitOtpMax: number(input.rateLimitOtpMax, DEFAULTS.rateLimitOtpMax, {
      min: 1,
    }),
    registrationCode: input.registrationCode
      ? String(input.registrationCode)
      : env("AUTH_REGISTRATION_CODE")
        ? String(env("AUTH_REGISTRATION_CODE"))
        : null,
  }

  if (isProduction && config.echoOtp) {
    throw new Error("Aura Auth : AUTH_OTP_ECHO est interdit en production.")
  }
  if (isProduction && config.exposeToken && !input.allowTokenInProduction) {
    // Autorise les backends mobiles (Expo), mais jamais par défaut.
    throw new Error(
      "Aura Auth : exposeToken en production doit être explicite (allowTokenInProduction: true).",
    )
  }
  if (config.cookieSameSite === "None" && !config.secureCookies) {
    throw new Error(
      "Aura Auth : SameSite=None exige secureCookies (HTTPS) pour être accepté par les navigateurs.",
    )
  }

  return Object.freeze(config)
}
