import { addMonths, parseISO } from "date-fns"
import type { Maintenance, Reminder, Vehicle } from "../types"

interface MaintenanceRule {
  pattern: RegExp
  label: string
  km?: number
  months?: number
}

/**
 * Intervalles d'entretien courants (essence/diesel, usage mixte). Volontairement
 * prudents : la suggestion reste une proposition, jamais une obligation.
 */
export const MAINTENANCE_RULES: MaintenanceRule[] = [
  { pattern: /huile|vidange/i, label: "Vidange + filtre à huile", km: 15_000, months: 12 },
  { pattern: /courroie|distribution/i, label: "Courroie de distribution", km: 60_000, months: 60 },
  { pattern: /frein|plaquette|disque/i, label: "Contrôle des freins", km: 30_000, months: 24 },
  { pattern: /pneu|jante/i, label: "Contrôle des pneus", km: 20_000, months: 24 },
  { pattern: /filtre(?!.*huile)|habitacle|air/i, label: "Filtres air / habitacle", km: 20_000, months: 24 },
  { pattern: /batterie/i, label: "Contrôle de la batterie", km: 60_000, months: 60 },
  { pattern: /clim|climatisation/i, label: "Recharge climatisation", km: 30_000, months: 24 },
  { pattern: /contrôle technique|controle technique/i, label: "Contrôle technique", months: 24 },
  { pattern: /assurance/i, label: "Renouvellement d'assurance", months: 12 },
]

export interface ReminderSuggestion {
  id: string
  titre: string
  kmEcheance?: number
  dateEcheance?: string
  reason: string
  sourceId: string
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
}

/**
 * Déduit les prochains entretiens à partir du dernier passage du même type.
 * Évite de ressaisir à la main « vidange dans 15 000 km » après chaque facture.
 */
export function maintenanceSuggestions(
  maintenances: Maintenance[],
  reminders: Reminder[],
  vehicle: Vehicle | undefined,
): ReminderSuggestion[] {
  if (!vehicle) return []

  const openTitles = new Set(
    reminders
      .filter((reminder) => !reminder.resolu)
      .map((reminder) => normalize(reminder.titre)),
  )

  const suggestions: ReminderSuggestion[] = []

  for (const rule of MAINTENANCE_RULES) {
    const latest = maintenances
      .filter((item) => rule.pattern.test(item.typeEntretien))
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    if (!latest) continue

    const alreadyPlanned = [...openTitles].some(
      (titre) =>
        titre.includes(normalize(rule.label)) ||
        normalize(rule.label).includes(titre),
    )
    if (alreadyPlanned) continue

    const start = parseISO(latest.date)
    if (Number.isNaN(start.getTime())) continue

    const dateEcheance = rule.months
      ? addMonths(start, rule.months).toISOString()
      : undefined
    const kmEcheance =
      rule.km != null && latest.kilometrage > 0
        ? latest.kilometrage + rule.km
        : undefined

    if (!dateEcheance && kmEcheance == null) continue

    suggestions.push({
      id: `sug-${latest.id}-${rule.label}`,
      titre: rule.label,
      kmEcheance,
      dateEcheance,
      sourceId: latest.id,
      reason: `Dernier passage le ${new Date(latest.date).toLocaleDateString("fr-FR")}${
        latest.kilometrage > 0
          ? ` à ${latest.kilometrage.toLocaleString("fr-FR")} km`
          : ""
      }`,
    })
  }

  return suggestions.sort((a, b) => {
    const aKm = a.kmEcheance != null ? a.kmEcheance - vehicle.kmActuel : Infinity
    const bKm = b.kmEcheance != null ? b.kmEcheance - vehicle.kmActuel : Infinity
    if (aKm !== bKm) return aKm - bKm
    return (a.dateEcheance ?? "").localeCompare(b.dateEcheance ?? "")
  })
}
