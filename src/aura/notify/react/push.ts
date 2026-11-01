/**
 * Push Web (VAPID) côté client.
 *
 * Le serveur expose :
 *   GET  {apiBase}/push/vapid        -> { configured, publicKey }
 *   POST {apiBase}/push/subscribe    -> { ok }
 *   POST {apiBase}/push/unsubscribe  -> { ok }
 *   POST {apiBase}/push/test         -> { sent }
 *
 * Sur iPhone, le push n'existe que dans la PWA installée (iOS 16.4+).
 */

export interface PushContext {
  ios: boolean
  standalone: boolean
  supported: boolean
  needsInstall: boolean
  permission: NotificationPermission | "unsupported"
}

export interface PushStatus extends PushContext {
  enabled: boolean
  subscribed: boolean
  vapidConfigured: boolean
}

export interface PushEnableResult {
  ok: boolean
  reason?:
    | "ios-install"
    | "unsupported"
    | "vapid"
    | "denied"
    | "error"
  error?: string
}

export interface PushClientOptions {
  /** Base de l'API, par défaut `/api`. */
  apiBase?: string
  /** URL du service worker généré par la PWA. */
  swUrl?: string
  /** En-têtes additionnels (Authorization pour une session). */
  getHeaders?: () => Record<string, string>
  subscribePath?: string
  unsubscribePath?: string
  vapidPath?: string
  testPath?: string
  storageKey?: string
  fetch?: typeof fetch
}

export interface PushTestResult {
  sent: number
  failed?: number
  skipped?: boolean
  reason?: string
}

export interface PushClient {
  context: () => PushContext
  status: () => Promise<PushStatus>
  enable: () => Promise<PushEnableResult>
  disable: () => Promise<void>
  sync: () => Promise<void>
  test: () => Promise<PushTestResult>
  showLocal: (title: string, body: string, url?: string) => Promise<boolean>
  isEnabled: () => boolean
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding)
    .replace(/-/g, "+")
    .replace(/_/g, "/")
  const raw = atob(base64)
  const bytes = new Uint8Array(raw.length)
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index)
  }
  return bytes
}

function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

function keyMatches(
  subscription: PushSubscription,
  publicKey: string,
): boolean {
  const actual = subscription.options?.applicationServerKey
  if (!actual) return true
  const expected = urlBase64ToUint8Array(publicKey)
  const bytes = new Uint8Array(actual)
  if (bytes.length !== expected.length) return false
  return bytes.every((value, index) => value === expected[index])
}

export function createPushClient(
  options: PushClientOptions = {},
): PushClient {
  const apiBase = (options.apiBase ?? "/api").replace(/\/+$/, "")
  const swUrl = options.swUrl ?? "/sw.js"
  const subscribePath = options.subscribePath ?? "/push/subscribe"
  const unsubscribePath = options.unsubscribePath ?? "/push/unsubscribe"
  const vapidPath = options.vapidPath ?? "/push/vapid"
  const testPath = options.testPath ?? "/push/test"
  const storageKey = options.storageKey ?? "aura_push_enabled"
  const getHeaders = options.getHeaders ?? (() => ({}))
  const doFetch = options.fetch ?? globalThis.fetch

  function context(): PushContext {
    const supported =
      typeof navigator !== "undefined" &&
      "serviceWorker" in navigator &&
      typeof window !== "undefined" &&
      "PushManager" in window
    const permission: NotificationPermission | "unsupported" =
      typeof Notification === "undefined"
        ? "unsupported"
        : Notification.permission
    const ios = isIosDevice()
    const standalone = isStandalone()
    return {
      ios,
      standalone,
      supported,
      needsInstall: ios && !standalone,
      permission,
    }
  }

  async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await doFetch(`${apiBase}${path}`, {
      ...init,
      headers: {
        "content-type": "application/json",
        ...getHeaders(),
        ...((init.headers as Record<string, string> | undefined) ?? {}),
      },
    })

    const data = (await response.json().catch(() => ({}))) as
      | { error?: string }
      | T
    if (!response.ok) {
      throw new Error(
        (data as { error?: string }).error ?? `Erreur ${response.status}`,
      )
    }
    return data as T
  }

  async function registration(): Promise<ServiceWorkerRegistration> {
    const existing = await navigator.serviceWorker.getRegistration("/")
    if (existing) {
      await navigator.serviceWorker.ready
      return existing
    }
    const reg = await navigator.serviceWorker.register(swUrl)
    await navigator.serviceWorker.ready
    return reg
  }

  async function vapid(): Promise<{ configured: boolean; publicKey?: string }> {
    return request(vapidPath)
  }

  async function ensureSubscription(
    reg: ServiceWorkerRegistration,
    publicKey: string,
  ): Promise<PushSubscription> {
    let subscription = await reg.pushManager.getSubscription()
    if (!subscription || !keyMatches(subscription, publicKey)) {
      if (subscription) await subscription.unsubscribe()
      subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      })
    }
    return subscription
  }

  function isEnabled(): boolean {
    if (typeof localStorage === "undefined") return false
    return localStorage.getItem(storageKey) === "1"
  }

  async function status(): Promise<PushStatus> {
    const ctx = context()
    let subscribed = false
    let vapidConfigured = false

    if (ctx.supported && ctx.permission === "granted") {
      try {
        const reg = await navigator.serviceWorker.getRegistration("/")
        subscribed = Boolean(await reg?.pushManager?.getSubscription())
      } catch {
        subscribed = false
      }
    }

    try {
      vapidConfigured = Boolean((await vapid()).configured)
    } catch {
      vapidConfigured = false
    }

    return { ...ctx, enabled: isEnabled(), subscribed, vapidConfigured }
  }

  async function enable(): Promise<PushEnableResult> {
    const ctx = context()
    if (ctx.needsInstall) return { ok: false, reason: "ios-install" }
    if (!ctx.supported) return { ok: false, reason: "unsupported" }

    try {
      const keys = await vapid()
      if (!keys.configured || !keys.publicKey) {
        return { ok: false, reason: "vapid" }
      }

      const permission = await Notification.requestPermission()
      if (permission !== "granted") return { ok: false, reason: "denied" }

      const reg = await registration()
      const subscription = await ensureSubscription(reg, keys.publicKey)

      await request(subscribePath, {
        method: "POST",
        body: JSON.stringify(subscription.toJSON()),
      })

      localStorage.setItem(storageKey, "1")
      return { ok: true }
    } catch (error) {
      return {
        ok: false,
        reason: "error",
        error: error instanceof Error ? error.message : "Abonnement refusé.",
      }
    }
  }

  async function disable(): Promise<void> {
    try {
      const reg = await navigator.serviceWorker.getRegistration("/")
      const subscription = await reg?.pushManager?.getSubscription()
      if (subscription) {
        await request(unsubscribePath, {
          method: "POST",
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        })
        await subscription.unsubscribe()
      }
    } catch {
      // On désactive quand même côté client.
    } finally {
      localStorage.removeItem(storageKey)
    }
  }

  async function sync(): Promise<void> {
    if (!isEnabled()) return
    const ctx = context()
    if (ctx.needsInstall || !ctx.supported) return
    if (ctx.permission !== "granted") {
      localStorage.removeItem(storageKey)
      return
    }

    try {
      const keys = await vapid()
      if (!keys.configured || !keys.publicKey) return
      const reg = await registration()
      const subscription = await ensureSubscription(reg, keys.publicKey)
      await request(subscribePath, {
        method: "POST",
        body: JSON.stringify({ ...subscription.toJSON(), quiet: true }),
      })
    } catch {
      // Silencieux : la prochaine ouverture réessaiera.
    }
  }

  async function test(): Promise<PushTestResult> {
    return request(testPath, { method: "POST" })
  }

  async function showLocal(
    title: string,
    body: string,
    url = "/",
  ): Promise<boolean> {
    if (typeof Notification === "undefined") return false
    if (Notification.permission !== "granted") return false

    try {
      const reg = await registration()
      await reg.showNotification(title, {
        body,
        tag: `aura-local-${Date.now()}`,
        data: { url },
      })
      return true
    } catch {
      return false
    }
  }

  return {
    context,
    status,
    enable,
    disable,
    sync,
    test,
    showLocal,
    isEnabled,
  }
}
