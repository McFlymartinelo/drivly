import { addDays, differenceInCalendarDays, parseISO } from "date-fns"
import type { Refueling, Reminder, Vehicle } from "../types"
import { fuelMetrics } from "./calculations"
import { createPushClient, type PushClient } from "../aura/notify/react/push"
import type { ServerConfig } from "./server"

export type NotificationStyle = "auto" | "instrument" | "banner" | "card"

export interface NotificationPrefs {
  enabled: boolean
  style: NotificationStyle
  reminders: boolean
  fuel: boolean
}

export interface ScheduledNotification {
  key: string
  at: string
  title: string
  body: string
  url: string
  tag: string
}

const PREFS_KEY = "drivly.notifications.v1"
const SHOWN_KEY = "drivly.notifications.shown.v1"
const STYLES: NotificationStyle[] = ["auto", "instrument", "banner", "card"]

const DEFAULT_PREFS: NotificationPrefs = {
  enabled: false,
  style: "auto",
  reminders: true,
  fuel: true,
}

function readPrefs(): NotificationPrefs {
  if (typeof localStorage === "undefined") return DEFAULT_PREFS
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (!raw) return DEFAULT_PREFS
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>
    return {
      enabled: parsed.enabled === true,
      style: STYLES.includes(parsed.style as NotificationStyle)
        ? (parsed.style as NotificationStyle)
        : "auto",
      reminders: parsed.reminders !== false,
      fuel: parsed.fuel !== false,
    }
  } catch {
    return DEFAULT_PREFS
  }
}

let prefs = readPrefs()
const listeners = new Set<() => void>()

export function getNotificationPrefs(): NotificationPrefs {
  return prefs
}

export function subscribeNotificationPrefs(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function updateNotificationPrefs(patch: Partial<NotificationPrefs>) {
  prefs = { ...prefs, ...patch }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs))
  }
  listeners.forEach((listener) => listener())
}

export function createServerPushClient(config: ServerConfig): PushClient {
  return createPushClient({
    apiBase: config.baseUrl,
    getHeaders: () => ({ Authorization: `Bearer ${config.token}` }),
  })
}

/** Évite de répéter la même notification in-app à chaque ouverture. */
export function wasShown(key: string): boolean {
  if (typeof localStorage === "undefined") return false
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const at = map[key]
    if (!at) return false
    if (Date.now() - at > 7 * 86_400_000) {
      delete map[key]
      localStorage.setItem(SHOWN_KEY, JSON.stringify(map))
      return false
    }
    return true
  } catch {
    return false
  }
}

export function markShown(key: string) {
  if (typeof localStorage === "undefined") return
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {}
    const cutoff = Date.now() - 7 * 86_400_000
    for (const [entry, at] of Object.entries(map)) {
      if (at < cutoff) delete map[entry]
    }
    map[key] = Date.now()
    localStorage.setItem(SHOWN_KEY, JSON.stringify(map))
  } catch {
    // stockage indisponible : on réessaiera.
  }
}

function estimateKmPerDay(fills: Refueling[]): number | null {
  const sorted = [...fills].sort(
    (a, b) => a.date.localeCompare(b.date) || a.kilometrage - b.kilometrage,
  )
  if (sorted.length < 2) return null
  const metrics = fuelMetrics(sorted)
  let km = 0
  let days = 0

  for (const fill of sorted.slice(-4)) {
    const metric = metrics.get(fill.id)
    if (metric?.kmSincePrev && metric?.daysSincePrev) {
      km += metric.kmSincePrev
      days += metric.daysSincePrev
    }
  }

  return days > 0 && km > 0 ? km / days : null
}

interface FuelPrediction {
  last: Refueling
  days: number
  next: Date
  kmLeft: number
}

function predictNextFill(
  fills: Refueling[],
  vehicle: Vehicle,
): FuelPrediction | null {
  const sorted = [...fills].sort(
    (a, b) => a.date.localeCompare(b.date) || a.kilometrage - b.kilometrage,
  )
  if (sorted.length < 2) return null

  const last = sorted[sorted.length - 1]
  const metrics = fuelMetrics(sorted)
  const recent = sorted.slice(-4)

  const kmPerDay = estimateKmPerDay(sorted)
  if (!kmPerDay) return null

  const consumptions = recent
    .map((fill) => metrics.get(fill.id)?.consumption)
    .filter((value): value is number => value != null)

  const consumption =
    consumptions.length > 0
      ? consumptions.reduce((sum, value) => sum + value, 0) / consumptions.length
      : 7

  const capacity =
    vehicle.capaciteReservoir > 0 ? vehicle.capaciteReservoir : last.litres || 50
  const range = (capacity * 100) / consumption
  const kmSinceLast = Math.max(0, vehicle.kmActuel - last.kilometrage)
  const usable = Math.max(0, range * 0.85 - kmSinceLast)

  const intervals = recent
    .map((fill) => metrics.get(fill.id)?.daysSincePrev)
    .filter((value): value is number => value != null && value > 0)
  const intervalDays =
    intervals.length > 0
      ? intervals.reduce((sum, value) => sum + value, 0) / intervals.length
      : 14

  const daysToEmpty = usable / kmPerDay
  const daysToNext = Math.min(
    intervalDays,
    daysToEmpty > 0 ? daysToEmpty : 1,
  )

  return {
    last,
    days: Math.max(1, Math.round(daysToNext)),
    next: addDays(parseISO(last.date), Math.max(1, Math.round(daysToNext))),
    kmLeft: Math.round(usable),
  }
}

function atLeastSoon(date: Date, now: Date): Date {
  const soon = new Date(now.getTime() + 5 * 60_000)
  return date.getTime() < soon.getTime() ? soon : date
}

/**
 * Calcule les prochaines notifications à partir des données locales.
 *
 * - rappels d'entretien : 7 jours avant l'échéance (date ou km estimé) ;
 * - plein : 3 jours avant la date estimée du prochain plein.
 */
export function computeNotificationSchedule({
  vehicles,
  refuelings,
  reminders,
  prefs: current = prefs,
  now = new Date(),
}: {
  vehicles: Vehicle[]
  refuelings: Refueling[]
  reminders: Reminder[]
  prefs?: NotificationPrefs
  now?: Date
}): ScheduledNotification[] {
  const items: ScheduledNotification[] = []
  const vehiclesById = new Map(vehicles.map((vehicle) => [vehicle.id, vehicle]))
  const fillsByVehicle = new Map<string, Refueling[]>()

  for (const fill of refuelings) {
    const list = fillsByVehicle.get(fill.vehicleId) ?? []
    list.push(fill)
    fillsByVehicle.set(fill.vehicleId, list)
  }

  if (current.fuel) {
    for (const vehicle of vehicles) {
      const fills = fillsByVehicle.get(vehicle.id) ?? []
      const prediction = predictNextFill(fills, vehicle)
      if (!prediction) continue
      if (prediction.next.getTime() < now.getTime()) continue

      const notifyAt = atLeastSoon(addDays(prediction.next, -3), now)
      items.push({
        key: `fuel:${vehicle.id}:${prediction.last.id}`,
        at: notifyAt.toISOString(),
        title: "Plein à prévoir",
        body:
          prediction.days <= 1
            ? `Aujourd'hui · ${vehicle.nom}`
            : `Dans ${prediction.days} jours · ${vehicle.nom}`,
        url: "/",
        tag: `fuel-${vehicle.id}`,
      })
    }
  }

  if (current.reminders) {
    for (const reminder of reminders) {
      if (reminder.resolu) continue
      const vehicle = vehiclesById.get(reminder.vehicleId)
      if (!vehicle) continue

      if (reminder.dateEcheance) {
        const due = parseISO(reminder.dateEcheance)
        const daysLeft = differenceInCalendarDays(due, now)
        if (daysLeft < 0 || daysLeft > 21) continue

        const notifyAt = atLeastSoon(addDays(due, -7), now)
        items.push({
          key: `reminder:${reminder.id}:date:${reminder.dateEcheance}`,
          at: notifyAt.toISOString(),
          title: reminder.titre,
          body:
            daysLeft <= 0
              ? `Aujourd'hui · ${vehicle.nom}`
              : `Dans ${daysLeft} jours · ${vehicle.nom}`,
          url: "/rappels",
          tag: `reminder-${reminder.id}`,
        })
        continue
      }

      if (reminder.kmEcheance) {
        const fills = fillsByVehicle.get(vehicle.id) ?? []
        const kmPerDay = estimateKmPerDay(fills)
        if (!kmPerDay) continue

        const kmLeft = reminder.kmEcheance - vehicle.kmActuel
        if (kmLeft < 0) continue
        const daysLeft = kmLeft / kmPerDay
        if (daysLeft > 21) continue

        const notifyAt = atLeastSoon(
          addDays(now, Math.max(0, daysLeft - 7)),
          now,
        )
        items.push({
          key: `reminder:${reminder.id}:km:${reminder.kmEcheance}`,
          at: notifyAt.toISOString(),
          title: reminder.titre,
          body: `Dans ~${Math.max(1, Math.round(daysLeft))} jours (${Math.round(kmLeft)} km) · ${vehicle.nom}`,
          url: "/rappels",
          tag: `reminder-${reminder.id}`,
        })
      }
    }
  }

  const unique = new Map<string, ScheduledNotification>()
  for (const item of items) {
    if (!unique.has(item.key)) unique.set(item.key, item)
  }

  return [...unique.values()]
    .sort((a, b) => a.at.localeCompare(b.at))
    .slice(0, 50)
}
