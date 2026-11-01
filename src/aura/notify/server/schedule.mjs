/**
 * Aura Notify — service push et calendrier de notifications.
 *
 * Indépendant du framework et de la base : on fournit `db` (get/all/run) et un
 * `sender` (createWebPushSender, ou un faux sender pour les tests).
 *
 * Le client calcule ses échéances (rappels, prévision de plein) et les envoie
 * via syncSchedule. Le serveur se contente de stocker et d'envoyer à l'heure.
 */

export class NotifyError extends Error {
  constructor(status, message, options = {}) {
    super(message)
    this.name = "NotifyError"
    this.status = status
    this.code = options.code ?? "notify_error"
  }
}

function nowIso() {
  return new Date().toISOString()
}

function asUserId(value) {
  const id = Number(value)
  if (!Number.isInteger(id) || id <= 0) {
    throw new NotifyError(400, "Utilisateur invalide", { code: "invalid_user" })
  }
  return id
}

function asText(value, max, label) {
  const text = String(value ?? "").trim()
  if (!text) throw new NotifyError(400, `${label} requis`, { code: "invalid_item" })
  if (text.length > max) {
    throw new NotifyError(400, `${label} trop long`, { code: "invalid_item" })
  }
  return text
}

function normalizeItem(item) {
  if (!item || typeof item !== "object") {
    throw new NotifyError(400, "Notification invalide", { code: "invalid_item" })
  }

  const at = Date.parse(String(item.at ?? ""))
  if (!Number.isFinite(at)) {
    throw new NotifyError(400, "Date de notification invalide", {
      code: "invalid_item",
    })
  }

  return {
    key: asText(item.key, 120, "Clé"),
    at: new Date(at).toISOString(),
    title: asText(item.title, 120, "Titre"),
    body: asText(item.body, 500, "Message"),
    url: item.url ? String(item.url).slice(0, 500) : null,
    tag: item.tag ? String(item.tag).slice(0, 120) : null,
  }
}

export function createPushService({
  db,
  sender = null,
  vapidPublicKey = null,
  appName = "Aura",
  maxAttempts = 5,
} = {}) {
  if (!db || typeof db.run !== "function") {
    throw new Error("createPushService : db requis (get, all, run)")
  }

  async function subscribe(userId, subscription) {
    const id = asUserId(userId)
    const endpoint = String(subscription?.endpoint ?? "").trim()
    const p256dh = String(subscription?.keys?.p256dh ?? "").trim()
    const auth = String(subscription?.keys?.auth ?? "").trim()

    if (!endpoint || !p256dh || !auth) {
      throw new NotifyError(400, "Abonnement push invalide", {
        code: "invalid_subscription",
      })
    }

    await db.run(
      `INSERT INTO aura_push_subscriptions
         (user_id, endpoint, p256dh, auth, created_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(endpoint) DO UPDATE SET
         user_id = excluded.user_id,
         p256dh = excluded.p256dh,
         auth = excluded.auth`,
      [id, endpoint, p256dh, auth, nowIso()],
    )

    return { ok: true }
  }

  async function unsubscribe(userId, endpoint) {
    const id = asUserId(userId)
    await db.run(
      "DELETE FROM aura_push_subscriptions WHERE user_id = ? AND endpoint = ?",
      [id, String(endpoint ?? "")],
    )
    return { ok: true }
  }

  async function subscriptions(userId) {
    const id = asUserId(userId)
    return db.all(
      "SELECT endpoint, p256dh, auth FROM aura_push_subscriptions WHERE user_id = ?",
      [id],
    )
  }

  async function sendToUser(userId, payload) {
    if (!sender) {
      return { sent: 0, failed: 0, skipped: true, reason: "no-sender" }
    }

    const subs = await subscriptions(userId)
    if (subs.length === 0) {
      return { sent: 0, failed: 0, skipped: true, reason: "no-subscriptions" }
    }

    let sent = 0
    let failed = 0
    const errors = []

    for (const sub of subs) {
      try {
        await sender.send(sub, payload)
        sent += 1
      } catch (error) {
        failed += 1
        errors.push({
          endpoint: String(sub.endpoint).slice(0, 40),
          status: error?.statusCode,
          message: error?.message,
        })
        if ([403, 404, 410].includes(Number(error?.statusCode))) {
          await db.run(
            "DELETE FROM aura_push_subscriptions WHERE endpoint = ?",
            [sub.endpoint],
          )
        }
      }
    }

    return { sent, failed, skipped: false, errors }
  }

  async function test(userId) {
    const result = await sendToUser(userId, {
      title: `${appName} — test`,
      body: "Les notifications fonctionnent.",
      url: "/",
      tag: "aura-test",
    })
    return result
  }

  async function syncSchedule(userId, items) {
    const id = asUserId(userId)
    if (!Array.isArray(items)) {
      throw new NotifyError(400, "Liste de notifications invalide", {
        code: "invalid_schedule",
      })
    }
    if (items.length > 200) {
      throw new NotifyError(400, "Trop de notifications planifiées", {
        code: "invalid_schedule",
      })
    }

    const normalized = items.map(normalizeItem)

    // Remplace les échéances futures, conserve l'historique déjà envoyé.
    await db.run(
      "DELETE FROM aura_notification_schedule WHERE user_id = ? AND sent_at IS NULL",
      [id],
    )

    const timestamp = nowIso()
    for (const item of normalized) {
      await db.run(
        `INSERT INTO aura_notification_schedule
           (user_id, key, at, title, body, url, tag, attempts, sent_at, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0, NULL, ?)
         ON CONFLICT(user_id, key) DO UPDATE SET
           at = excluded.at,
           title = excluded.title,
           body = excluded.body,
           url = excluded.url,
           tag = excluded.tag
         WHERE aura_notification_schedule.sent_at IS NULL`,
        [
          id,
          item.key,
          item.at,
          item.title,
          item.body,
          item.url,
          item.tag,
          timestamp,
        ],
      )
    }

    return { scheduled: normalized.length }
  }

  async function scheduleFor(userId, { includeSent = false } = {}) {
    const id = asUserId(userId)
    const rows = await db.all(
      `SELECT * FROM aura_notification_schedule
       WHERE user_id = ?${includeSent ? "" : " AND sent_at IS NULL"}
       ORDER BY at ASC`,
      [id],
    )
    return rows
  }

  async function due({ now = new Date(), limit = 50 } = {}) {
    return db.all(
      `SELECT * FROM aura_notification_schedule
       WHERE sent_at IS NULL AND at <= ?
       ORDER BY at ASC LIMIT ?`,
      [now.toISOString(), Math.max(1, Math.min(200, limit))],
    )
  }

  async function markSent(id) {
    await db.run(
      "UPDATE aura_notification_schedule SET sent_at = ? WHERE id = ?",
      [nowIso(), id],
    )
  }

  async function sendDue(options = {}) {
    if (!sender) {
      return { due: 0, sent: 0, skipped: 0, failed: 0 }
    }

    const rows = await due(options)
    let sent = 0
    let skipped = 0
    let failed = 0

    for (const row of rows) {
      const result = await sendToUser(row.user_id, {
        title: row.title,
        body: row.body,
        url: row.url ?? "/",
        tag: row.tag ?? undefined,
        data: { notificationId: row.id },
      })

      if (result.sent > 0) {
        await markSent(row.id)
        sent += 1
        continue
      }

      const attempts = Number(row.attempts ?? 0) + 1
      if (attempts >= maxAttempts) {
        // On abandonne après plusieurs échecs : pas de flood des semaines
        // plus tard quand l'utilisateur réactive le push.
        await markSent(row.id)
        skipped += 1
      } else {
        await db.run(
          "UPDATE aura_notification_schedule SET attempts = ? WHERE id = ?",
          [attempts, row.id],
        )
        failed += 1
      }
    }

    return { due: rows.length, sent, skipped, failed }
  }

  async function cleanup({ days = 30 } = {}) {
    const threshold = new Date(Date.now() - days * 86_400_000).toISOString()
    await db.run(
      "DELETE FROM aura_notification_schedule WHERE sent_at IS NOT NULL AND sent_at <= ?",
      [threshold],
    )
    return { ok: true }
  }

  return {
    appName,
    getVapidPublicKey: () => vapidPublicKey,
    isConfigured: () => Boolean(sender && vapidPublicKey),
    subscribe,
    unsubscribe,
    subscriptions,
    sendToUser,
    test,
    syncSchedule,
    scheduleFor,
    due,
    sendDue,
    cleanup,
  }
}
