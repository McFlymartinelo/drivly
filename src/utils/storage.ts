export interface StorageInfo {
  persisted: boolean
  usage: number | null
  quota: number | null
}

/**
 * Demande au navigateur de ne pas évincer IndexedDB. Sans cela, un carnet
 * tenu sur plusieurs années peut disparaître lors d'un nettoyage de stockage
 * (en particulier sur iOS).
 */
export async function ensurePersistentStorage(): Promise<boolean> {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) return false
  try {
    if (await navigator.storage.persisted()) return true
    return await navigator.storage.persist()
  } catch {
    return false
  }
}

export async function getStorageInfo(): Promise<StorageInfo> {
  if (typeof navigator === "undefined" || !navigator.storage) {
    return { persisted: false, usage: null, quota: null }
  }
  try {
    const [persisted, estimate] = await Promise.all([
      navigator.storage.persisted?.() ?? Promise.resolve(false),
      navigator.storage.estimate?.() ?? Promise.resolve({ usage: undefined, quota: undefined }),
    ])
    return {
      persisted,
      usage: estimate.usage ?? null,
      quota: estimate.quota ?? null,
    }
  } catch {
    return { persisted: false, usage: null, quota: null }
  }
}

export function formatBytes(bytes: number | null): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—"
  if (bytes < 1024) return `${bytes} o`
  const units = ["Ko", "Mo", "Go"]
  let value = bytes / 1024
  let index = 0
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024
    index += 1
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[index]}`
}
