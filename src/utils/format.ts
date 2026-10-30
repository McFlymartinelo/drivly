import { differenceInCalendarDays, format, parseISO, type Locale } from "date-fns"
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

/**
 * Une date invalide (import JSON douteux, saisie manuelle) ne doit jamais
 * faire planter un écran : on rend un tiret à la place.
 */
function safeParse(iso: string): Date | null {
  if (!iso) return null
  const date = parseISO(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

function safeFormat(iso: string, pattern: string, options?: { locale?: Locale }): string {
  const date = safeParse(iso)
  if (!date) return "—"
  try {
    return format(date, pattern, options)
  } catch {
    return "—"
  }
}

export function formatMoney(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—"
  const fmt = digits === 2 ? frNumber : new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${fmt.format(n)} €`
}

export function formatNumber(n: number, digits = 2): string {
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n)
}

export function formatKm(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return `${Math.round(n)} km`
}

export function formatKmGrouped(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return `${frInt.format(Math.round(n))} km`
}

export function formatLitres(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return `${frNumber.format(n)} L`
}

export function formatPricePerLitre(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return `${frNumber.format(n)} €/L`
}

export function formatConsumption(n: number): string {
  if (!Number.isFinite(n)) return "—"
  return `${frNumber.format(n)} L/100km`
}

export function formatIsoDate(iso: string): string {
  return safeFormat(iso, "dd/MM/yyyy")
}

export function formatIsoTime(iso: string): string {
  return safeFormat(iso, "HH:mm")
}

export function formatIsoDateTime(iso: string): string {
  return safeFormat(iso, "dd/MM/yyyy - HH:mm")
}

export function formatDayMonth(iso: string): string {
  return safeFormat(iso, "d MMM", { locale: fr }).replace(".", "")
}

export function formatMonthYear(iso: string): string {
  return safeFormat(iso, "LLLL yyyy", { locale: fr }).toUpperCase()
}

export function formatMonthName(iso: string): string {
  return safeFormat(iso, "LLLL", { locale: fr })
}

export function formatDecimal(n: number, maxDigits = 3): string {
  if (!Number.isFinite(n)) return "—"
  return new Intl.NumberFormat("fr-FR", { maximumFractionDigits: maxDigits }).format(n)
}

export function formatShortMonth(iso: string): string {
  return safeFormat(iso, "MMM", { locale: fr }).replace(".", "")
}

/** Valeur d'un `<input type="date">` (yyyy-MM-dd) à partir d'une date ISO. */
export function toDateInputValue(iso: string | undefined): string {
  const date = iso ? safeParse(iso) : null
  if (!date) return new Date().toISOString().slice(0, 10)
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

/** Valeur d'un `<input type="time">` (HH:mm) à partir d'une date ISO. */
export function toTimeInputValue(iso: string | undefined): string {
  const date = iso ? safeParse(iso) : null
  if (!date) return new Date().toTimeString().slice(0, 5)
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

export function daysUntil(iso: string, from = new Date()): number {
  const date = safeParse(iso)
  if (!date) return 0
  return differenceInCalendarDays(date, from)
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
  if (!Number.isFinite(n)) return "—"
  return frOne.format(n)
}
