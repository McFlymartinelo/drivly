import { createHash } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

export const ENTRIES = [
  "vehicles",
  "refuelings",
  "reminders",
  "maintenances",
  "expenses",
  "revenues",
  "readings",
  "trips",
  "checklists",
]

const bool = (value) => (value ? 1 : 0)
const str = (value) => (typeof value === "string" ? value : "")
const num = (value) => (typeof value === "number" && Number.isFinite(value) ? value : null)

/**
 * Colonnes exposées pour interroger la base en SQL. Le JSON complet de chaque
 * entrée est aussi conservé dans la colonne `data`, ce qui permet de faire
 * évoluer le modèle sans migration lourde.
 */
const COLUMNS = {
  vehicles: {
    nom: (record) => str(record.nom),
    marque: (record) => str(record.marque),
    modele: (record) => str(record.modele),
    immatriculation: (record) => str(record.immatriculation),
    km_initial: (record) => num(record.kmInitial),
    km_actuel: (record) => num(record.kmActuel),
    carburant_defaut: (record) => str(record.carburantDefaut),
    capacite_reservoir: (record) => num(record.capaciteReservoir),
    created_at: (record) => str(record.createdAt),
  },
  refuelings: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    kilometrage: (record) => num(record.kilometrage),
    litres: (record) => num(record.litres),
    prix_au_litre: (record) => num(record.prixAuLitre),
    cout_total: (record) => num(record.coutTotal),
    carburant: (record) => str(record.carburant),
    plein_complet: (record) => bool(record.pleinComplet),
    station: (record) => str(record.station),
    conducteur: (record) => str(record.conducteur),
  },
  reminders: {
    vehicle_id: (record) => str(record.vehicleId),
    titre: (record) => str(record.titre),
    type: (record) => str(record.type),
    km_echeance: (record) => num(record.kmEcheance),
    date_echeance: (record) => str(record.dateEcheance),
    resolu: (record) => bool(record.resolu),
  },
  maintenances: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    kilometrage: (record) => num(record.kilometrage),
    type_intervention: (record) => str(record.typeIntervention),
    type_entretien: (record) => str(record.typeEntretien),
    cout_total: (record) => num(record.coutTotal),
    references_pieces: (record) => str(record.referencesPieces),
  },
  expenses: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    kilometrage: (record) => num(record.kilometrage),
    categorie: (record) => str(record.categorie),
    montant: (record) => num(record.montant),
  },
  revenues: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    kilometrage: (record) => num(record.kilometrage),
    categorie: (record) => str(record.categorie),
    montant: (record) => num(record.montant),
  },
  readings: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    kilometrage: (record) => num(record.kilometrage),
  },
  trips: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    km_debut: (record) => num(record.kmDebut),
    km_fin: (record) => num(record.kmFin),
    destination: (record) => str(record.destination),
  },
  checklists: {
    vehicle_id: (record) => str(record.vehicleId),
    date: (record) => str(record.date),
    titre: (record) => str(record.titre),
  },
}

const SQL_TYPES = {
  nom: "TEXT",
  marque: "TEXT",
  modele: "TEXT",
  immatriculation: "TEXT",
  km_initial: "REAL",
  km_actuel: "REAL",
  carburant_defaut: "TEXT",
  capacite_reservoir: "REAL",
  created_at: "TEXT",
  vehicle_id: "TEXT",
  date: "TEXT",
  kilometrage: "REAL",
  litres: "REAL",
  prix_au_litre: "REAL",
  cout_total: "REAL",
  carburant: "TEXT",
  plein_complet: "INTEGER",
  station: "TEXT",
  conducteur: "TEXT",
  titre: "TEXT",
  type: "TEXT",
  km_echeance: "REAL",
  date_echeance: "TEXT",
  resolu: "INTEGER",
  type_intervention: "TEXT",
  type_entretien: "TEXT",
  references_pieces: "TEXT",
  categorie: "TEXT",
  montant: "REAL",
  km_debut: "REAL",
  km_fin: "REAL",
  destination: "TEXT",
}

function schemaFor(table) {
  const columns = Object.keys(COLUMNS[table])
    .map((name) => `  ${name} ${SQL_TYPES[name] ?? "TEXT"}`)
    .join(",\n")
  return `CREATE TABLE IF NOT EXISTS ${table} (
  id TEXT PRIMARY KEY,
${columns},
  data TEXT NOT NULL,
  updated_at TEXT NOT NULL
)`
}

export function isEntryTable(table) {
  return ENTRIES.includes(table)
}

export function createStore(dbPath, options = {}) {
  const maxSnapshots = Math.max(1, Number(options.maxSnapshots ?? 50))
  mkdirSync(dirname(dbPath), { recursive: true })

  const db = new DatabaseSync(dbPath)
  db.exec("PRAGMA journal_mode = WAL")
  db.exec("PRAGMA synchronous = NORMAL")
  db.exec("PRAGMA foreign_keys = OFF")

  db.exec(`
    CREATE TABLE IF NOT EXISTS backups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT NOT NULL,
      device TEXT NOT NULL DEFAULT '',
      counts TEXT NOT NULL,
      hash TEXT NOT NULL,
      payload TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS backups_created_at ON backups (created_at DESC);
  `)

  for (const table of ENTRIES) {
    db.exec(schemaFor(table))
    if (COLUMNS[table].vehicle_id) {
      db.exec(`CREATE INDEX IF NOT EXISTS ${table}_vehicle ON ${table} (vehicle_id)`)
    }
    if (COLUMNS[table].date) {
      db.exec(`CREATE INDEX IF NOT EXISTS ${table}_date ON ${table} (date DESC)`)
    }
  }

  const insertStmts = new Map()
  for (const table of ENTRIES) {
    const columns = Object.keys(COLUMNS[table])
    insertStmts.set(
      table,
      db.prepare(
        `INSERT INTO ${table} (id, ${columns.join(", ")}, data, updated_at)
         VALUES (?, ${columns.map(() => "?").join(", ")}, ?, ?)`,
      ),
    )
  }

  const listStmt = db.prepare(
    `SELECT id, created_at, device, counts, hash, length(payload) AS bytes
     FROM backups ORDER BY id DESC LIMIT ?`,
  )
  const getStmt = db.prepare(
    `SELECT id, created_at, device, counts, hash, payload, length(payload) AS bytes
     FROM backups WHERE id = ?`,
  )
  const latestStmt = db.prepare(
    `SELECT id, created_at, device, counts, hash, payload, length(payload) AS bytes
     FROM backups ORDER BY id DESC LIMIT 1`,
  )
  const insertBackupStmt = db.prepare(
    `INSERT INTO backups (created_at, device, counts, hash, payload)
     VALUES (?, ?, ?, ?, ?)`,
  )
  const pruneStmt = db.prepare(
    `DELETE FROM backups WHERE id NOT IN
     (SELECT id FROM backups ORDER BY id DESC LIMIT ?)`,
  )
  const countStmt = db.prepare("SELECT COUNT(*) AS n FROM backups")
  const tableCountStmt = db.prepare(
    `SELECT ${ENTRIES.map((table) => `(SELECT COUNT(*) FROM ${table}) AS ${table}`).join(", ")}`,
  )

  function meta(row) {
    return {
      id: row.id,
      createdAt: row.created_at,
      device: row.device,
      counts: JSON.parse(row.counts),
      bytes: row.bytes,
    }
  }

  function countsOf(payload) {
    return Object.fromEntries(ENTRIES.map((table) => [table, payload[table].length]))
  }

  /** Remplace le contenu des tables par le payload (le client fait foi). */
  function replaceEntries(payload, now) {
    for (const table of ENTRIES) {
      db.exec(`DELETE FROM ${table}`)
      const stmt = insertStmts.get(table)
      const columns = Object.keys(COLUMNS[table])
      for (const record of payload[table]) {
        stmt.run(
          String(record.id),
          ...columns.map((name) => COLUMNS[table][name](record)),
          JSON.stringify(record),
          now,
        )
      }
    }
  }

  function hashOf(payload) {
    return createHash("sha256")
      .update(JSON.stringify(ENTRIES.map((table) => payload[table])))
      .digest("hex")
  }

  function tableCounts() {
    return tableCountStmt.get()
  }

  /**
   * Enregistre un payload : met à jour les tables et crée une version si le
   * contenu a changé (déduplication par empreinte).
   */
  function save(payload, device = "", { force = false } = {}) {
    const now = new Date().toISOString()
    const hash = hashOf(payload)
    const latest = latestStmt.get()

    if (!force && latest && latest.hash === hash) {
      const counts = tableCounts()
      const empty = ENTRIES.every((table) => Number(counts[table] ?? 0) === 0)
      if (empty) {
        db.exec("BEGIN IMMEDIATE")
        try {
          replaceEntries(payload, now)
          db.exec("COMMIT")
        } catch (error) {
          db.exec("ROLLBACK")
          throw error
        }
      }
      return { skipped: true, backup: meta(latest) }
    }

    db.exec("BEGIN IMMEDIATE")
    try {
      replaceEntries(payload, now)
      insertBackupStmt.run(
        now,
        device.slice(0, 120),
        JSON.stringify(countsOf(payload)),
        hash,
        JSON.stringify(payload),
      )
      pruneStmt.run(maxSnapshots)
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }

    return { skipped: false, backup: meta(latestStmt.get()) }
  }

  /** Reconstruit les tables depuis la dernière sauvegarde (migration). */
  function rebuildFromLatest() {
    const latest = latestStmt.get()
    if (!latest) return false
    const counts = tableCounts()
    const empty = ENTRIES.every((table) => Number(counts[table] ?? 0) === 0)
    if (!empty) return false
    db.exec("BEGIN IMMEDIATE")
    try {
      replaceEntries(JSON.parse(latest.payload), new Date().toISOString())
      db.exec("COMMIT")
    } catch (error) {
      db.exec("ROLLBACK")
      throw error
    }
    return true
  }

  function list(limit = 20) {
    return listStmt.all(limit).map(meta)
  }

  function latest() {
    return latestStmt.get() ?? null
  }

  function byId(id) {
    return getStmt.get(id) ?? null
  }

  function entries(table, limit = 100, offset = 0) {
    if (!isEntryTable(table)) throw new Error("Table inconnue.")
    const order = COLUMNS[table].date ? "date DESC" : "rowid DESC"
    return db
      .prepare(`SELECT * FROM ${table} ORDER BY ${order} LIMIT ? OFFSET ?`)
      .all(limit, offset)
      .map((row) => ({
        id: row.id,
        updatedAt: row.updated_at,
        data: JSON.parse(row.data),
      }))
  }

  function backupCount() {
    return Number(countStmt.get().n)
  }

  function close() {
    db.close()
  }

  return {
    db,
    maxSnapshots,
    save,
    rebuildFromLatest,
    list,
    latest,
    byId,
    entries,
    backupCount,
    tableCounts,
    close,
  }
}
