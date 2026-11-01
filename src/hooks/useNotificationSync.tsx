import { useLiveQuery } from "dexie-react-hooks"
import { useEffect, useMemo, useRef, useSyncExternalStore } from "react"
import { useNavigate } from "react-router-dom"
import { useNotify } from "../aura/notify/react"
import { db } from "../db/db"
import {
  computeNotificationSchedule,
  getNotificationPrefs,
  markShown,
  subscribeNotificationPrefs,
  wasShown,
} from "../utils/notifications"
import { loadServerConfig, syncNotifications } from "../utils/server"
import { useApp } from "./useApp"

/**
 * Calcule les échéances (rappels + prochain plein), les envoie au serveur pour
 * le push, et affiche celles qui sont déjà dues dans l'app.
 */
export function NotificationSync() {
  const { ready, vehicles } = useApp()
  const prefs = useSyncExternalStore(
    subscribeNotificationPrefs,
    getNotificationPrefs,
    getNotificationPrefs,
  )
  const { notify } = useNotify()
  const navigate = useNavigate()
  const timer = useRef<number | null>(null)

  const allRefuelings = useLiveQuery(() => db.refuelings.toArray()) ?? []
  const allReminders = useLiveQuery(() => db.reminders.toArray()) ?? []

  const signature = useMemo(
    () =>
      JSON.stringify([
        vehicles.map((vehicle) => [vehicle.id, vehicle.kmActuel]),
        allRefuelings.map((fill) => [fill.id, fill.date, fill.kilometrage]),
        allReminders.map((reminder) => [
          reminder.id,
          reminder.resolu,
          reminder.dateEcheance,
          reminder.kmEcheance,
        ]),
        prefs.enabled,
        prefs.reminders,
        prefs.fuel,
      ]),
    [vehicles, allRefuelings, allReminders, prefs],
  )

  useEffect(() => {
    if (!ready) return
    if (timer.current != null) window.clearTimeout(timer.current)

    timer.current = window.setTimeout(() => {
      const items = computeNotificationSchedule({
        vehicles,
        refuelings: allRefuelings,
        reminders: allReminders,
        prefs,
      })

      const config = loadServerConfig()
      if (prefs.enabled && config?.email) {
        void syncNotifications(config, items).catch(() => {
          // Serveur injoignable : on réessaiera à la prochaine modification.
        })
      }

      if (!prefs.enabled) return

      const now = Date.now()
      for (const item of items) {
        if (new Date(item.at).getTime() > now) continue
        if (wasShown(item.key)) continue
        markShown(item.key)
        notify({
          title: item.title,
          message: item.body,
          tone: "info",
          duration: 8000,
          tag: item.key,
          action: {
            label: "Voir",
            onClick: () => navigate(item.url),
          },
        })
      }
    }, 1200)

    return () => {
      if (timer.current != null) window.clearTimeout(timer.current)
    }
  }, [ready, signature, vehicles, allRefuelings, allReminders, prefs, notify, navigate])

  return null
}
