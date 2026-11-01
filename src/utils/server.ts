import type { ExportPayload } from "./export"

const CONFIG_KEY = "drivly.server.v1"

export interface ServerConfig {
  /** Base de l'API : « /api » par défaut (même origine, proxifié par nginx). */
  baseUrl: string
  /** Jeton de session (compte) ou ancien jeton statique du serveur. */
  token: string
  /** Email du compte connecté, si le serveur gère les comptes. */
  email?: string
  /** Sauvegarde automatique après chaque modification. */
  auto: boolean
}

export interface ServerUser {
  id: number
  email: string
  displayName: string | null
  username: string | null
  isAdmin: boolean
}

export interface ServerSession {
  token: string
  user: ServerUser
}

export interface BackupMeta {
  id: number
  createdAt: string
  device: string
  counts: Record<string, number>
  bytes: number
}

export interface BackupWithPayload {
  backup: BackupMeta
  payload: unknown
}

export function defaultServerConfig(): ServerConfig {
  return { baseUrl: "/api", token: "", auto: true }
}

export function loadServerConfig(): ServerConfig | null {
  try {
    const raw = localStorage.getItem(CONFIG_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<ServerConfig>
    if (typeof parsed.token !== "string" || !parsed.token) return null
    return {
      baseUrl: typeof parsed.baseUrl === "string" && parsed.baseUrl ? parsed.baseUrl : "/api",
      token: parsed.token,
      email: typeof parsed.email === "string" && parsed.email ? parsed.email : undefined,
      auto: parsed.auto !== false,
    }
  } catch {
    return null
  }
}

export function saveServerConfig(config: ServerConfig) {
  localStorage.setItem(
    CONFIG_KEY,
    JSON.stringify({
      baseUrl: normalizeBase(config.baseUrl),
      token: config.token.trim(),
      email: config.email?.trim() || undefined,
      auto: config.auto,
    }),
  )
  window.dispatchEvent(new Event("drivly:server-config"))
}

export function clearServerConfig() {
  localStorage.removeItem(CONFIG_KEY)
  window.dispatchEvent(new Event("drivly:server-config"))
}

export function normalizeBase(baseUrl: string): string {
  const trimmed = baseUrl.trim() || "/api"
  return trimmed.replace(/\/+$/, "")
}

function endpoint(baseUrl: string, path: string): string {
  return `${normalizeBase(baseUrl)}${path}`
}

async function requestWithToken<T>(
  baseUrl: string,
  path: string,
  token: string | null,
  init?: RequestInit,
): Promise<T> {
  let response: Response
  try {
    response = await fetch(endpoint(baseUrl, path), {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init?.headers ?? {}),
      },
    })
  } catch {
    throw new Error("Serveur injoignable. Vérifie l'adresse et la connexion.")
  }

  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const message =
      data && typeof data === "object" && "error" in data
        ? String((data as { error: unknown }).error)
        : `Erreur ${response.status}`
    throw new Error(message)
  }

  return data as T
}

function request<T>(config: ServerConfig, path: string, init?: RequestInit): Promise<T> {
  return requestWithToken<T>(config.baseUrl, path, config.token, init)
}

/** Connexion à un compte serveur. Renvoie un jeton de session. */
export async function loginServer(
  baseUrl: string,
  email: string,
  password: string,
): Promise<ServerSession> {
  const result = await requestWithToken<{ token?: string; user?: ServerUser }>(
    baseUrl,
    "/auth/login",
    null,
    {
      method: "POST",
      body: JSON.stringify({ identifier: email.trim(), password }),
    },
  )

  if (!result.token || !result.user) {
    throw new Error(
      "Ce serveur ne gère pas encore les comptes. Mets-le à jour, ou utilise un jeton.",
    )
  }
  return { token: result.token, user: result.user }
}

/** Crée un compte sur le serveur. `code` = DRIVLY_TOKEN du serveur. */
export async function registerServer(
  baseUrl: string,
  input: { email: string; password: string; displayName?: string; code: string },
): Promise<ServerSession> {
  const result = await requestWithToken<{ token?: string; user?: ServerUser }>(
    baseUrl,
    "/auth/register",
    null,
    { method: "POST", body: JSON.stringify(input) },
  )

  if (!result.token || !result.user) {
    throw new Error(
      "Compte créé, mais aucune session renvoyée. Mets le serveur à jour.",
    )
  }
  return { token: result.token, user: result.user }
}

/** Envoie le calendrier de notifications calculé côté client. */
export async function syncNotifications(
  config: ServerConfig,
  items: Array<{
    key: string
    at: string
    title: string
    body: string
    url?: string
    tag?: string
  }>,
): Promise<{ scheduled: number }> {
  return request(config, "/notifications/schedule", {
    method: "POST",
    body: JSON.stringify({ items }),
  })
}

export async function checkServer(config: ServerConfig): Promise<boolean> {
  const result = await request<{ ok?: boolean }>(config, "/health")
  return result?.ok === true
}

export async function pushBackup(
  config: ServerConfig,
  payload: ExportPayload,
  device: string,
): Promise<{ skipped: boolean; backup: BackupMeta }> {
  return request(config, "/backups", {
    method: "POST",
    body: JSON.stringify({ payload, device }),
  })
}

export async function listBackups(
  config: ServerConfig,
  limit = 20,
): Promise<BackupMeta[]> {
  const result = await request<{ backups: BackupMeta[] }>(
    config,
    `/backups?limit=${limit}`,
  )
  return result.backups
}

export async function getBackup(
  config: ServerConfig,
  id?: number,
): Promise<BackupWithPayload> {
  return request(config, id == null ? "/backups/latest" : `/backups/${id}`)
}

/** Libellé lisible pour distinguer les appareils dans la liste des sauvegardes. */
export function deviceLabel(): string {
  const ua = navigator.userAgent
  const platform = /iPhone/.test(ua)
    ? "iPhone"
    : /iPad/.test(ua)
      ? "iPad"
      : /Android/.test(ua)
        ? "Android"
        : /Mac/.test(ua)
          ? "Mac"
          : /Win/.test(ua)
            ? "Windows"
            : /Linux/.test(ua)
              ? "Linux"
              : "Appareil"
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /OPR\//.test(ua)
      ? "Opera"
      : /Chrome\//.test(ua)
        ? "Chrome"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Safari\//.test(ua)
            ? "Safari"
            : "navigateur"
  return `${platform} · ${browser}`
}
