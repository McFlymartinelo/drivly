import Dexie, { type Table } from "dexie"
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

export class DrivlyDB extends Dexie {
  vehicles!: Table<Vehicle, string>
  refuelings!: Table<Refueling, string>
  reminders!: Table<Reminder, string>
  maintenances!: Table<Maintenance, string>
  expenses!: Table<Expense, string>
  revenues!: Table<Revenue, string>
  readings!: Table<OdometerReading, string>
  trips!: Table<Trip, string>
  checklists!: Table<Checklist, string>

  constructor() {
    super("drivly")
    this.version(1).stores({
      vehicles: "id, nom",
      refuelings: "id, vehicleId, date, kilometrage",
      reminders: "id, vehicleId, resolu, dateEcheance",
      maintenances: "id, vehicleId, date",
      expenses: "id, vehicleId, date",
      revenues: "id, vehicleId, date",
      readings: "id, vehicleId, date",
      trips: "id, vehicleId, date",
      checklists: "id, vehicleId, date",
    })
  }
}

export const db = new DrivlyDB()
