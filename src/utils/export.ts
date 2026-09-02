import { db } from "../db/db"

export interface ExportPayload {
  version: 1
  exportedAt: string
  vehicles: unknown[]
  refuelings: unknown[]
  reminders: unknown[]
  maintenances: unknown[]
  expenses: unknown[]
  revenues: unknown[]
  readings: unknown[]
  trips: unknown[]
  checklists: unknown[]
}

export async function exportAll(): Promise<ExportPayload> {
  return {
    version: 1,
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

export function downloadJson(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function importAll(payload: ExportPayload): Promise<void> {
  await db.transaction(
    "rw",
    db.tables,
    async () => {
      await Promise.all(db.tables.map((t) => t.clear()))
      if (payload.vehicles?.length) await db.vehicles.bulkAdd(payload.vehicles as never)
      if (payload.refuelings?.length) await db.refuelings.bulkAdd(payload.refuelings as never)
      if (payload.reminders?.length) await db.reminders.bulkAdd(payload.reminders as never)
      if (payload.maintenances?.length) await db.maintenances.bulkAdd(payload.maintenances as never)
      if (payload.expenses?.length) await db.expenses.bulkAdd(payload.expenses as never)
      if (payload.revenues?.length) await db.revenues.bulkAdd(payload.revenues as never)
      if (payload.readings?.length) await db.readings.bulkAdd(payload.readings as never)
      if (payload.trips?.length) await db.trips.bulkAdd(payload.trips as never)
      if (payload.checklists?.length) await db.checklists.bulkAdd(payload.checklists as never)
    },
  )
}
