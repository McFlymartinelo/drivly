import { registerSW } from "virtual:pwa-register"
import { showToast } from "./utils/toast"

let updateSW: ((reloadPage?: boolean) => Promise<void>) | null = null

/**
 * Enregistre le service worker et prévient l'utilisateur quand une nouvelle
 * version est prête, au lieu de le laisser sur un bundle obsolète.
 */
export function initPwa() {
  updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      showToast("Nouvelle version de Drivly disponible.", {
        duration: 0,
        actionLabel: "Recharger",
        onAction: () => {
          void updateSW?.(true)
        },
      })
    },
    onOfflineReady() {
      showToast("Drivly est prêt à fonctionner hors ligne.", {
        tone: "success",
        duration: 3500,
      })
    },
    onRegisterError(error) {
      console.error("Service worker : enregistrement impossible", error)
    },
  })
}
