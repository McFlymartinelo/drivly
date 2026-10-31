import { differenceInCalendarDays, parseISO } from "date-fns"
import type {
  Expense,
  Maintenance,
  Refueling,
  RefuelingStats,
  Reminder,
  ReminderStats,
  Revenue,
  Vehicle,
} from "../types"

const kmNumber = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 })

/**
 * Bornes de plausibilité d'une consommation (L/100km). En dehors, la valeur
 * vient presque toujours d'un plein partiel mal saisi ou d'un relevé manquant :
 * on l'ignore au lieu de polluer les moyennes, les graphiques et les min/max.
 */
export const MIN_PLAUSIBLE_CONSUMPTION = 2
export const MAX_PLAUSIBLE_CONSUMPTION = 20

export function isPlausibleConsumption(value: number | null | undefined): boolean {
  return (
    value != null &&
    Number.isFinite(value) &&
    value >= MIN_PLAUSIBLE_CONSUMPTION &&
    value <= MAX_PLAUSIBLE_CONSUMPTION
  )
}

function dayDiff(fromIso: string, toIso: string): number | null {
  const from = parseISO(fromIso)
  const to = parseISO(toIso)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) return null
  return differenceInCalendarDays(to, from)
}

/** Dernier plein complet strictement antérieur au plein courant. */
export function previousFullTank(
  fills: Refueling[],
  current: Refueling,
): Refueling | undefined {
  return fills
    .filter(
      (f) =>
        f.vehicleId === current.vehicleId &&
        f.pleinComplet &&
        f.id !== current.id &&
        (f.date < current.date ||
          (f.date === current.date && f.kilometrage < current.kilometrage)),
    )
    .sort((a, b) => b.date.localeCompare(a.date) || b.kilometrage - a.kilometrage)[0]
}

export interface FillMetrics {
  /** Distance parcourue depuis le plein précédent (tous pleins confondus). */
  kmSincePrev: number | null
  /** Jours écoulés depuis le plein précédent. */
  daysSincePrev: number | null
  /** Distance de référence : segment entre deux pleins complets, sinon delta. */
  distance: number | null
  /** Consommation réelle en L/100 km, uniquement sur un plein complet. */
  consumption: number | null
  /** Coût au km sur le même périmètre que `distance`. */
  costPerKm: number | null
  /** Litres cumulés depuis le dernier plein complet. */
  segmentLitres: number | null
  /** Coût cumulé depuis le dernier plein complet. */
  segmentCost: number | null
}

const metricsCache = new WeakMap<Refueling[], Map<string, FillMetrics>>()

/**
 * Calcule les métriques de chaque plein en une passe.
 *
 * Les pleins partiels ne permettent pas de calculer une consommation : leurs
 * litres sont reportés au prochain plein complet. La consommation n'est donc
 * affichée que lorsque le réservoir est rempli, sur le segment complet
 * (dernier plein complet -> plein courant).
 */
export function fuelMetrics(fills: Refueling[]): Map<string, FillMetrics> {
  const cached = metricsCache.get(fills)
  if (cached) return cached

  const sorted = [...fills].sort(
    (a, b) => a.date.localeCompare(b.date) || a.kilometrage - b.kilometrage,
  )
  const map = new Map<string, FillMetrics>()
  let prev: Refueling | undefined
  let lastFull: Refueling | undefined
  let accLitres = 0
  let accCost = 0

  for (const fill of sorted) {
    const kmSincePrev =
      prev && fill.kilometrage > prev.kilometrage
        ? fill.kilometrage - prev.kilometrage
        : null
    const daysSincePrev = prev ? dayDiff(prev.date, fill.date) : null

    const metrics: FillMetrics = {
      kmSincePrev,
      daysSincePrev,
      distance: kmSincePrev,
      consumption: null,
      costPerKm:
        kmSincePrev != null && kmSincePrev > 0
          ? fill.coutTotal / kmSincePrev
          : null,
      segmentLitres: null,
      segmentCost: null,
    }

    if (lastFull) {
      accLitres += fill.litres
      accCost += fill.coutTotal
    }

    if (fill.pleinComplet && lastFull) {
      const segment = fill.kilometrage - lastFull.kilometrage
      if (segment > 0 && accLitres > 0) {
        const consumption = (accLitres / segment) * 100
        if (isPlausibleConsumption(consumption)) {
          metrics.distance = segment
          metrics.consumption = consumption
          metrics.costPerKm = accCost / segment
          metrics.segmentLitres = accLitres
          metrics.segmentCost = accCost
        } else {
          // Segment incohérent : on garde la distance factuelle mais on
          // n'expose ni consommation ni coût au km.
          metrics.distance = segment
          metrics.consumption = null
          metrics.costPerKm = null
        }
      }
    }

    if (fill.pleinComplet) {
      lastFull = fill
      accLitres = 0
      accCost = 0
    }

    prev = fill
    map.set(fill.id, metrics)
  }

  metricsCache.set(fills, map)
  return map
}

export function computeRefuelingStats(
  fill: Refueling,
  fills: Refueling[],
  vehicle?: Vehicle,
): RefuelingStats {
  const metrics = fuelMetrics(fills).get(fill.id)
  const distance = metrics?.distance ?? null
  const consommation = metrics?.consumption ?? null
  const coutParKm = metrics?.costPerKm ?? null
  const pourcentageReservoir =
    vehicle && vehicle.capaciteReservoir > 0
      ? Math.min(100, (fill.litres / vehicle.capaciteReservoir) * 100)
      : null

  return { distance, consommation, coutParKm, pourcentageReservoir }
}

export function computeReminderStats(
  reminder: Reminder,
  kmActuel: number,
  from = new Date(),
): ReminderStats {
  const kmRestants =
    reminder.kmEcheance != null ? reminder.kmEcheance - kmActuel : null
  const date = reminder.dateEcheance ? parseISO(reminder.dateEcheance) : null
  const joursRestants =
    date && !Number.isNaN(date.getTime())
      ? differenceInCalendarDays(date, from)
      : null
  return { kmRestants, joursRestants }
}

export type ReminderLevel = "ok" | "soon" | "late"

export interface ReminderStatus {
  level: ReminderLevel
  kmText: string | null
  daysText: string | null
}

/**
 * Statut lisible d'un rappel : gère les échéances dépassées au lieu de les
 * afficher comme « dans 0 km » ou « dans -12 jours ».
 */
export function reminderStatus(
  reminder: Reminder,
  kmActuel: number,
  from = new Date(),
): ReminderStatus {
  const { kmRestants, joursRestants } = computeReminderStats(reminder, kmActuel, from)

  let kmText: string | null = null
  let daysText: string | null = null
  let level: ReminderLevel = "ok"

  if (kmRestants != null) {
    if (kmRestants < 0) {
      kmText = `Dépassé de ${kmNumber.format(Math.abs(Math.round(kmRestants)))} km`
      level = "late"
    } else {
      kmText = `Dans ${kmNumber.format(Math.round(kmRestants))} km`
      if (kmRestants <= 1000) level = "soon"
    }
  }

  if (joursRestants != null) {
    if (joursRestants < 0) {
      const n = Math.abs(joursRestants)
      daysText = `En retard de ${n} jour${n > 1 ? "s" : ""}`
      level = "late"
    } else if (joursRestants === 0) {
      daysText = "Aujourd'hui"
      if (level !== "late") level = "soon"
    } else {
      daysText = `Dans ${joursRestants} jour${joursRestants > 1 ? "s" : ""}`
      if (joursRestants <= 30 && level !== "late") level = "soon"
    }
  }

  return { level, kmText, daysText }
}

export function inRange(iso: string, from: string, to: string): boolean {
  return iso >= from && iso <= to
}

export interface FuelAggregates {
  count: number
  totalCost: number
  totalLitres: number
  avgPrice: number
  minPrice: number
  maxPrice: number
  minCost: number
  maxCost: number
  minLitres: number
  maxLitres: number
  distance: number
  avgConsumption: number
  minConsumption: number
  maxConsumption: number
  costPerKm: number
  minCostPerKm: number
  maxCostPerKm: number
  avgIntervalKm: number
  avgIntervalDays: number
  lastIntervalKm: number
}

export function aggregateFuel(
  fills: Refueling[],
  allFills: Refueling[],
): FuelAggregates {
  const empty: FuelAggregates = {
    count: 0,
    totalCost: 0,
    totalLitres: 0,
    avgPrice: 0,
    minPrice: 0,
    maxPrice: 0,
    minCost: 0,
    maxCost: 0,
    minLitres: 0,
    maxLitres: 0,
    distance: 0,
    avgConsumption: 0,
    minConsumption: 0,
    maxConsumption: 0,
    costPerKm: 0,
    minCostPerKm: 0,
    maxCostPerKm: 0,
    avgIntervalKm: 0,
    avgIntervalDays: 0,
    lastIntervalKm: 0,
  }
  if (fills.length === 0) return empty

  const metrics = fuelMetrics(allFills)
  const totalCost = fills.reduce((s, f) => s + f.coutTotal, 0)
  const totalLitres = fills.reduce((s, f) => s + f.litres, 0)
  const prices = fills.map((f) => f.prixAuLitre)
  const costs = fills.map((f) => f.coutTotal)
  const litres = fills.map((f) => f.litres)

  const kms = fills.map((f) => f.kilometrage)
  const distance = Math.max(0, Math.max(...kms) - Math.min(...kms))

  // Consommation pondérée : litres réellement consommés / distance réelle.
  let segmentLitres = 0
  let segmentDistance = 0
  const consumptions: number[] = []
  const costPerKms: number[] = []
  const intervalsKm: number[] = []
  const intervalsDays: number[] = []

  const sorted = [...fills].sort(
    (a, b) => a.date.localeCompare(b.date) || a.kilometrage - b.kilometrage,
  )

  for (const fill of sorted) {
    const m = metrics.get(fill.id)
    if (!m) continue
    if (m.consumption != null && m.segmentLitres != null && m.distance != null) {
      consumptions.push(m.consumption)
      segmentLitres += m.segmentLitres
      segmentDistance += m.distance
    }
    if (m.costPerKm != null) costPerKms.push(m.costPerKm)
    if (m.kmSincePrev != null) intervalsKm.push(m.kmSincePrev)
    if (m.daysSincePrev != null) intervalsDays.push(m.daysSincePrev)
  }

  const avg = (xs: number[]) =>
    xs.length ? xs.reduce((s, n) => s + n, 0) / xs.length : 0

  return {
    count: fills.length,
    totalCost,
    totalLitres,
    avgPrice: totalLitres > 0 ? totalCost / totalLitres : avg(prices),
    minPrice: Math.min(...prices),
    maxPrice: Math.max(...prices),
    minCost: Math.min(...costs),
    maxCost: Math.max(...costs),
    minLitres: Math.min(...litres),
    maxLitres: Math.max(...litres),
    distance,
    avgConsumption:
      segmentDistance > 0 ? (segmentLitres / segmentDistance) * 100 : 0,
    minConsumption: consumptions.length ? Math.min(...consumptions) : 0,
    maxConsumption: consumptions.length ? Math.max(...consumptions) : 0,
    costPerKm: distance > 0 ? totalCost / distance : 0,
    minCostPerKm: costPerKms.length ? Math.min(...costPerKms) : 0,
    maxCostPerKm: costPerKms.length ? Math.max(...costPerKms) : 0,
    avgIntervalKm: avg(intervalsKm),
    avgIntervalDays: avg(intervalsDays),
    lastIntervalKm: intervalsKm.at(-1) ?? 0,
  }
}

/**
 * Résumé carburant sur un ensemble de pleins (typiquement un mois) : distance,
 * litres et consommation sont calculés sur exactement le même périmètre.
 */
export function summarizeFuel(fills: Refueling[], allFills: Refueling[]) {
  const metrics = fuelMetrics(allFills)
  let distance = 0
  let litres = 0
  let validLitres = 0
  let validDistance = 0

  for (const fill of fills) {
    litres += fill.litres
    const fillMetrics = metrics.get(fill.id)
    distance += fillMetrics?.kmSincePrev ?? 0
    if (
      fillMetrics?.consumption != null &&
      fillMetrics.segmentLitres != null &&
      fillMetrics.distance != null
    ) {
      validLitres += fillMetrics.segmentLitres
      validDistance += fillMetrics.distance
    }
  }

  return {
    distance: distance > 0 ? distance : null,
    litres,
    // La consommation ne s'appuie que sur les segments plausibles ; les
    // valeurs aberrantes (plein partiel mal saisi, relevé manquant) sont
    // exclues plutôt que de fausser le mois.
    consumption:
      validDistance > 0 ? (validLitres / validDistance) * 100 : null,
  }
}

export function stationBreakdown(fills: Refueling[]) {
  const map = new Map<string, { name: string; count: number; total: number; litres: number }>()
  for (const f of fills) {
    const name = f.station || "Non renseigné"
    const cur = map.get(name) ?? { name, count: 0, total: 0, litres: 0 }
    cur.count += 1
    cur.total += f.coutTotal
    cur.litres += f.litres
    map.set(name, cur)
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total)
  const grand = rows.reduce((s, r) => s + r.total, 0) || 1
  return rows.map((r) => ({
    ...r,
    share: (r.total / grand) * 100,
    avgPrice: r.litres > 0 ? r.total / r.litres : 0,
  }))
}

export function monthlyBuckets(
  fills: Refueling[],
  expenses: Expense[],
  maintenances: Maintenance[],
  revenues: Revenue[],
) {
  const monthKey = (iso: string) => iso.slice(0, 7)
  type Bucket = {
    key: string
    plein: number
    depense: number
    entretien: number
    revenu: number
    litres: number
  }
  const map = new Map<string, Bucket>()
  const bucket = (key: string) => {
    const cur = map.get(key) ?? {
      key,
      plein: 0,
      depense: 0,
      entretien: 0,
      revenu: 0,
      litres: 0,
    }
    map.set(key, cur)
    return cur
  }

  for (const f of fills) {
    const b = bucket(monthKey(f.date))
    b.plein += f.coutTotal
    b.litres += f.litres
  }
  for (const e of expenses) bucket(monthKey(e.date)).depense += e.montant
  for (const m of maintenances) bucket(monthKey(m.date)).entretien += m.coutTotal
  for (const r of revenues) bucket(monthKey(r.date)).revenu += r.montant

  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

export function periodDays(fromIso: string, toIso: string): number {
  const diff = dayDiff(fromIso, toIso)
  if (diff == null) return 1
  return Math.max(1, diff + 1)
}

export function lastOdometer(fills: Refueling[], fallback: number): number {
  if (fills.length === 0) return fallback
  return Math.max(...fills.map((f) => f.kilometrage), fallback)
}
