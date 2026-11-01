import { describe, expect, it } from "vitest"
import type { Refueling, Reminder, Vehicle } from "../types"
import {
  computeNotificationSchedule,
  type NotificationPrefs,
} from "./notifications"

const NOW = new Date("2026-03-03T09:00:00.000Z")

const vehicle: Vehicle = {
  id: "v1",
  nom: "Citroën C4",
  marque: "Citroën",
  modele: "C4",
  immatriculation: "CJ-653-HM",
  kmInitial: 1000,
  kmActuel: 2200,
  carburantDefaut: "Diesel",
  capaciteReservoir: 50,
  createdAt: "2026-01-01T00:00:00.000Z",
}

function fill(
  id: string,
  date: string,
  kilometrage: number,
  litres = 40,
): Refueling {
  return {
    id,
    vehicleId: "v1",
    date,
    kilometrage,
    litres,
    prixAuLitre: 1.8,
    coutTotal: litres * 1.8,
    carburant: "Diesel",
    pleinComplet: true,
    station: "",
    notes: "",
    conducteur: "",
    modePaiement: "",
    createdAt: date,
  }
}

const fills = [
  fill("f1", "2026-01-01T10:00:00.000Z", 1000),
  fill("f2", "2026-01-31T10:00:00.000Z", 1600),
  fill("f3", "2026-03-02T10:00:00.000Z", 2200),
]

const prefs: NotificationPrefs = {
  enabled: true,
  style: "auto",
  reminders: true,
  fuel: true,
}

function reminder(patch: Partial<Reminder>): Reminder {
  return {
    id: "r1",
    vehicleId: "v1",
    titre: "Contrôle technique",
    type: "controle-technique",
    resolu: false,
    createdAt: "2026-01-01T00:00:00.000Z",
    ...patch,
  }
}

describe("computeNotificationSchedule", () => {
  it("prévoit le prochain plein et notifie 3 jours avant", () => {
    const items = computeNotificationSchedule({
      vehicles: [vehicle],
      refuelings: fills,
      reminders: [],
      prefs,
      now: NOW,
    })

    const fuel = items.find((item) => item.key.startsWith("fuel:"))
    expect(fuel).toBeDefined()
    expect(fuel?.title).toBe("Plein à prévoir")
    expect(fuel?.body).toContain("Citroën C4")

    const at = new Date(fuel!.at)
    // Dernier plein le 2 mars, intervalle ~30 jours, notification 3 jours avant.
    expect(at.getTime()).toBeGreaterThan(NOW.getTime())
    expect(at.getTime()).toBeLessThan(
      new Date("2026-04-02T00:00:00.000Z").getTime(),
    )
  })

  it("notifie 7 jours avant une échéance datée", () => {
    const items = computeNotificationSchedule({
      vehicles: [vehicle],
      refuelings: [],
      reminders: [reminder({ dateEcheance: "2026-03-13" })],
      prefs,
      now: NOW,
    })

    const item = items.find((entry) => entry.key.startsWith("reminder:"))
    expect(item?.body).toBe("Dans 10 jours · Citroën C4")
    const at = new Date(item!.at)
    const localDate = `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, "0")}-${String(at.getDate()).padStart(2, "0")}`
    expect(localDate).toBe("2026-03-06")
  })

  it("notifie tout de suite si l'échéance est proche", () => {
    const items = computeNotificationSchedule({
      vehicles: [vehicle],
      refuelings: [],
      reminders: [reminder({ dateEcheance: "2026-03-04" })],
      prefs,
      now: NOW,
    })

    const item = items.find((entry) => entry.key.startsWith("reminder:"))
    const delay = new Date(item!.at).getTime() - NOW.getTime()
    expect(delay).toBeGreaterThanOrEqual(0)
    expect(delay).toBeLessThanOrEqual(6 * 60_000)
  })

  it("respecte les canaux désactivés", () => {
    const items = computeNotificationSchedule({
      vehicles: [vehicle],
      refuelings: fills,
      reminders: [reminder({ dateEcheance: "2026-03-13" })],
      prefs: { ...prefs, fuel: false, reminders: false },
      now: NOW,
    })
    expect(items).toHaveLength(0)
  })

  it("ne prévoit rien sans historique de pleins", () => {
    const items = computeNotificationSchedule({
      vehicles: [vehicle],
      refuelings: [fills[0]],
      reminders: [],
      prefs,
      now: NOW,
    })
    expect(items).toHaveLength(0)
  })
})
