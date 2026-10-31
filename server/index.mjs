import http from "node:http"
import { timingSafeEqual } from "node:crypto"
import { createStore, isEntryTable } from "./store.mjs"
import { normalizePayload } from "./validate.mjs"

const PORT = Number(process.env.PORT ?? 3000)
const DB_PATH = process.env.DRIVLY_DB ?? "/data/drivly.sqlite"
const TOKEN = process.env.DRIVLY_TOKEN ?? ""
const MAX_SNAPSHOTS = Math.max(1, Number(process.env.DRIVLY_MAX_SNAPSHOTS ?? 50))
const MAX_BODY = 20 * 1024 * 1024
const CORS_ORIGINS = (process.env.DRIVLY_CORS_ORIGIN ?? "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean)

if (TOKEN.length < 16) {
  console.error(
    "DRIVLY_TOKEN manquant ou trop court (16 caractères minimum).\n" +
      "Génère-en un avec : openssl rand -hex 32",
  )
  process.exit(1)
}

const store = createStore(DB_PATH, { maxSnapshots: MAX_SNAPSHOTS })
store.rebuildFromLatest()

function json(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  })
  res.end(JSON.stringify(body))
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
    const device = typeof body?.device === "string" ? body.device : ""
    const result = store.save(payload, device)
    json(res, result.skipped ? 200 : 201, result)
    return
  }

  if (path === "/api/backups" && req.method === "GET") {
    const limit = Math.min(100, Math.max(1, Number(url.searchParams.get("limit") ?? 20)))
    json(res, 200, { backups: store.list(limit) })
    return
  }

  if (path === "/api/backups/latest" && req.method === "GET") {
    const row = store.latest()
    if (!row) {
      json(res, 404, { error: "Aucune sauvegarde sur le serveur." })
      return
    }
    json(res, 200, { backup: store.list(1)[0], payload: JSON.parse(row.payload) })
    return
  }

  const backupMatch = /^\/api\/backups\/(\d+)$/.exec(path)
  if (backupMatch && req.method === "GET") {
    const row = store.byId(Number(backupMatch[1]))
    if (!row) {
      json(res, 404, { error: "Sauvegarde introuvable." })
      return
    }
    json(res, 200, {
      backup: store.list(100).find((backup) => backup.id === row.id),
      payload: JSON.parse(row.payload),
    })
    return
  }

  const entryMatch = /^\/api\/entries\/([a-z]+)$/.exec(path)
  if (entryMatch && req.method === "GET") {
    const table = entryMatch[1]
    if (!isEntryTable(table)) {
      json(res, 404, { error: "Table inconnue." })
      return
    }
    const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 100)))
    const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0))
    json(res, 200, { table, entries: store.entries(table, limit, offset) })
    return
  }

  if (path === "/api/stats" && req.method === "GET") {
    json(res, 200, {
      counts: store.tableCounts(),
      backups: store.backupCount(),
      latest: store.latest()?.created_at ?? null,
    })
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
      store.close()
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
