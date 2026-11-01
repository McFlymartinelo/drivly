import { useEffect, useState } from "react"

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
}

/** Vrai si l'app tourne déjà en mode installé (standalone). */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false
  const iosStandalone = (window.navigator as Navigator & { standalone?: boolean })
    .standalone
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    iosStandalone === true
  )
}

export interface PwaInstallState {
  canInstall: boolean
  installed: boolean
  install: () => Promise<"accepted" | "dismissed" | "unavailable">
}

/**
 * Capture l'événement `beforeinstallprompt` et expose une installation
 * déclenchable depuis l'UI (Chrome/Edge/Android). Sur iOS, l'utilisateur
 * doit passer par Partager → « Sur l'écran d'accueil » : afficher un guide.
 */
export function usePwaInstall(): PwaInstallState {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [installed, setInstalled] = useState(isStandalone)

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault()
      setDeferred(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener("beforeinstallprompt", onPrompt)
    window.addEventListener("appinstalled", onInstalled)
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt)
      window.removeEventListener("appinstalled", onInstalled)
    }
  }, [])

  async function install(): Promise<"accepted" | "dismissed" | "unavailable"> {
    if (!deferred) return "unavailable"
    await deferred.prompt()
    const choice = await deferred.userChoice
    setDeferred(null)
    return choice.outcome
  }

  return { canInstall: deferred != null && !installed, installed, install }
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(
    () => typeof navigator === "undefined" || navigator.onLine,
  )

  useEffect(() => {
    const onOnline = () => setOnline(true)
    const onOffline = () => setOnline(false)
    window.addEventListener("online", onOnline)
    window.addEventListener("offline", onOffline)
    return () => {
      window.removeEventListener("online", onOnline)
      window.removeEventListener("offline", onOffline)
    }
  }, [])

  return online
}

type BadgeNavigator = Navigator & {
  setAppBadge?: (count?: number) => Promise<void>
  clearAppBadge?: () => Promise<void>
}

/** Badge sur l'icône de l'app installée (Android/desktop compatibles). */
export function useAppBadge(count?: number): void {
  useEffect(() => {
    if (typeof navigator === "undefined") return
    const nav = navigator as BadgeNavigator
    if (count == null) {
      void nav.clearAppBadge?.()
      return
    }
    void nav.setAppBadge?.(count)
  }, [count])
}

/** Enregistre un service worker, avec un chemin configurable. */
export async function registerServiceWorker(
  url = "/sw.js",
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return null
  }
  try {
    return await navigator.serviceWorker.register(url)
  } catch (error) {
    console.error("Service worker : enregistrement impossible", error)
    return null
  }
}
