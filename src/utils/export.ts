import { parseISO } from "date-fns"
import { db } from "../db/db"
import type {
  Checklist,
  Expense,
  Maintenance,
  OdometerReading,
  Refueling,
  Reminder,
  Revenue,
  Trip,
  Vehicle,
} from "../types"

export const EXPORT_VERSION = 2

export interface ExportPayload {
  version: number
  exportedAt: string
  vehicles: Vehicle[]
  refuelings: Refueling[]
  reminders: Reminder[]
  maintenances: Maintenance[]
  expenses: Expense[]
  revenues: Revenue[]
  readings: OdometerReading[]
  trips: Trip[]
  checklists: Checklist[]
}

export interface ImportSummary {
  vehicles: number
  refuelings: number
  reminders: number
  maintenances: number
  expenses: number
  revenues: number
  readings: number
  trips: number
  checklists: number
  entries: number
}

export type ValidationResult =
  | { ok: true; payload: ExportPayload; summary: ImportSummary }
  | { ok: false; errors: string[] }

export async function exportAll(): Promise<ExportPayload> {
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    vehicles: await db.vehicles.toArray(),
    refuelings: await db.refuelings.toArray(),
    reminders: await db.reminders.toArray(),
    maintenances: await db.maintenances.toArray(),
    expenses: await db.expenses.toArray(),
    revenues: await db.revenues.toArray(),
    readings: await db.readings.toArray(),
    trips: await db.trips.toArray(),
    checklists: await db.checklists.toArray(),
  }
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.rel = "noopener"
  document.body.appendChild(link)
  link.click()
  link.remove()
  // Safari a besoin d'un tick avant de révoquer l'URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadJson(data: unknown, filename: string) {
  downloadBlob(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    filename,
  )
}

/** Partage natif du fichier si le navigateur le supporte, sinon téléchargement. */
export async function shareOrDownloadJson(
  data: unknown,
  filename: string,
): Promise<"shared" | "downloaded" | "cancelled"> {
  const text = JSON.stringify(data, null, 2)
  const file = new File([text], filename, { type: "application/json" })
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean
  }
  if (typeof nav.share === "function" && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: "Drivly", text: "Sauvegarde Drivly" })
      return "shared"
    } catch {
      return "cancelled"
    }
  }
  downloadJson(data, filename)
  return "downloaded"
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null

const text = (value: unknown): string => (typeof value === "string" ? value : "")
const number = (value: unknown): number =>
  typeof value === "number" && Number.isFinite(value) ? value : 0
const boolean = (value: unknown): boolean => value === true
const validDate = (value: unknown): boolean =>
  typeof value === "string" && !Number.isNaN(parseISO(value).getTime())
const idOf = (value: unknown): string => text(value)

function expectArray(
  source: Record<string, unknown>,
  key: string,
  errors: string[],
): unknown[] {
  const value = source[key]
  if (value == null) return []
  if (!Array.isArray(value)) {
    errors.push(`« ${key} » doit être une liste.`)
    return []
  }
  return value
}

/**
 * Valide et normalise un fichier d'import. Un fichier douteux est refusé
 * avant toute écriture : c'est ce qui protège le carnet en cas de mauvais
 * fichier sélectionné.
 */
export function validateExportPayload(raw: unknown): ValidationResult {
  if (!isObject(raw)) return { ok: false, errors: ["Le fichier n'est pas un objet JSON."] }
  if (raw.version !== 1 && raw.version !== 2) {
    return {
      ok: false,
      errors: [`Version de sauvegarde inconnue (${String(raw.version ?? "absente")}).`],
    }
  }
  const errors: string[] = []

  const vehicleIds = new Set<string>()
  const vehicles: Vehicle[] = []
  for (const [index, item] of expectArray(raw, "vehicles", errors).entries()) {
    if (!isObject(item) || !idOf(item.id) || !text(item.nom)) {
      errors.push(`Véhicule #${index + 1} : identifiant ou nom manquant.`)
      continue
    }
    vehicleIds.add(idOf(item.id))
    vehicles.push({
      id: idOf(item.id),
      nom: text(item.nom),
      marque: text(item.marque),
      modele: text(item.modele),
      immatriculation: text(item.immatriculation),
      kmInitial: number(item.kmInitial),
      kmActuel: number(item.kmActuel),
      photo: typeof item.photo === "string" ? item.photo : undefined,
      carburantDefaut: (text(item.carburantDefaut) || "Diesel") as Vehicle["carburantDefaut"],
      capaciteReservoir: number(item.capaciteReservoir) || 50,
      createdAt: validDate(item.createdAt)
        ? text(item.createdAt)
        : new Date().toISOString(),
    })
  }

  const base = (item: Record<string, unknown>, label: string, index: number) => {
    if (!idOf(item.id) || !idOf(item.vehicleId) || !validDate(item.date)) {
      errors.push(`${label} #${index + 1} : identifiant, véhicule ou date invalide.`)
      return false
    }
    if (vehicles.length > 0 && !vehicleIds.has(idOf(item.vehicleId))) {
      errors.push(`${label} #${index + 1} : véhicule inconnu.`)
      return false
    }
    return true
  }

  const refuelings: Refueling[] = []
  for (const [index, item] of expectArray(raw, "refuelings", errors).entries()) {
    if (!isObject(item) || !base(item, "Plein", index)) continue
    refuelings.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      date: text(item.date),
      kilometrage: number(item.kilometrage),
      litres: number(item.litres),
      prixAuLitre: number(item.prixAuLitre),
      coutTotal: number(item.coutTotal),
      carburant: (text(item.carburant) || "Diesel") as Refueling["carburant"],
      pleinComplet: boolean(item.pleinComplet),
      station: text(item.station),
      notes: text(item.notes),
      conducteur: text(item.conducteur),
      modePaiement: text(item.modePaiement),
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  const reminders: Reminder[] = []
  for (const [index, item] of expectArray(raw, "reminders", errors).entries()) {
    if (!isObject(item) || !idOf(item.id) || !idOf(item.vehicleId) || !text(item.titre)) {
      errors.push(`Rappel #${index + 1} : identifiant, véhicule ou titre manquant.`)
      continue
    }
    if (vehicles.length > 0 && !vehicleIds.has(idOf(item.vehicleId))) {
      errors.push(`Rappel #${index + 1} : véhicule inconnu.`)
      continue
    }
    reminders.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      titre: text(item.titre),
      type: (text(item.type) || "custom") as Reminder["type"],
      kmEcheance:
        typeof item.kmEcheance === "number" && Number.isFinite(item.kmEcheance)
          ? item.kmEcheance
          : undefined,
      dateEcheance: validDate(item.dateEcheance)
        ? text(item.dateEcheance)
        : undefined,
      resolu: boolean(item.resolu),
      notes: text(item.notes),
      createdAt: validDate(item.createdAt)
        ? text(item.createdAt)
        : new Date().toISOString(),
    })
  }

  const maintenances: Maintenance[] = []
  for (const [index, item] of expectArray(raw, "maintenances", errors).entries()) {
    if (!isObject(item) || !base(item, "Entretien", index)) continue
    maintenances.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      date: text(item.date),
      kilometrage: number(item.kilometrage),
      typeIntervention: (text(item.typeIntervention) || "Garage") as Maintenance["typeIntervention"],
      typeEntretien: text(item.typeEntretien),
      coutTotal: number(item.coutTotal),
      referencesPieces: text(item.referencesPieces),
      notes: text(item.notes),
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  const expenses: Expense[] = []
  for (const [index, item] of expectArray(raw, "expenses", errors).entries()) {
    if (!isObject(item) || !base(item, "Dépense", index)) continue
    expenses.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      date: text(item.date),
      kilometrage:
        typeof item.kilometrage === "number" && Number.isFinite(item.kilometrage)
          ? item.kilometrage
          : undefined,
      categorie: (text(item.categorie) || "Autre") as Expense["categorie"],
      montant: number(item.montant),
      notes: text(item.notes),
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  const revenues: Revenue[] = []
  for (const [index, item] of expectArray(raw, "revenues", errors).entries()) {
    if (!isObject(item) || !base(item, "Revenu", index)) continue
    revenues.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      date: text(item.date),
      kilometrage:
        typeof item.kilometrage === "number" && Number.isFinite(item.kilometrage)
          ? item.kilometrage
          : undefined,
      categorie: (text(item.categorie) || "Autre") as Revenue["categorie"],
      montant: number(item.montant),
      notes: text(item.notes),
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  const readings: OdometerReading[] = []
  for (const [index, item] of expectArray(raw, "readings", errors).entries()) {
    if (!isObject(item) || !base(item, "Relevé", index)) continue
    readings.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      date: text(item.date),
      kilometrage: number(item.kilometrage),
      notes: text(item.notes),
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  const trips: Trip[] = []
  for (const [index, item] of expectArray(raw, "trips", errors).entries()) {
    if (!isObject(item) || !base(item, "Itinéraire", index)) continue
    trips.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      date: text(item.date),
      kmDebut: number(item.kmDebut),
      kmFin: number(item.kmFin),
      destination: text(item.destination),
      notes: text(item.notes),
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  const checklists: Checklist[] = []
  for (const [index, item] of expectArray(raw, "checklists", errors).entries()) {
    if (!isObject(item) || !base(item, "Liste", index)) continue
    checklists.push({
      id: idOf(item.id),
      vehicleId: idOf(item.vehicleId),
      titre: text(item.titre) || "Liste de contrôle",
      date: text(item.date),
      items: Array.isArray(item.items)
        ? item.items.filter(isObject).map((entry) => ({
            id: idOf(entry.id) || idOf(item.id),
            label: text(entry.label),
            done: boolean(entry.done),
          }))
        : [],
      createdAt: validDate(item.createdAt) ? text(item.createdAt) : text(item.date),
    })
  }

  if (errors.length > 0) return { ok: false, errors: errors.slice(0, 6) }

  return {
    ok: true,
    payload: {
      version: EXPORT_VERSION,
      exportedAt: validDate(raw.exportedAt) ? text(raw.exportedAt) : new Date().toISOString(),
      vehicles,
      refuelings,
      reminders,
      maintenances,
      expenses,
      revenues,
      readings,
      trips,
      checklists,
    },
    summary: {
      vehicles: vehicles.length,
      refuelings: refuelings.length,
      reminders: reminders.length,
      maintenances: maintenances.length,
      expenses: expenses.length,
      revenues: revenues.length,
      readings: readings.length,
      trips: trips.length,
      checklists: checklists.length,
      entries:
        refuelings.length +
        reminders.length +
        maintenances.length +
        expenses.length +
        revenues.length +
        readings.length +
        trips.length +
        checklists.length,
    },
  }
}

export async function importAll(payload: ExportPayload): Promise<void> {
  await db.transaction("rw", db.tables, async () => {
    for (const table of db.tables) {
      await table.clear()
    }
    if (payload.vehicles.length) await db.vehicles.bulkAdd(payload.vehicles)
    if (payload.refuelings.length) await db.refuelings.bulkAdd(payload.refuelings)
    if (payload.reminders.length) await db.reminders.bulkAdd(payload.reminders)
    if (payload.maintenances.length) await db.maintenances.bulkAdd(payload.maintenances)
    if (payload.expenses.length) await db.expenses.bulkAdd(payload.expenses)
    if (payload.revenues.length) await db.revenues.bulkAdd(payload.revenues)
    if (payload.readings.length) await db.readings.bulkAdd(payload.readings)
    if (payload.trips.length) await db.trips.bulkAdd(payload.trips)
    if (payload.checklists.length) await db.checklists.bulkAdd(payload.checklists)
  })
}

const CSV_SEPARATOR = ";"

function csvCell(value: string | number): string {
  const raw = typeof value === "number" ? String(value).replace(".", ",") : value
  if (raw.includes(CSV_SEPARATOR) || raw.includes('"') || raw.includes("\n")) {
    return `"${raw.replace(/"/g, '""')}"`
  }
  return raw
}

export function downloadCsv(
  filename: string,
  header: string[],
  rows: Array<Array<string | number>>,
) {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(CSV_SEPARATOR))
  // BOM pour qu'Excel FR détecte l'UTF-8.
  downloadBlob(
    new Blob([`\ufeff${lines.join("\r\n")}`], {
      type: "text/csv;charset=utf-8",
    }),
    filename,
  )
}
