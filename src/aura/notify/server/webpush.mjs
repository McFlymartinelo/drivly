/**
 * Envoi Web Push via `web-push` (dépendance optionnelle de l'application hôte).
 *
 *   const sender = await createWebPushSender({
 *     publicKey: process.env.VAPID_PUBLIC_KEY,
 *     privateKey: process.env.VAPID_PRIVATE_KEY,
 *     subject: "mailto:admin@exemple.fr",
 *   })
 */
export async function createWebPushSender({
  publicKey,
  privateKey,
  subject = "mailto:admin@example.com",
  ttl = 86_400,
  urgency = "high",
} = {}) {
  if (!publicKey || !privateKey) {
    throw new Error("createWebPushSender : clés VAPID manquantes")
  }

  let webpush
  try {
    const module = await import("web-push")
    webpush = module.default ?? module
  } catch {
    throw new Error(
      "createWebPushSender : installe « web-push » dans l'application hôte.",
    )
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)

  return {
    async send(subscription, payload) {
      return webpush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        { TTL: ttl, urgency },
      )
    },
  }
}

/** Génère une paire VAPID (à faire une fois, puis mettre dans .env). */
export async function generateVapidKeys() {
  let webpush
  try {
    const module = await import("web-push")
    webpush = module.default ?? module
  } catch {
    throw new Error("generateVapidKeys : installe « web-push » d'abord.")
  }
  return webpush.generateVAPIDKeys()
}
