import { useState } from "react"
import { Button } from "./Button"
import { Card } from "./Card"
import { IconButton } from "./IconButton"
import { XIcon } from "./icons"
import { usePwaInstall } from "./pwa"

export interface PwaInstallCardProps {
  appName?: string
  title?: string
  description?: string
  installLabel?: string
  storageKey?: string
  onInstalled?: () => void
  className?: string
}

/**
 * Bandeau d'installation dismissible. À placer sur l'accueil, jamais en
 * overlay bloquant. Sur iOS, `canInstall` reste faux : prévoir un lien
 * « Ajouter à l'écran d'accueil » dans les réglages.
 */
export function PwaInstallCard({
  appName = "cette application",
  title = "Installer l'application",
  description = "Accès plein écran, hors ligne et démarrage plus rapide.",
  installLabel = "Installer",
  storageKey = "aura-install-dismissed",
  onInstalled,
  className,
}: PwaInstallCardProps) {
  const { canInstall, install } = usePwaInstall()
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      return window.localStorage.getItem(storageKey) === "1"
    } catch {
      return true
    }
  })

  if (!canInstall || dismissed) return null

  function dismiss() {
    setDismissed(true)
    try {
      window.localStorage.setItem(storageKey, "1")
    } catch {
      /* ignore */
    }
  }

  async function handleInstall() {
    const outcome = await install()
    if (outcome === "accepted") onInstalled?.()
  }

  return (
    <Card variant="soft" className={className}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
        <div className="aura-empty__icon" style={{ width: 44, height: 44 }}>
          <svg
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <rect x="6" y="2.5" width="12" height="19" rx="3" />
            <path d="M12 7v8m0 0 3-3m-3 3-3-3" />
          </svg>
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <p className="aura-h3">{title}</p>
          <p className="aura-small" style={{ marginTop: 2 }}>
            {description}
          </p>
          <p className="aura-hint" style={{ marginTop: 6 }}>
            {appName}
          </p>
        </div>
        <IconButton label="Masquer" onClick={dismiss} style={{ width: 32, height: 32 }}>
          <XIcon size={16} />
        </IconButton>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <Button size="sm" onClick={() => void handleInstall()}>
          {installLabel}
        </Button>
        <Button size="sm" variant="ghost" onClick={dismiss}>
          Plus tard
        </Button>
      </div>
    </Card>
  )
}
