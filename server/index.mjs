import http from "node:http"
import { createHash, timingSafeEqual } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

const PORT = Number(process.env.PORT ?? 3000)
const DB_PATH = process.env.DRIVLY_DB ?? "/data/drivly.sqlite"
const TOKEN = process.env.DRIVLY_TOKEN ?? ""
const MAX_SNAPSHOTS = Math.max(1, Number(process.env.DRIVLY_MAX_SNAPSHOTS ?? 50))
const MAX_BODY = 20 * 1024 * 1024
const CORS_ORIGINS = (process.env.DRIVLY_CORS_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

const ENTRIES = [
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

if (TOKEN.length < 16) {
  console.error(
    "DRIVLY_TOKEN manquant ou trop court (16 caractères minimum).\n" +
      "Génère-en un avec : openssl rand -hex 32",
  )
  process.exit(1)
}

mkdirSync(dirname(DB_PATH), { recursive: true })
const db = new DatabaseSync(DB_PATH)
db.exec("PRAGMA journal_mode = WAL")
db.exec("PRAGMA synchronous = NORMAL")
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
const insertStmt = db.prepare(
  `INSERT INTO backups (created_at, device, counts, hash, payload)
   VALUES (?, ?, ?, ?, ?)`,
)
const pruneStmt = db.prepare(
  `DELETE FROM backups WHERE id NOT IN
   (SELECT id FROM backups ORDER BY id DESC LIMIT ?)`,
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

function json(res, status, body) {
  const text = JSON.stringify(body)
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(text)
}

function applyCors(req, res) {
  const origin = req.headers.origin
  if (!origin || !CORS_ORIGINS.includes(origin)) return
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Vary", "Origin")
  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  res.setHeader("Access-Control-Max-Age", "600")
}

function authorized(req) {
  const header = req.headers.authorization ?? ""
  const match = /^Bearer (.+)$/.exec(header)
  if (!match) return false
  const provided = Buffer.from(match[1])
  const expected = Buffer.from(TOKEN)
  return provided.length === expected.length && timingSafeEqual(provided, expected)
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on("data", (chunk) => {
      size += chunk.length
      if (size > MAX_BODY) {
        reject(Object.assign(new Error("Corps de requête trop volumineux."), { status: 413 }))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on("end", () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")))
      } catch {
        reject(Object.assign(new Error("JSON invalide."), { status: 400 }))
      }
    })
    req.on("error", reject)
  })
}

function normalizePayload(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw Object.assign(new Error("Sauvegarde invalide : objet attendu."), { status: 400 })
  }
  if (raw.version !== 1 && raw.version !== 2) {
    throw Object.assign(new Error("Version de sauvegarde non prise en charge."), { status: 400 })
  }
  const payload = { ...raw }
  for (const table of ENTRIES) {
    if (payload[table] == null) payload[table] = []
    if (!Array.isArray(payload[table])) {
      throw Object.assign(new Error(`« ${table} » doit être une liste.`), { status: 400 })
    }
  }
  return payload
}

function countsOf(payload) {
  return Object.fromEntries(ENTRIES.map((table) => [table, payload[table].length]))
}

async function handle(req, res) {
  applyCors(req, res)

  if (req.method === "OPTIONS") {
    res.writeHead(204)
    res.end()
    return
  }

  const url = new URL(req.url ?? "/", "http://localhost")
  const path = url.pathname.replace(/\/+$/, "") || "/"

  if (path === "/api/health" && req.method === "GET") {
    json(res, 200, { ok: true, service: "drivly-api" })
    return
  }

  if (!authorized(req)) {
    json(res, 401, { error: "Jeton invalide." })
    return
  }

  if (path === "/api/backups" && req.method === "POST") {
    const body = await readJson(req)
    const payload = normalizePayload(body?.payload)
    const device = typeof body?.device === "string" ? body.device.slice(0, 120) : ""
    const text = JSON.stringify(payload)
    // L'empreinte ignore `exportedAt` : deux envois des mêmes données sont
    // considérés identiques et ne créent pas de sauvegarde en double.
    const hash = createHash("sha256")
      .update(JSON.stringify(ENTRIES.map((table) => payload[table])))
      .digest("hex")

    const latest = latestStmt.get()
    if (latest && latest.hash === hash) {
      json(res, 200, { skipped: true, backup: meta(latest) })
      return
    }

    const createdAt = new Date().toISOString()
    const result = insertStmt.run(createdAt, device, JSON.stringify(countsOf(payload)), hash, text)
    pruneStmt.run(MAX_SNAPSHOTS)
    const stored = getStmt.get(Number(result.lastInsertRowid))
    json(res, 201, { skipped: false, backup: meta(stored) })
    return
  }

  if (path === "/api/backups" && req.method === "GET") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)))
    json(res, 200, { backups: listStmt.all(limit).map(meta) })
    return
  }

  if (path === "/api/backups/latest" && req.method === "GET") {
    const row = latestStmt.get()
    if (!row) {
      json(res, 404, { error: "Aucune sauvegarde sur le serveur." })
      return
    }
    json(res, 200, { backup: meta(row), payload: JSON.parse(row.payload) })
    return
  }

  const match = /^\/api\/backups\/(\d+)$/.exec(path)
  if (match && req.method === "GET") {
    const row = getStmt.get(Number(match[1]))
    if (!row) {
      json(res, 404, { error: "Sauvegarde introuvable." })
      return
    }
    json(res, 200, { backup: meta(row), payload: JSON.parse(row.payload) })
    return
  }

  json(res, 404, { error: "Route inconnue." })
}

const server = http.createServer((req, res) => {
  handle(req, res).catch((error) => {
    const status = Number(error?.status) || 500
    if (status >= 500) console.error(error)
    if (!res.headersSent) json(res, status, { error: error?.message ?? "Erreur serveur." })
    else res.end()
  })
})

function shutdown() {
  server.close(() => {
    try {
      db.close()
    } catch {}
    process.exit(0)
  })
  setTimeout(() => process.exit(0), 3000).unref()
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

server.listen(PORT, "0.0.0.0", () => {
  console.log(
    `Drivly API sur :${PORT} — base ${DB_PATH} — ${MAX_SNAPSHOTS} sauvegardes max`,
  )
})
