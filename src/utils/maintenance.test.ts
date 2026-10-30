import { describe, expect, it } from "vitest"
import type { Maintenance, Reminder, Vehicle } from "../types"
import { maintenanceSuggestions } from "./maintenance"

const vehicle: Vehicle = {
  id: "v1",
  nom: "Citroën C4",
  marque: "Citroën",
  modele: "C4",
  immatriculation: "AB-123-CD",
  kmInitial: 0,
  kmActuel: 110_000,
  carburantDefaut: "Diesel",
  capaciteReservoir: 60,
  createdAt: "2020-01-01T00:00:00.000Z",
}

function maintenance(over: Partial<Maintenance>): Maintenance {
  return {
    id: "m1",
    vehicleId: "v1",
    date: "2025-01-01T10:00:00.000Z",
    kilometrage: 100_000,
    typeIntervention: "Garage",
    typeEntretien: "Changement d'huile (+3)",
    coutTotal: 80,
    referencesPieces: "",
    notes: "",
    createdAt: "2025-01-01T10:00:00.000Z",
    ...over,
  }
}

function reminder(over: Partial<Reminder>): Reminder {
  return {
    id: "r1",
    vehicleId: "v1",
    titre: "Vidange + filtre à huile",
    type: "entretien",
    resolu: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...over,
  }
}

describe("maintenanceSuggestions", () => {
  it("déduit la prochaine vidange du dernier passage", () => {
    const suggestions = maintenanceSuggestions([maintenance({})], [], vehicle)
    const oil = suggestions.find((item) => item.titre.includes("Vidange"))
    expect(oil).toBeDefined()
    expect(oil?.kmEcheance).toBe(115_000)
    expect(oil?.dateEcheance?.slice(0, 10)).toBe("2026-01-01")
  })

  it("ne propose pas un entretien déjà planifié", () => {
    const suggestions = maintenanceSuggestions(
      [maintenance({})],
      [reminder({})],
      vehicle,
    )
    expect(suggestions.some((item) => item.titre.includes("Vidange"))).toBe(false)
  })

  it("propose aussi les entretiens déjà en retard", () => {
    const suggestions = maintenanceSuggestions(
      [maintenance({ date: "2020-01-01T10:00:00.000Z", kilometrage: 50_000 })],
      [],
      vehicle,
    )
    const oil = suggestions.find((item) => item.titre.includes("Vidange"))
    expect(oil?.kmEcheance).toBeLessThan(vehicle.kmActuel)
  })

  it("ne renvoie rien sans entretien connu", () => {
    expect(maintenanceSuggestions([], [], vehicle)).toEqual([])
  })
})
