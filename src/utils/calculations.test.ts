import { describe, expect, it } from "vitest"
import type { Refueling, Reminder } from "../types"
import {
  aggregateFuel,
  computeReminderStats,
  fuelMetrics,
  isPlausibleConsumption,
  reminderStatus,
  summarizeFuel,
} from "./calculations"
import { formatIsoDate, parseDecimal, toDateInputValue } from "./format"

const V = "veh-1"

function fill(
  id: string,
  date: string,
  kilometrage: number,
  litres: number,
  options: { full?: boolean; cost?: number } = {},
): Refueling {
  const cost = options.cost ?? litres * 1.8
  return {
    id,
    vehicleId: V,
    date,
    kilometrage,
    litres,
    prixAuLitre: cost / litres,
    coutTotal: cost,
    carburant: "Diesel",
    pleinComplet: options.full ?? true,
    station: "",
    notes: "",
    conducteur: "",
    modePaiement: "",
    createdAt: date,
  }
}

function reminder(over: Partial<Reminder>): Reminder {
  return {
    id: "r1",
    vehicleId: V,
    titre: "Vidange",
    type: "entretien",
    resolu: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    ...over,
  }
}

describe("fuelMetrics", () => {
  it("calcule la consommation entre deux pleins complets", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 40),
      fill("b", "2025-02-01T10:00:00.000Z", 1500, 40),
    ]
    const metrics = fuelMetrics(fills)
    expect(metrics.get("b")?.distance).toBe(500)
    expect(metrics.get("b")?.consumption).toBeCloseTo(8, 5)
    expect(metrics.get("b")?.costPerKm).toBeCloseTo((40 * 1.8) / 500, 5)
  })

  it("ne calcule pas de consommation sur le premier plein", () => {
    const fills = [fill("a", "2025-01-01T10:00:00.000Z", 1000, 40)]
    expect(fuelMetrics(fills).get("a")?.consumption).toBeNull()
  })

  it("reporte les litres d'un plein partiel sur le plein complet suivant", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 40),
      fill("b", "2025-01-15T10:00:00.000Z", 1200, 20, { full: false }),
      fill("c", "2025-02-01T10:00:00.000Z", 1500, 20),
    ]
    const metrics = fuelMetrics(fills)

    // Le plein partiel n'a pas de consommation exploitable…
    expect(metrics.get("b")?.consumption).toBeNull()
    expect(metrics.get("b")?.distance).toBe(200)

    // …mais ses litres comptent dans le segment complet suivant.
    expect(metrics.get("c")?.distance).toBe(500)
    expect(metrics.get("c")?.segmentLitres).toBe(40)
    expect(metrics.get("c")?.consumption).toBeCloseTo(8, 5)
  })

  it("ignore un kilométrage incohérent au lieu de produire un négatif", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 40),
      fill("b", "2025-02-01T10:00:00.000Z", 900, 40),
    ]
    const metrics = fuelMetrics(fills)
    expect(metrics.get("b")?.distance).toBeNull()
    expect(metrics.get("b")?.consumption).toBeNull()
  })
})

describe("aggregateFuel", () => {
  it("pondère la consommation par la distance réelle", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 50),
      fill("b", "2025-02-01T10:00:00.000Z", 1500, 40),
      fill("c", "2025-04-01T10:00:00.000Z", 2500, 60),
    ]
    const agg = aggregateFuel(fills, fills)
    // (40 + 60) L pour (500 + 1000) km, et non la moyenne de 8 et 6.
    expect(agg.avgConsumption).toBeCloseTo((100 / 1500) * 100, 4)
    expect(agg.distance).toBe(1500)
    expect(agg.count).toBe(3)
  })
})

describe("summarizeFuel", () => {
  it("utilise le même périmètre pour la distance et la consommation", () => {
    const fills = [
      fill("a", "2025-01-10T10:00:00.000Z", 1000, 40),
      fill("b", "2025-02-05T10:00:00.000Z", 1500, 45),
    ]
    const february = fills.filter((item) => item.date.startsWith("2025-02"))
    const summary = summarizeFuel(february, fills)
    expect(summary.distance).toBe(500)
    expect(summary.litres).toBe(45)
    expect(summary.consumption).toBeCloseTo(9, 5)
  })

  it("renvoie une distance nulle sans plein précédent", () => {
    const fills = [fill("a", "2025-02-05T10:00:00.000Z", 1500, 45)]
    const summary = summarizeFuel(fills, fills)
    expect(summary.distance).toBeNull()
    expect(summary.consumption).toBeNull()
  })
})

describe("reminders", () => {
  const now = new Date("2025-06-15T12:00:00.000Z")

  it("signale un rappel kilométrique dépassé", () => {
    const status = reminderStatus(reminder({ kmEcheance: 90_000 }), 91_200, now)
    expect(status.level).toBe("late")
    expect(status.kmText).toBe("Dépassé de 1 200 km")
  })

  it("signale un rappel en retard de plusieurs jours", () => {
    const status = reminderStatus(
      reminder({ dateEcheance: "2025-06-10T08:00:00.000Z" }),
      0,
      now,
    )
    expect(status.level).toBe("late")
    expect(status.daysText).toBe("En retard de 5 jours")
  })

  it("passe en orange à l'approche de l'échéance", () => {
    const status = reminderStatus(
      reminder({ kmEcheance: 90_500, dateEcheance: "2025-07-01T08:00:00.000Z" }),
      90_000,
      now,
    )
    expect(status.level).toBe("soon")
    expect(status.kmText).toBe("Dans 500 km")
    expect(computeReminderStats(reminder({ kmEcheance: 90_500 }), 90_000).kmRestants).toBe(500)
  })
})

describe("plausibilité des consommations", () => {
  it("ignore un plein partiel enregistré comme complet", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 40),
      // 36 L pour 56 km : aberrant, typique d'un plein partiel mal saisi.
      fill("b", "2025-01-05T10:00:00.000Z", 1056, 36),
      fill("c", "2025-02-01T10:00:00.000Z", 1500, 40),
    ]
    const metrics = fuelMetrics(fills)
    expect(metrics.get("b")?.consumption).toBeNull()
    expect(metrics.get("b")?.costPerKm).toBeNull()
    expect(metrics.get("c")?.consumption).toBeCloseTo((40 / 444) * 100, 5)

    const agg = aggregateFuel(fills, fills)
    expect(agg.minConsumption).toBeGreaterThanOrEqual(2)
    expect(agg.avgConsumption).toBeCloseTo((40 / 444) * 100, 4)
  })

  it("ignore une consommation trop basse (relevé manquant)", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 40),
      fill("b", "2025-06-01T10:00:00.000Z", 5000, 10),
    ]
    expect(fuelMetrics(fills).get("b")?.consumption).toBeNull()
  })

  it("borne les valeurs de référence", () => {
    expect(isPlausibleConsumption(1.14)).toBe(false)
    expect(isPlausibleConsumption(64.61)).toBe(false)
    expect(isPlausibleConsumption(16.67)).toBe(false)
    expect(isPlausibleConsumption(5.4)).toBe(true)
    expect(isPlausibleConsumption(null)).toBe(false)
  })

  it("exclut les segments aberrants du résumé mensuel", () => {
    const fills = [
      fill("a", "2025-01-01T10:00:00.000Z", 1000, 40),
      fill("b", "2025-01-05T10:00:00.000Z", 1056, 36),
      fill("c", "2025-01-20T10:00:00.000Z", 1500, 40),
    ]
    const january = fills.filter((item) => item.date.startsWith("2025-01"))
    const summary = summarizeFuel(january, fills)
    expect(summary.distance).toBe(500)
    expect(summary.consumption).toBeCloseTo((40 / 444) * 100, 5)
  })
})

describe("format et parsing", () => {
  it("ne plante pas sur une date invalide", () => {
    expect(formatIsoDate("pas-une-date")).toBe("—")
    expect(toDateInputValue("pas-une-date")).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it("accepte la virgule décimale", () => {
    expect(parseDecimal("1 234,56")).toBe(1234.56)
    expect(parseDecimal("")).toBeNull()
  })
})
