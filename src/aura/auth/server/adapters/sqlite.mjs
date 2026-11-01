import { readFileSync } from "node:fs"
import { DatabaseSync } from "node:sqlite"

const SCHEMA_URL = new URL("../schema.sql", import.meta.url)

/**
 * Adaptateur SQLite basé sur `node:sqlite` (Node 22.5+), sans dépendance.
 *
 *   const db = createSqliteDb({ file: "./data/app.db" })
 *
 * `migrate: false` si les tables sont créées par ton propre système de
 * migrations. Le schéma fourni est idempotent (CREATE IF NOT EXISTS).
 */
export function createSqliteDb({ file = ":memory:", migrate = true, schema } = {}) {
  const database = new DatabaseSync(file)
  database.exec("PRAGMA foreign_keys = ON")

  if (file !== ":memory:") {
    try {
      database.exec("PRAGMA journal_mode = WAL")
    } catch {
      // Certains systèmes de fichiers (réseau) refusent WAL : on continue.
    }
  }

  if (migrate) {
    database.exec(schema ?? readFileSync(SCHEMA_URL, "utf8"))
  }

  const statements = new Map()
  function statement(sql) {
    let prepared = statements.get(sql)
    if (!prepared) {
      prepared = database.prepare(sql)
      statements.set(sql, prepared)
    }
    return prepared
  }

  return {
    get(sql, params = []) {
      return statement(sql).get(...params)
    },
    all(sql, params = []) {
      return statement(sql).all(...params)
    },
    run(sql, params = []) {
      const result = statement(sql).run(...params)
      return {
        changes: Number(result.changes ?? 0),
        lastInsertRowid: Number(result.lastInsertRowid ?? 0),
      }
    },
    exec(sql) {
      database.exec(sql)
    },
    close() {
      statements.clear()
      database.close()
    },
    raw: database,
  }
}
