import { db } from "../db/db"

/** Remonte le compteur du véhicule si la nouvelle valeur est plus grande. */
export async function raiseOdometer(
  vehicleId: string,
  km: number | null | undefined,
): Promise<void> {
  if (km == null || !Number.isFinite(km)) return
  const vehicle = await db.vehicles.get(vehicleId)
  if (vehicle && km > vehicle.kmActuel) {
    await db.vehicles.update(vehicleId, { kmActuel: km })
  }
}

/**
 * Recalcule le compteur après une suppression : sans cela, supprimer le
 * dernier relevé laissait un kilométrage fantôme.
 */
export async function recomputeOdometer(vehicleId: string): Promise<void> {
  const [vehicle, fills, readings, trips, maintenances, expenses] = await Promise.all([
    db.vehicles.get(vehicleId),
    db.refuelings.where("vehicleId").equals(vehicleId).toArray(),
    db.readings.where("vehicleId").equals(vehicleId).toArray(),
    db.trips.where("vehicleId").equals(vehicleId).toArray(),
    db.maintenances.where("vehicleId").equals(vehicleId).toArray(),
    db.expenses.where("vehicleId").equals(vehicleId).toArray(),
  ])
  if (!vehicle) return

  const candidates = [
    vehicle.kmInitial,
    ...fills.map((item) => item.kilometrage),
    ...readings.map((item) => item.kilometrage),
    ...trips.map((item) => item.kmFin),
    ...maintenances.map((item) => item.kilometrage),
    ...expenses.map((item) => item.kilometrage ?? 0),
  ].filter((value) => Number.isFinite(value) && value > 0)

  const kmActuel = candidates.length ? Math.max(...candidates) : vehicle.kmInitial
  if (kmActuel !== vehicle.kmActuel) {
    await db.vehicles.update(vehicleId, { kmActuel })
  }
}
