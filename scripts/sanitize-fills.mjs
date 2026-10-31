#!/usr/bin/env node
/**
 * Nettoie une sauvegarde Drivly des consommations aberrantes.
 *
 * Un plein partiel enregistré comme complet produit soit une consommation
 * ridiculement basse, soit une consommation énorme pour le plein suivant.
 * Le script repère ces segments et repasse le plein fautif en « partiel »,
 * ce qui reporte ses litres sur le prochain plein complet.
 *
 * Usage :
 *   node scripts/sanitize-fills.mjs --file drivly-merged.json --out drivly-clean.json
 */
import { readFileSync, writeFileSync } from "node:fs"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(`--${name}`)
  return index === -1 ? fallback : (args[index + 1] ?? fallback)
}

const file = option("file")
if (!file) {
  console.error(
    "Usage : node scripts/sanitize-fills.mjs --file <sauvegarde.json> [--out <sortie.json>]",
  )
  process.exit(1)
}
const output = option("out", file.replace(/\.json$/i, "") + "-clean.json")
const min = Number(option("min", 2))
const max = Number(option("max", 15))

const payload = JSON.parse(readFileSync(file, "utf8"))
const fills = [...payload.refuelings].sort(
  (a, b) => a.date.localeCompare(b.date) || a.kilometrage - b.kilometrage,
)

function appendNote(fill, note) {
  if (!fill.notes) fill.notes = note
  else if (!fill.notes.includes(note)) fill.notes += ` · ${note}`
}

function segments() {
  let lastFull
  let accumulated = 0
  const list = []
  for (const fill of fills) {
    if (lastFull) accumulated += fill.litres
    if (fill.pleinComplet && lastFull) {
      const distance = fill.kilometrage - lastFull.kilometrage
      if (distance > 0 && accumulated > 0) {
        list.push({
          fill,
          previous: lastFull,
          distance,
          litres: accumulated,
          consumption: (accumulated / distance) * 100,
        })
      }
    }
    if (fill.pleinComplet) {
      lastFull = fill
      accumulated = 0
    }
  }
  return list
}

const NOTE = "Plein partiel déduit automatiquement (consommation incohérente)"
const changes = []

for (let pass = 0; pass < 10; pass += 1) {
  let changed = false
  for (const segment of segments()) {
    if (
      segment.consumption > max &&
      segment.previous.litres < 30 &&
      segment.previous.pleinComplet
    ) {
      segment.previous.pleinComplet = false
      appendNote(segment.previous, NOTE)
      changes.push({
        id: segment.previous.id,
        date: segment.previous.date.slice(0, 10),
        reason: `consommation ${segment.consumption.toFixed(1)} L/100km après ce plein`,
      })
      changed = true
    } else if (
      segment.consumption < min &&
      segment.fill.litres < 30 &&
      segment.fill.pleinComplet
    ) {
      segment.fill.pleinComplet = false
      appendNote(segment.fill, NOTE)
      changes.push({
        id: segment.fill.id,
        date: segment.fill.date.slice(0, 10),
        reason: `consommation ${segment.consumption.toFixed(1)} L/100km pour ce plein`,
      })
      changed = true
    }
  }
  if (!changed) break
}

const remaining = segments()
  .filter((segment) => segment.consumption < min || segment.consumption > max)
  .map((segment) => ({
    id: segment.fill.id,
    date: segment.fill.date.slice(0, 10),
    distance: segment.distance,
    litres: Math.round(segment.litres * 100) / 100,
    consumption: Math.round(segment.consumption * 100) / 100,
  }))

payload.exportedAt = new Date().toISOString()
writeFileSync(output, JSON.stringify(payload, null, 2), "utf8")

console.log(
  JSON.stringify(
    {
      input: file,
      output,
      bounds: [min, max],
      markedPartial: changes.length,
      changes,
      remainingOutliers: remaining,
      note: `Les valeurs restantes seront ignorées à l'affichage (bornes ${min}–${max} L/100km).`,
    },
    null,
    2,
  ),
)
