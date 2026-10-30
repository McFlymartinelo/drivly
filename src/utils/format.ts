import { differenceInCalendarDays, format, parseISO } from "date-fns"
import { fr } from "date-fns/locale"

const frNumber = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const frInt = new Intl.NumberFormat("fr-FR", {
  maximumFractionDigits: 0,
})

const frOne = new Intl.NumberFormat("fr-FR", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

export function formatMoney(n: number, digits = 2): string {
  const fmt = digits === 2 ? frNumber : new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${fmt.format(n)} €`
}

export function formatNumber(n: number, digits = 2): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function formatKm(n: number): string {
  return `${Math.round(n)} km`
}

export function formatKmGrouped(n: number): string {
  return `${frInt.format(Math.round(n))} km`
}

export function formatLitres(n: number): string {
  return `${frNumber.format(n)} L`
}

export function formatPricePerLitre(n: number): string {
  return `${frNumber.format(n)} €/L`
}

export function formatConsumption(n: number): string {
  return `${frNumber.format(n)} L/100km`
}

export function formatIsoDate(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy")
}

export function formatIsoTime(iso: string): string {
  return format(parseISO(iso), "HH:mm")
}

export function formatIsoDateTime(iso: string): string {
  return format(parseISO(iso), "dd/MM/yyyy - HH:mm")
}

export function formatDayMonth(iso: string): string {
  return format(parseISO(iso), "d MMM", { locale: fr }).replace(".", "")
}

export function formatMonthYear(iso: string): string {
  return format(parseISO(iso), "LLLL yyyy", { locale: fr }).toUpperCase()
}

export function formatMonthName(iso: string): string {
  return format(parseISO(iso), "LLLL", { locale: fr })
}

export function formatDecimal(n: number, maxDigits = 3): string {
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDigits }).format(n)
}

export function formatShortMonth(iso: string): string {
  return format(parseISO(iso), "MMM", { locale: fr }).replace(".", "")
}

export function daysUntil(iso: string, from = new Date()): number {
  return differenceInCalendarDays(parseISO(iso), from)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function parseDecimal(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, "").replace(",", ".")
  if (!cleaned) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

export function formatOne(n: number): string {
  return frOne.format(n)
}
