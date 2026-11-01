import { Bell, BellOff, Smartphone } from "lucide-react"
import {
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
} from "react"
import {
  useNotify,
  type PushStatus,
} from "../../aura/notify/react"
import {
  createServerPushClient,
  getNotificationPrefs,
  subscribeNotificationPrefs,
  updateNotificationPrefs,
  type NotificationStyle,
} from "../../utils/notifications"
import { loadServerConfig, type ServerConfig } from "../../utils/server"
import { showToast } from "../../utils/toast"
import { useApp } from "../../hooks/useApp"
import { Card, Toggle } from "../shared/Form"

const STYLE_OPTIONS: Array<{ id: NotificationStyle; label: string }> = [
  { id: "auto", label: "Auto" },
  { id: "instrument", label: "Instrument" },
  { id: "banner", label: "Bandeau" },
  { id: "card", label: "Carte" },
]

export function NotificationsCard() {
  const prefs = useSyncExternalStore(
    subscribeNotificationPrefs,
    getNotificationPrefs,
    getNotificationPrefs,
  )
  const { notify } = useNotify()
  const { vehicle } = useApp()
  const [config, setConfig] = useState<ServerConfig | null>(() =>
    loadServerConfig(),
  )
  const [status, setStatus] = useState<PushStatus | null>(null)
  const [busy, setBusy] = useState(false)

  const push = useMemo(
    () => (config ? createServerPushClient(config) : null),
    [config],
  )

  useEffect(() => {
    function sync() {
      setConfig(loadServerConfig())
    }
    window.addEventListener("drivly:server-config", sync)
    return () => window.removeEventListener("drivly:server-config", sync)
  }, [])

  useEffect(() => {
    let alive = true
    if (!push) {
      setStatus(null)
      return
    }
    void push
      .status()
      .then((next) => {
        if (alive) setStatus(next)
      })
      .catch(() => {
        if (alive) setStatus(null)
      })
    return () => {
      alive = false
    }
  }, [push, prefs.enabled])

  async function enable() {
    if (!push || !config) {
      showToast("Configure d'abord la sauvegarde serveur.", { tone: "error" })
      return
    }
    if (!config.email) {
      showToast("Connecte-toi à ton compte serveur pour recevoir les push.", {
        tone: "error",
      })
      return
    }

    setBusy(true)
    const result = await push.enable()
    setBusy(false)

    if (!result.ok) {
      const messages: Record<string, string> = {
        "ios-install":
          "Sur iPhone : Partager → Sur l'écran d'accueil, puis ouvre Drivly.",
        unsupported: "Ce navigateur ne gère pas les notifications push.",
        vapid: "Push non configuré sur le serveur (clés VAPID manquantes).",
        denied:
          "Permission refusée. Autorise Drivly dans les réglages du navigateur.",
        error: result.error ?? "Abonnement push impossible.",
      }
      showToast(messages[result.reason ?? "error"], { tone: "error" })
      return
    }

    updateNotificationPrefs({ enabled: true })
    setStatus(await push.status())
    showToast("Notifications activées.", { tone: "success" })

    void push
      .test()
      .then((sent) => {
        if (sent.sent > 0) {
          showToast("Push test envoyé.", { tone: "success" })
        }
      })
      .catch(() => {})
  }

  async function disable() {
    setBusy(true)
    await push?.disable()
    updateNotificationPrefs({ enabled: false })
    setStatus(push ? await push.status() : null)
    setBusy(false)
    showToast("Notifications désactivées.")
  }

  async function test() {
    notify({
      title: "Contrôle technique",
      message: `Dans 3 jours · ${vehicle?.nom ?? "ton véhicule"}`,
      tone: "info",
      duration: 8000,
      action: { label: "Voir", onClick: () => {} },
    })

    if (!push || !prefs.enabled) {
      showToast("Notification in-app affichée.")
      return
    }

    try {
      const result = await push.test()
      if (result.sent > 0) {
        showToast("Push test envoyé.", { tone: "success" })
      } else if (result.skipped) {
        showToast(
          "Aucun appareil abonné. Désactive puis réactive les notifications.",
          { tone: "info" },
        )
      } else {
        showToast(
          "Le serveur n'a pas confirmé l'envoi. Si la notification est arrivée sur ton téléphone, c'est bon ; sinon, désactive puis réactive les notifications.",
          { tone: "info" },
        )
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Test push impossible.",
        { tone: "error" },
      )
    }
  }

  const hint = !config
    ? "La sauvegarde serveur doit être configurée pour recevoir les push hors de l'app."
    : !config.email
      ? "Connecte-toi à ton compte serveur pour recevoir les push."
      : status?.needsInstall
        ? "Sur iPhone : Partager → Sur l'écran d'accueil, puis ouvre Drivly."
        : status && !status.vapidConfigured
          ? "Push non configuré sur le serveur (VAPID manquant)."
          : status?.permission === "denied"
            ? "Permission refusée : autorise Drivly dans les réglages."
            : null

  const dot = prefs.enabled && status?.subscribed
    ? "bg-lime ring-1 ring-black/10"
    : prefs.enabled
      ? "bg-orange"
      : "bg-slate-300"

  return (
    <Card className="px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-teal-deep">
          {prefs.enabled ? (
            <Bell className="h-5 w-5" />
          ) : (
            <BellOff className="h-5 w-5" />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-[14px] font-semibold text-ink">Notifications</p>
            <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden />
          </div>
          <p className="text-[12px] leading-snug text-muted">
            Rappels d'entretien et prochain plein, dans l'app et sur l'écran
            verrouillé.
          </p>

          {hint ? (
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-app px-2.5 py-2 text-[11px] leading-snug text-muted">
              <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {hint}
            </p>
          ) : null}

          <div className="mt-2 flex flex-wrap gap-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void (prefs.enabled ? disable() : enable())}
              className={`rounded-full px-3 py-1.5 text-[12px] font-bold disabled:opacity-50 ${
                prefs.enabled
                  ? "bg-app text-muted"
                  : "bg-teal text-white"
              }`}
            >
              {busy
                ? "…"
                : prefs.enabled
                  ? "Désactiver"
                  : "Activer"}
            </button>
            <button
              type="button"
              onClick={() => void test()}
              className="rounded-full bg-teal-soft px-3 py-1.5 text-[12px] font-bold text-teal-deep"
            >
              Tester
            </button>
          </div>

          <div className="mt-3">
            <p className="text-[11px] font-semibold text-muted">Style</p>
            <div className="mt-1 grid grid-cols-2 gap-1 rounded-2xl bg-app p-1">
              {STYLE_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() =>
                    updateNotificationPrefs({ style: option.id })
                  }
                  className={`rounded-xl py-2 text-[11px] font-semibold ${
                    prefs.style === option.id
                      ? "bg-surface text-ink shadow-sm"
                      : "text-muted"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-1 text-[10.5px] leading-snug text-muted">
              Auto = Instrument sur Android, Bandeau sur iPhone.
            </p>
          </div>

          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between rounded-lg bg-app px-2.5 py-1.5">
              <span className="text-[12px] text-ink">Rappels d'entretien</span>
              <Toggle
                checked={prefs.reminders}
                onChange={(reminders) =>
                  updateNotificationPrefs({ reminders })
                }
              />
            </div>
            <div className="flex items-center justify-between rounded-lg bg-app px-2.5 py-1.5">
              <span className="text-[12px] text-ink">Prévision de plein</span>
              <Toggle
                checked={prefs.fuel}
                onChange={(fuel) => updateNotificationPrefs({ fuel })}
              />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
