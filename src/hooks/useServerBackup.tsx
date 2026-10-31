import { useEffect, useMemo, useState, useSyncExternalStore } from "react"
import {
  deviceLabel,
  loadServerConfig,
  pushBackup,
} from "../utils/server"
import { exportAll } from "../utils/export"
import { useApp } from "./useApp"

const LAST_SAVED_KEY = "drivly.server.lastSaved"

export type BackupState = "disabled" | "idle" | "saving" | "saved" | "error"

export interface BackupStatus {
  state: BackupState
  lastSavedAt: string | null
  error: string | null
}

export interface PushResult {
  ok: boolean
  skipped?: boolean
  error?: string
}

let status: BackupStatus = {
  state: "disabled",
  lastSavedAt: localStorage.getItem(LAST_SAVED_KEY),
  error: null,
}

const listeners = new Set<() => void>()
let inflight: Promise<PushResult> | null = null

function emit() {
  listeners.forEach((listener) => listener())
}

function setStatus(patch: Partial<BackupStatus>) {
  status = { ...status, ...patch }
  emit()
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function useBackupStatus(): BackupStatus {
  return useSyncExternalStore(subscribe, () => status, () => status)
}

/**
 * Envoie la base locale au serveur. Le serveur ignore l'envoi si le contenu
 * est identique à la dernière sauvegarde (déduplication par empreinte SHA-256).
 */
export function pushBackupNow(): Promise<PushResult> {
  if (inflight) return inflight

  const config = loadServerConfig()
  if (!config) {
    setStatus({ state: "disabled", error: null })
    return Promise.resolve({ ok: false, error: "Sauvegarde serveur non configurée." })
  }

  setStatus({ state: "saving", error: null })
  inflight = (async () => {
    try {
      const payload = await exportAll()
      const entries =
        payload.vehicles.length +
        payload.refuelings.length +
        payload.reminders.length +
        payload.maintenances.length +
        payload.expenses.length +
        payload.revenues.length +
        payload.readings.length +
        payload.trips.length +
        payload.checklists.length
      if (entries === 0) {
        // Ne jamais écraser la sauvegarde serveur avec une base vide
        // (premier lancement, données effacées, restauration à faire).
        setStatus({ state: "idle", error: null })
        return {
          ok: false,
          error: "Base locale vide : restaure une sauvegarde au lieu d'en envoyer une.",
        }
      }
      const result = await pushBackup(config, payload, deviceLabel())
      setStatus({
        state: "saved",
        lastSavedAt: result.backup.createdAt,
        error: null,
      })
      localStorage.setItem(LAST_SAVED_KEY, result.backup.createdAt)
      return { ok: true, skipped: result.skipped }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Sauvegarde serveur impossible."
      setStatus({ state: "error", error: message })
      return { ok: false, error: message }
    } finally {
      inflight = null
    }
  })()

  return inflight
}

/**
 * Sauvegarde automatique : déclenchée après une modification (debounce) et
 * quand l'application passe en arrière-plan (utile sur mobile).
 */
export function AutoBackup() {
  const {
    ready,
    vehicles,
    refuelings,
    reminders,
    maintenances,
    expenses,
    revenues,
    readings,
    trips,
    checklists,
  } = useApp()
  const [configEpoch, setConfigEpoch] = useState(0)

  const signature = useMemo(
    () =>
      JSON.stringify([
        vehicles,
        refuelings,
        reminders,
        maintenances,
        expenses,
        revenues,
        readings,
        trips,
        checklists,
      ]),
    [
      vehicles,
      refuelings,
      reminders,
      maintenances,
      expenses,
      revenues,
      readings,
      trips,
      checklists,
    ],
  )

  useEffect(() => {
    function onConfigChange() {
      setConfigEpoch((value) => value + 1)
    }
    window.addEventListener("drivly:server-config", onConfigChange)
    return () => window.removeEventListener("drivly:server-config", onConfigChange)
  }, [])

  useEffect(() => {
    if (!loadServerConfig()) setStatus({ state: "disabled", error: null })
  }, [configEpoch])

  useEffect(() => {
    if (!ready) return
    const config = loadServerConfig()
    if (!config || !config.auto) return
    const timer = window.setTimeout(() => {
      void pushBackupNow()
    }, 8000)
    return () => window.clearTimeout(timer)
  }, [signature, ready, configEpoch])

  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden" && loadServerConfig()?.auto) {
        void pushBackupNow()
      }
    }
    document.addEventListener("visibilitychange", onVisibility)
    return () => document.removeEventListener("visibilitychange", onVisibility)
  }, [])

  return null
}
