import type { Refueling, Reminder, Vehicle } from "../types"
import { db } from "./db"

const VEHICLE_ID = "veh-citroen-c4"
const PLATE = "CJ-653-HM"

function money(litres: number, prix: number): number {
  return Math.round(litres * prix * 100) / 100
}

const fills: Array<{
  date: string
  km: number
  litres: number
  prix: number
  station: string
}> = [
  { date: "2026-02-05T08:30:00", km: 182162, litres: 48.2, prix: 1.87, station: "Leclerc Saint-Aunès" },
  { date: "2026-02-22T18:15:00", km: 183050, litres: 45.1, prix: 1.89, station: "Total Access Trappes" },
  { date: "2026-03-10T12:40:00", km: 183980, litres: 49.8, prix: 1.84, station: "Auchan Vélizy" },
  { date: "2026-03-28T09:20:00", km: 184900, litres: 47.2, prix: 1.94, station: "BP Plaisir" },
  { date: "2026-04-14T17:05:00", km: 185820, litres: 50.7, prix: 1.88, station: "Esso Express" },
  { date: "2026-05-02T11:10:00", km: 186750, litres: 46.9, prix: 1.96, station: "Total Energies" },
  { date: "2026-05-19T16:45:00", km: 187640, litres: 44.3, prix: 1.84, station: "Leclerc Saint-Aunès" },
  { date: "2026-06-06T08:55:00", km: 188550, litres: 48.7, prix: 1.93, station: "Total Access Trappes" },
  { date: "2026-06-24T19:30:00", km: 189480, litres: 51.2, prix: 2.01, station: "Auchan Vélizy" },
  { date: "2026-07-12T10:25:00", km: 190350, litres: 42.8, prix: 1.98, station: "BP Plaisir" },
  { date: "2026-07-30T14:50:00", km: 191220, litres: 41.14, prix: 2.05, station: "Esso Express" },
  { date: "2026-08-20T12:13:00", km: 192065, litres: 56.53, prix: 1.99, station: "Total Access Trappes" },
]

export async function seedIfEmpty(): Promise<void> {
  const existing = await db.vehicles.get(VEHICLE_ID)
  if (existing && existing.immatriculation !== PLATE) {
    await db.vehicles.update(VEHICLE_ID, { immatriculation: PLATE })
  }

  const count = await db.vehicles.count()
  if (count > 0) return

  const now = new Date().toISOString()

  const vehicle: Vehicle = {
    id: VEHICLE_ID,
    nom: "Citroën C4",
    marque: "Citroën",
    modele: "C4",
    immatriculation: PLATE,
    kmInitial: 182162,
    kmActuel: 192065,
    carburantDefaut: "Diesel",
    capaciteReservoir: 60,
    createdAt: "2026-02-01T10:00:00.000Z",
  }

  const refuelings: Refueling[] = fills.map((f, i) => ({
    id: `refuel-${String(i + 1).padStart(2, "0")}`,
    vehicleId: VEHICLE_ID,
    date: new Date(f.date).toISOString(),
    kilometrage: f.km,
    litres: f.litres,
    prixAuLitre: f.prix,
    coutTotal: f.km === 192065 ? 112.49 : money(f.litres, f.prix),
    carburant: "Diesel",
    pleinComplet: true,
    station: f.station,
    notes: "",
    conducteur: "",
    modePaiement: "",
    createdAt: now,
  }))

  const reminder: Reminder = {
    id: "rem-next-fuel",
    vehicleId: VEHICLE_ID,
    titre: "Plein suivant",
    type: "plein",
    kmEcheance: 193134,
    dateEcheance: "2026-09-10T08:00:00.000Z",
    resolu: false,
    notes: "Estimation basée sur l'autonomie moyenne",
    createdAt: now,
  }

  await db.transaction("rw", db.vehicles, db.refuelings, db.reminders, async () => {
    await db.vehicles.add(vehicle)
    await db.refuelings.bulkAdd(refuelings)
    await db.reminders.add(reminder)
  })
}

export { VEHICLE_ID }
