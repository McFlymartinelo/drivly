#!/usr/bin/env node
/**
 * Reconstruit les pleins manquants à partir d'un export de carte carburant.
 *
 * Les relevés de carte donnent la date, les litres, le prix et le montant, mais
 * pas le kilométrage. On ancre le dernier compteur connu puis on répartit la
 * distance au prorata des litres. Si le compteur actuel est fourni, la distance
 * totale est exacte ; sinon elle est estimée avec la consommation historique.
 *
 * Usage :
 *   node scripts/rebuild-from-card.mjs --card releve.csv --km-now 195000
 *
 * Options :
 *   --card <fichier>       export CSV de la carte (obligatoire)
 *   --base <fichier>       export Drivly de départ (défaut : public/drivly-c4-import.json)
 *   --output <fichier>     JSON reconstruit (défaut : drivly-reconstruit.json)
 *   --km-now <nombre>      compteur actuel du véhicule (recommandé)
 *   --km-start <nombre>    compteur du dernier plein connu (défaut : base)
 *   --date-start <date>    date du dernier plein connu (défaut : base)
 *   --consumption <n>      consommation L/100km si --km-now absent (défaut : historique)
 *   --station <nom>        station par défaut si absente du relevé
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(`--${name}`)
  if (index === -1) return fallback
  return args[index + 1] ?? fallback
}
function has(name) {
  return args.includes(`--${name}`)
}

const cardPath = option("card")
if (!cardPath) {
  console.error("Usage : node scripts/rebuild-from-card.mjs --card <releve.csv> [--km-now 195000]")
  process.exit(1)
}

const basePath = resolve(option("base", "public/drivly-c4-import.json"))
const outputPath = resolve(option("output", "drivly-reconstruit.json"))
const kmNowOption = option("km-now")
const stationDefault = option("station", "")
const plateFilter = normalize(option("plate", ""))

const base = JSON.parse(readFileSync(basePath, "utf8"))
const vehicle = base.vehicles[0]
if (!vehicle) {
  console.error("Le fichier de base ne contient aucun véhicule.")
  process.exit(1)
}

const baseFills = [...base.refuelings].sort(
  (a, b) => a.date.localeCompare(b.date) || a.kilometrage - b.kilometrage,
)
const lastFill = baseFills[baseFills.length - 1]
const kmStart = Number(option("km-start", lastFill?.kilometrage ?? vehicle.kmInitial))
const dateStart = option("date-start", lastFill?.date ?? "1970-01-01T00:00:00.000Z")

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseCsv(text) {
  const clean = text.replace(/^\uFEFF/, "")
  const firstLine = clean.split(/\r?\n/)[0] ?? ""
  const counts = [";", ",", "\t"].map((delimiter) => [
    delimiter,
    firstLine.split(delimiter).length,
  ])
  counts.sort((a, b) => b[1] - a[1])
  const delimiter = counts[0][1] > 1 ? counts[0][0] : ";"

  const rows = []
  let row = []
  let field = ""
  let quoted = false
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index]
    if (quoted) {
      if (char === '"') {
        if (clean[index + 1] === '"') {
          field += '"'
          index += 1
        } else {
          quoted = false
        }
      } else {
        field += char
      }
      continue
    }
    if (char === '"') {
      quoted = true
    } else if (char === delimiter) {
      row.push(field)
      field = ""
    } else if (char === "\n") {
      row.push(field)
      rows.push(row)
      row = []
      field = ""
    } else if (char !== "\r") {
      field += char
    }
  }
  if (field || row.length) {
    row.push(field)
    rows.push(row)
  }
  return rows.filter((line) => line.some((cell) => cell.trim() !== ""))
}

function normalize(value) {
  return String(value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
}

function parseNumber(raw) {
  if (raw == null) return null
  let value = String(raw).replace(/[^\d.,-]/g, "")
  if (!value) return null
  const lastComma = value.lastIndexOf(",")
  const lastDot = value.lastIndexOf(".")
  if (lastComma > lastDot) {
    value = value.replace(/\./g, "").replace(",", ".")
  } else if (lastDot > lastComma) {
    value = value.replace(/,/g, "")
  } else {
    value = value.replace(",", ".")
  }
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function parseDate(raw) {
  const value = String(raw ?? "").trim()
  if (!value) return null
  let match = /^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(value)
  if (match) {
    const [, year, month, day, hour = "12", minute = "00"] = match
    return `${year}-${month}-${day}T${hour}:${minute}:00.000Z`
  }
  match = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})(?:[ T](\d{2}):(\d{2}))?/.exec(value)
  if (match) {
    const [, day, month, rawYear, hour = "12", minute = "00"] = match
    const year = rawYear.length === 2 ? `20${rawYear}` : rawYear
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour}:${minute}:00.000Z`
  }
  return null
}

const rows = parseCsv(readFileSync(cardPath, "utf8"))

// Trouve la ligne d'en-tête.
const HEADER_KEYWORDS = {
  date: /date/,
  litres: /(litre|volume|quantite|qte)/,
  amount: /(montant|total|prix ttc|amount)/,
  price: /(prix.*litre|prix au litre|prix\/l|pu |prix unitaire|unit)/,
  station: /(station|site|lieu|adresse|ville|magasin)/,
  product: /(produit|product|libelle|designation|article|nature)/,
  odometer: /(compteur|kilometr|kilom|km)/,
  vehicle: /(vehicule|vehicle|immatriculation|plaque|matricule|card|badge)/,
}

function findColumn(cells, key) {
  return cells.findIndex((cell) => {
    if (!cell) return false
    if (!HEADER_KEYWORDS[key].test(cell)) return false
    // « Prix du litre » ne doit pas être pris pour le volume, ni le prix
    // unitaire pour le montant total.
    if (key === "litres" && /prix|unitaire|pu\b/.test(cell)) return false
    if (key === "amount" && /prix|unitaire/.test(cell)) return false
    return true
  })
}

let headerIndex = -1
let columns = {}
for (let index = 0; index < Math.min(rows.length, 20); index += 1) {
  const cells = rows[index].map(normalize)
  const found = {}
  for (const key of Object.keys(HEADER_KEYWORDS)) {
    const column = findColumn(cells, key)
    if (column >= 0) found[key] = column
  }
  if (found.date != null && (found.litres != null || found.amount != null)) {
    headerIndex = index
    columns = found
    break
  }
}

if (headerIndex === -1) {
  console.error(
    "Impossible de trouver les colonnes (date, litres/montant) dans le relevé.\n" +
      "Ouvre le fichier et vérifie qu'il contient bien une ligne d'en-tête.",
  )
  process.exit(1)
}

const cardEntries = []
for (const row of rows.slice(headerIndex + 1)) {
  const date = parseDate(row[columns.date])
  if (!date) continue
  if (date < dateStart) continue

  const product = columns.product != null ? String(row[columns.product] ?? "") : ""
  const vehicleCell =
    columns.vehicle != null ? normalize(row[columns.vehicle]) : ""
  if (plateFilter && vehicleCell && !vehicleCell.includes(plateFilter)) continue
  const litres = columns.litres != null ? parseNumber(row[columns.litres]) : null
  const amount = columns.amount != null ? parseNumber(row[columns.amount]) : null
  let price = columns.price != null ? parseNumber(row[columns.price]) : null
  const station =
    (columns.station != null ? String(row[columns.station] ?? "").trim() : "") ||
    stationDefault
  const odometer =
    columns.odometer != null ? parseNumber(row[columns.odometer]) : null

  const normalizedProduct = normalize(product)
  const isFuel =
    !normalizedProduct ||
    /(gasoil|diesel|gazole|fuel|carburant|essence|sp95|sp98|e10|e85)/.test(
      normalizedProduct,
    )

  let computedLitres = litres
  if (isFuel) {
    if ((computedLitres == null || computedLitres <= 0) && amount != null && price) {
      computedLitres = amount / price
    }
    if (!computedLitres || computedLitres <= 0) continue
  } else {
    if (amount == null || amount <= 0) continue
    computedLitres = 0
  }

  if (price == null || price <= 0) {
    if (amount != null && amount > 0 && computedLitres > 0) {
      price = amount / computedLitres
    }
  }

  cardEntries.push({
    date,
    litres: computedLitres > 0 ? round(computedLitres, 3) : 0,
    amount: amount != null ? round(amount, 2) : round(computedLitres * (price ?? 0), 2),
    price: price != null ? round(price, 3) : null,
    station,
    product,
    odometer,
    isFuel,
  })
}

cardEntries.sort((a, b) => a.date.localeCompare(b.date))

const fuelEntries = cardEntries.filter((entry) => entry.isFuel)
const otherEntries = cardEntries.filter((entry) => !entry.isFuel)

if (fuelEntries.length === 0) {
  console.error("Aucun plein carburant trouvé dans le relevé après le " + dateStart)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Estimation des kilomètres
// ---------------------------------------------------------------------------

function round(value, digits) {
  const factor = 10 ** digits
  return Math.round(value * factor) / factor
}

/** Consommation moyenne pondérée des pleins complets de la base. */
function historicalConsumption(fills) {
  const sorted = [...fills].sort((a, b) => a.date.localeCompare(b.date))
  let litres = 0
  let distance = 0
  let previousFull
  for (const fill of sorted) {
    if (fill.pleinComplet && previousFull) {
      const segment = fill.kilometrage - previousFull.kilometrage
      if (segment > 0) {
        litres += fill.litres
        distance += segment
      }
    }
    if (fill.pleinComplet) previousFull = fill
  }
  return distance > 0 ? (litres / distance) * 100 : 6
}

const totalLitres = fuelEntries.reduce((sum, entry) => sum + entry.litres, 0)
const totalAmount = fuelEntries.reduce((sum, entry) => sum + entry.amount, 0)
const kmNow = kmNowOption != null ? Number(kmNowOption) : null
const hasOdometer = fuelEntries.every((entry) => entry.odometer != null && entry.odometer > 0)

let consumption
let totalDistance
if (hasOdometer) {
  totalDistance = fuelEntries[fuelEntries.length - 1].odometer - kmStart
  consumption = totalDistance > 0 ? (totalLitres / totalDistance) * 100 : null
} else if (kmNow != null && Number.isFinite(kmNow) && kmNow > kmStart) {
  totalDistance = kmNow - kmStart
  consumption = (totalLitres / totalDistance) * 100
} else {
  consumption = Number(option("consumption", 0)) || historicalConsumption(baseFills)
  totalDistance = (totalLitres / consumption) * 100
}

if (totalDistance <= 0) {
  console.error("Distance estimée nulle : vérifie --km-now / --km-start.")
  process.exit(1)
}
if (consumption < 3 || consumption > 15) {
  console.warn(
    `⚠ Consommation estimée inhabituelle : ${round(consumption, 2)} L/100km. ` +
      "Vérifie le compteur actuel et que le relevé couvre bien toute la période.",
  )
}

const newFills = []
let cumulativeLitres = 0
let previousKm = kmStart
for (const [index, entry] of fuelEntries.entries()) {
  cumulativeLitres += entry.litres
  let km
  if (entry.odometer != null && entry.odometer > 0) {
    km = Math.round(entry.odometer)
  } else {
    km = Math.round(kmStart + (totalDistance * cumulativeLitres) / totalLitres)
  }
  if (km <= previousKm) km = previousKm + 1
  previousKm = km

  newFills.push({
    id: `card-${String(index + 1).padStart(3, "0")}-${entry.date.slice(0, 10)}`,
    vehicleId: vehicle.id,
    date: entry.date,
    kilometrage: km,
    litres: entry.litres,
    prixAuLitre: entry.price ?? round(entry.amount / entry.litres, 3),
    coutTotal: entry.amount,
    carburant: "Diesel",
    pleinComplet: true,
    station: entry.station,
    notes: hasOdometer
      ? "Reconstruit depuis la carte carburant — compteur issu du relevé"
      : "Reconstruit depuis la carte carburant — kilométrage estimé",
    conducteur: "",
    modePaiement: "",
    createdAt: entry.date,
  })

  entry.kilometrage = km
}

const finalKm = newFills[newFills.length - 1]?.kilometrage ?? kmStart
const vehicleKm = kmNow != null && Number.isFinite(kmNow) ? Math.max(kmNow, finalKm) : finalKm

// Dépenses non-carburant éventuelles (lavage, accessoires…).
const newExpenses = otherEntries.map((entry, index) => ({
  id: `card-exp-${String(index + 1).padStart(3, "0")}-${entry.date.slice(0, 10)}`,
  vehicleId: vehicle.id,
  date: entry.date,
  kilometrage: undefined,
  categorie: "Autre",
  montant: entry.amount,
  notes: [entry.product, entry.station].filter(Boolean).join(" · ") || "Carte carburant",
  createdAt: entry.date,
}))

const payload = {
  ...base,
  version: 2,
  exportedAt: new Date().toISOString(),
  vehicles: [
    {
      ...vehicle,
      kmActuel: vehicleKm,
    },
  ],
  refuelings: [...baseFills, ...newFills],
  expenses: [...(base.expenses ?? []), ...newExpenses],
}

writeFileSync(outputPath, JSON.stringify(payload, null, 2), "utf8")

console.log(
  JSON.stringify(
    {
      card: cardPath,
      output: outputPath,
      plateFilter: plateFilter || null,
      cardFuelEntries: fuelEntries.length,
      cardOtherEntries: otherEntries.length,
      totalLitres: round(totalLitres, 2),
      totalAmount: round(totalAmount, 2),
      kmStart,
      kmEnd: vehicleKm,
      estimatedDistance: Math.round(totalDistance),
      estimatedConsumption: consumption == null ? null : round(consumption, 2),
      odometerFromCard: hasOdometer,
      firstFill: newFills[0]
        ? { date: newFills[0].date, km: newFills[0].kilometrage }
        : null,
      lastFill: newFills[newFills.length - 1]
        ? {
            date: newFills[newFills.length - 1].date,
            km: newFills[newFills.length - 1].kilometrage,
          }
        : null,
    },
    null,
    2,
  ),
)
