export const FUEL_TYPES = [
  "Diesel",
  "Essence",
  "SP95",
  "SP98",
  "E85",
  "GPL",
  "Électrique",
] as const

export type FuelType = (typeof FUEL_TYPES)[number]

export const REMINDER_TYPES = [
  "plein",
  "entretien",
  "assurance",
  "controle-technique",
  "pneus",
  "custom",
] as const

export type ReminderType = (typeof REMINDER_TYPES)[number]

export const INTERVENTION_TYPES = ["DIY", "Garage"] as const
export type InterventionType = (typeof INTERVENTION_TYPES)[number]

export const EXPENSE_CATEGORIES = [
  "Péage",
  "Parking",
  "Lavage",
  "Assurance",
  "Amende",
  "Accessoire",
  "Autre",
] as const
export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number]

export const REVENUE_CATEGORIES = [
  "Remboursement",
  "Covoiturage",
  "Location",
  "Vente",
  "Autre",
] as const
export type RevenueCategory = (typeof REVENUE_CATEGORIES)[number]

export const PAYMENT_MODES = [
  "Carte bancaire",
  "Espèces",
  "Chèque",
  "App",
] as const
export type PaymentMode = (typeof PAYMENT_MODES)[number]

export interface Vehicle {
  id: string
  nom: string
  marque: string
  modele: string
  immatriculation: string
  kmInitial: number
  kmActuel: number
  photo?: string
  carburantDefaut: FuelType
  capaciteReservoir: number
  createdAt: string
}

export interface Refueling {
  id: string
  vehicleId: string
  date: string
  kilometrage: number
  litres: number
  prixAuLitre: number
  coutTotal: number
  carburant: FuelType
  pleinComplet: boolean
  station: string
  stationLatitude?: number
  stationLongitude?: number
  notes: string
  conducteur: string
  modePaiement: string
  createdAt: string
}

export interface Reminder {
  id: string
  vehicleId: string
  titre: string
  type: ReminderType
  kmEcheance?: number
  dateEcheance?: string
  resolu: boolean
  notes?: string
  createdAt: string
}

export interface Maintenance {
  id: string
  vehicleId: string
  date: string
  kilometrage: number
  typeIntervention: InterventionType
  typeEntretien: string
  coutTotal: number
  referencesPieces: string
  notes: string
  createdAt: string
}

export interface Expense {
  id: string
  vehicleId: string
  date: string
  kilometrage?: number
  categorie: ExpenseCategory
  montant: number
  notes: string
  createdAt: string
}

export interface Revenue {
  id: string
  vehicleId: string
  date: string
  kilometrage?: number
  categorie: RevenueCategory
  montant: number
  notes: string
  createdAt: string
}

export interface OdometerReading {
  id: string
  vehicleId: string
  date: string
  kilometrage: number
  notes: string
  createdAt: string
}

export interface Trip {
  id: string
  vehicleId: string
  date: string
  kmDebut: number
  kmFin: number
  destination: string
  notes: string
  createdAt: string
}

export interface ChecklistItem {
  id: string
  label: string
  done: boolean
}

export interface Checklist {
  id: string
  vehicleId: string
  titre: string
  items: ChecklistItem[]
  date: string
  createdAt: string
}

export interface RefuelingStats {
  distance: number | null
  consommation: number | null
  coutParKm: number | null
  pourcentageReservoir: number | null
}

export interface ReminderStats {
  kmRestants: number | null
  joursRestants: number | null
}

export type TimelineKind =
  | "refueling"
  | "expense"
  | "revenue"
  | "maintenance"
  | "reading"
  | "trip"
  | "checklist"
  | "reminder"
  | "anniversary"

export interface TimelineEvent {
  id: string
  kind: TimelineKind
  date: string
  kilometrage?: number
  title: string
  amount?: number
  subtitle: string
  /** Nombre d'années complétées (événement anniversaire). */
  count?: number
  /** Mois de rattachement dans l'historique (par défaut le mois de la date). */
  groupKey?: string
}
