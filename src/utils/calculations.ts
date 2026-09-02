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

export function computeRefuelingStats(
  fill: Refueling,
  fills: Refueling[],
  vehicle?: Vehicle,
): RefuelingStats {
  const prev = previousFullTank(fills, fill)
  const distance =
    prev && fill.kilometrage > prev.kilometrage
      ? fill.kilometrage - prev.kilometrage
      : null

  const consommation =
    distance && distance > 0 ? (fill.litres / distance) * 100 : null

  const coutParKm =
    distance && distance > 0 ? fill.coutTotal / distance : null

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
  const joursRestants = reminder.dateEcheance
    ? differenceInCalendarDays(parseISO(reminder.dateEcheance), from)
    : null
  return { kmRestants, joursRestants }
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

  const totalCost = fills.reduce((s, f) => s + f.coutTotal, 0)
  const totalLitres = fills.reduce((s, f) => s + f.litres, 0)
  const prices = fills.map((f) => f.prixAuLitre)
  const costs = fills.map((f) => f.coutTotal)
  const litres = fills.map((f) => f.litres)

  const sorted = [...fills].sort((a, b) => a.date.localeCompare(b.date))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const distance = Math.max(0, last.kilometrage - first.kilometrage)

  const consumptions: number[] = []
  const costPerKms: number[] = []
  const intervalsKm: number[] = []
  const intervalsDays: number[] = []

  for (const fill of sorted) {
    const stats = computeRefuelingStats(fill, allFills)
    if (stats.consommation != null) consumptions.push(stats.consommation)
    if (stats.coutParKm != null) costPerKms.push(stats.coutParKm)
    if (stats.distance != null) intervalsKm.push(stats.distance)
    const prev = previousFullTank(allFills, fill)
    if (prev) {
      intervalsDays.push(
        differenceInCalendarDays(parseISO(fill.date), parseISO(prev.date)),
      )
    }
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
    avgConsumption: avg(consumptions),
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
  const keys = new Set<string>()
  const monthKey = (iso: string) => iso.slice(0, 7)

  for (const x of fills) keys.add(monthKey(x.date))
  for (const x of expenses) keys.add(monthKey(x.date))
  for (const x of maintenances) keys.add(monthKey(x.date))
  for (const x of revenues) keys.add(monthKey(x.date))

  return [...keys].sort().map((key) => ({
    key,
    plein: fills.filter((f) => monthKey(f.date) === key).reduce((s, f) => s + f.coutTotal, 0),
    depense: expenses.filter((f) => monthKey(f.date) === key).reduce((s, f) => s + f.montant, 0),
    entretien: maintenances.filter((f) => monthKey(f.date) === key).reduce((s, f) => s + f.coutTotal, 0),
    revenu: revenues.filter((f) => monthKey(f.date) === key).reduce((s, f) => s + f.montant, 0),
    litres: fills.filter((f) => monthKey(f.date) === key).reduce((s, f) => s + f.litres, 0),
  }))
}

export function periodDays(fromIso: string, toIso: string): number {
  return Math.max(1, differenceInCalendarDays(parseISO(toIso), parseISO(fromIso)) + 1)
}

export function lastOdometer(fills: Refueling[], fallback: number): number {
  if (fills.length === 0) return fallback
  return Math.max(...fills.map((f) => f.kilometrage), fallback)
}
