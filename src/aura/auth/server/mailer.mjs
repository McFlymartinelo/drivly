/**
 * Mailer de l'auth.
 *
 * Trois options :
 *   1. `createResendMailer({ apiKey, from })` — API HTTP, zéro dépendance ;
 *   2. une fonction `async ({ to, code, purpose }) => {}` (SMTP maison, Brevo,
 *      Postmark, console…) ;
 *   3. `createConsoleMailer()` — développement uniquement, logge le code.
 *
 * En production, l'absence de mailer fait échouer le démarrage : on ne veut
 * jamais d'un code OTP qui n'arrive nulle part.
 */

const ACCENT = "#0F766E"

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

function copyFor(purpose, appName) {
  switch (purpose) {
    case "login":
      return {
        subject: `Ton code de connexion ${appName}`,
        lead: "Voici le code pour te connecter :",
        textLead: `Voici ton code de connexion ${appName} :`,
      }
    case "reset":
      return {
        subject: `Réinitialise ton mot de passe ${appName}`,
        lead: "Voici le code pour choisir un nouveau mot de passe :",
        textLead: `Voici ton code de réinitialisation ${appName} :`,
      }
    default:
      return {
        subject: `Confirme ton compte ${appName}`,
        lead: "Voici le code pour confirmer ton compte :",
        textLead: `Voici ton code de confirmation ${appName} :`,
      }
  }
}

export function renderOtpEmail({
  code,
  purpose = "register",
  appName = "Aura",
  accent = ACCENT,
  ttlMinutes = 10,
}) {
  const name = escapeHtml(appName)
  const copy = copyFor(purpose, appName)
  const digits = escapeHtml(String(code).split("").join(" "))
  const safeAccent = /^#[0-9a-f]{3,8}$/i.test(accent) ? accent : ACCENT

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${name}</title>
</head>
<body style="margin:0;padding:28px 18px;background:#f5f7f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:#111827">
  <div style="max-width:440px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:18px;padding:30px 26px;text-align:center">
    <div style="font-size:13px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:${safeAccent}">${name}</div>
    <p style="margin:18px 0 0;font-size:15px;line-height:1.5;color:#4b5563">${escapeHtml(copy.lead)}</p>
    <div style="margin:20px 0;padding:16px 8px;background:#f3f6f8;border-radius:12px;font-family:ui-monospace,SFMono-Regular,Consolas,monospace;font-size:32px;line-height:1.2;letter-spacing:.26em;font-weight:700;color:#111827">${digits}</div>
    <p style="margin:0;font-size:13px;line-height:1.5;color:#6b7280">Ce code expire dans ${ttlMinutes} minutes.<br>Si tu n'es pas à l'origine de cette demande, ignore ce mail.</p>
  </div>
</body>
</html>`

  const text = `${copy.textLead}

${code}

Ce code expire dans ${ttlMinutes} minutes.
Si tu n'es pas à l'origine de cette demande, ignore ce mail.`

  return { subject: copy.subject, html, text }
}

export function createConsoleMailer({ appName = "Aura", log = console } = {}) {
  return {
    async sendOtp({ to, code, purpose }) {
      const line = `[aura-auth] OTP ${purpose} pour ${to} : ${code}`
      if (typeof log.warn === "function") log.warn(line)
      else log.log(line)
    },
  }
}

export function createResendMailer({
  apiKey,
  from,
  appName = "Aura",
  accent = ACCENT,
  fetch: fetchImpl = globalThis.fetch,
} = {}) {
  if (!apiKey) throw new Error("createResendMailer : apiKey requis")
  if (!from) throw new Error("createResendMailer : expéditeur (from) requis")
  if (typeof fetchImpl !== "function") {
    throw new Error("createResendMailer : fetch indisponible (Node 18+ requis)")
  }

  return {
    async sendOtp({ to, code, purpose }) {
      const { subject, html, text } = renderOtpEmail({ code, purpose, appName, accent })
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          authorization: `Bearer ${apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ from, to, subject, html, text }),
      })

      if (!response.ok) {
        const detail = await response.text().catch(() => "")
        throw new Error(`Resend ${response.status} : ${detail.slice(0, 200)}`)
      }
    },
  }
}

/**
 * Normalise un mailer (objet ou fonction) en une fonction `sendOtp`.
 */
export function normalizeMailer(mailer, config) {
  let resolved = mailer

  if (!resolved) {
    if (typeof process !== "undefined" && process.env?.NODE_ENV === "production") {
      throw new Error(
        "Aura Auth : aucun mailer configuré en production. " +
          "Utilise createResendMailer() ou une fonction sendOtp.",
      )
    }
    resolved = createConsoleMailer({ appName: config.appName })
  }

  if (typeof resolved === "function") return resolved

  const sendOtp = resolved.sendOtp
  if (typeof sendOtp !== "function") {
    throw new Error("Aura Auth : mailer invalide (attendu : fonction ou { sendOtp })")
  }
  return (message) => sendOtp.call(resolved, message)
}
