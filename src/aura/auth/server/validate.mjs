/** Validation partagée entre le service et les écrans. */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const CONTROL_RE = /[\u0000-\u001f\u007f]/

export function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

export function validateEmail(value) {
  const email = normalizeEmail(value)
  if (!email) return "Entre une adresse mail"
  if (email.length > 254 || !EMAIL_RE.test(email)) return "Adresse mail invalide"
  return null
}

export function validatePassword(value, min = 8, max = 128) {
  if (typeof value !== "string" || value.length === 0) {
    return "Entre un mot de passe"
  }
  if (value.length < min) {
    return `Mot de passe trop court — ${min} caractères minimum`
  }
  if (value.length > max) {
    return `Mot de passe trop long — ${max} caractères maximum`
  }
  return null
}

export function validateUsername(value) {
  const raw = String(value ?? "").trim()
  if (!raw) return { value: null, display: null }
  if (raw.length < 2) return { error: "Pseudo trop court — 2 caractères minimum" }
  if (raw.length > 32) return { error: "Pseudo trop long — 32 caractères maximum" }
  if (raw.includes("@")) return { error: "Le pseudo ne peut pas contenir de @" }
  if (CONTROL_RE.test(raw)) return { error: "Pseudo invalide" }
  return { value: raw.toLowerCase(), display: raw }
}

export function validateDisplayName(value) {
  if (value === undefined || value === null || value === "") {
    return { value: null }
  }
  if (typeof value !== "string") return { error: "Nom affiché invalide" }

  const name = value.trim()
  if (!name) return { value: null }
  if (name.length > 60) return { error: "Nom affiché trop long — 60 caractères maximum" }
  if (CONTROL_RE.test(name)) return { error: "Nom affiché invalide" }
  return { value: name }
}

export function maskEmail(value) {
  const email = normalizeEmail(value)
  const at = email.indexOf("@")
  if (at <= 0) return "***"
  const local = email.slice(0, at)
  const domain = email.slice(at + 1)
  if (!domain) return "***"
  return `${local.slice(0, 1) || "*"}***@${domain}`
}
