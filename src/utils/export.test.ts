import { describe, expect, it } from "vitest"
import { validateExportPayload } from "./export"

const validPayload = {
  version: 2,
  exportedAt: "2025-06-01T10:00:00.000Z",
  vehicles: [
    {
      id: "v1",
      nom: "Citroën C4",
      marque: "Citroën",
      modele: "C4",
      immatriculation: "AB-123-CD",
      kmInitial: 1000,
      kmActuel: 20_000,
      carburantDefaut: "Diesel",
      capaciteReservoir: 60,
      createdAt: "2024-01-01T10:00:00.000Z",
    },
  ],
  refuelings: [
    {
      id: "r1",
      vehicleId: "v1",
      date: "2025-05-01T10:00:00.000Z",
      kilometrage: 20_000,
      litres: 40,
      prixAuLitre: 1.8,
      coutTotal: 72,
      carburant: "Diesel",
      pleinComplet: true,
      station: "Total",
      notes: "",
      conducteur: "",
      modePaiement: "",
      createdAt: "2025-05-01T10:00:00.000Z",
    },
  ],
  reminders: [],
  maintenances: [],
  expenses: [
    {
      id: "e1",
      vehicleId: "v1",
      date: "2025-05-02T10:00:00.000Z",
      categorie: "Péage",
      montant: 12,
      notes: "",
      createdAt: "2025-05-02T10:00:00.000Z",
    },
  ],
  revenues: [],
  readings: [],
  trips: [],
  checklists: [],
}

describe("validateExportPayload", () => {
  it("accepte une sauvegarde valide et compte les entrées", () => {
    const result = validateExportPayload(validPayload)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.summary.vehicles).toBe(1)
    expect(result.summary.entries).toBe(2)
    expect(result.payload.refuelings[0].station).toBe("Total")
  })

  it("accepte encore les sauvegardes de version 1", () => {
    const result = validateExportPayload({ ...validPayload, version: 1 })
    expect(result.ok).toBe(true)
  })

  it("refuse une version inconnue", () => {
    const result = validateExportPayload({ ...validPayload, version: 99 })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.errors[0]).toContain("Version")
  })

  it("refuse une date invalide", () => {
    const payload = {
      ...validPayload,
      refuelings: [{ ...validPayload.refuelings[0], date: "30/05/2025" }],
    }
    const result = validateExportPayload(payload)
    expect(result.ok).toBe(false)
  })

  it("refuse une entrée rattachée à un véhicule inconnu", () => {
    const payload = {
      ...validPayload,
      expenses: [{ ...validPayload.expenses[0], vehicleId: "inconnu" }],
    }
    const result = validateExportPayload(payload)
    expect(result.ok).toBe(false)
  })

  it("refuse un fichier qui n'est pas un objet", () => {
    expect(validateExportPayload(null).ok).toBe(false)
    expect(validateExportPayload("{}").ok).toBe(false)
  })

  it("normalise les champs optionnels manquants", () => {
    const payload = {
      ...validPayload,
      vehicles: [{ id: "v1", nom: "Sans options" }],
      refuelings: [
        {
          id: "r1",
          vehicleId: "v1",
          date: "2025-05-01T10:00:00.000Z",
        },
      ],
      expenses: [],
    }
    const result = validateExportPayload(payload)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.payload.vehicles[0].capaciteReservoir).toBe(50)
    expect(result.payload.vehicles[0].marque).toBe("")
    expect(result.payload.refuelings[0].litres).toBe(0)
    expect(result.payload.refuelings[0].station).toBe("")
    expect(result.payload.refuelings[0].pleinComplet).toBe(false)
  })

  it("refuse un identifiant de véhicule manquant", () => {
    const payload = {
      ...validPayload,
      refuelings: [{ ...validPayload.refuelings[0], id: "" }],
    }
    expect(validateExportPayload(payload).ok).toBe(false)
  })
})
