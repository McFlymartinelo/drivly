import assert from "node:assert/strict"
import { spawn } from "node:child_process"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import test from "node:test"
import { createStore, ENTRIES } from "./store.mjs"

const TOKEN = "integration-token-0123456789"
const PORT = String(4100 + Math.floor(Math.random() * 400))
const BASE = `http://127.0.0.1:${PORT}/api`

function payload(label) {
  return {
    version: 2,
    exportedAt: new Date().toISOString(),
    vehicles: [
      {
        id: "v1",
        nom: label,
        marque: "Test",
        modele: "M",
        immatriculation: "",
        kmInitial: 0,
        kmActuel: 1000,
        carburantDefaut: "Diesel",
        capaciteReservoir: 50,
        createdAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    refuelings: [
      {
        id: "r1",
        vehicleId: "v1",
        date: "2026-01-02T10:00:00.000Z",
        kilometrage: 1000,
        litres: 40,
        prixAuLitre: 1.8,
        coutTotal: 72,
        carburant: "Diesel",
        pleinComplet: true,
        station: "",
        notes: "",
        conducteur: "",
        modePaiement: "",
        createdAt: "2026-01-02T10:00:00.000Z",
      },
    ],
    reminders: [],
    maintenances: [],
    expenses: [],
    revenues: [],
    readings: [],
    trips: [],
    checklists: [],
  }
}

function headers(extra = {}) {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${TOKEN}`,
    ...extra,
  }
}

async function call(path, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: headers(options.headers ?? {}),
  })
  const text = await response.text()
  let body = null
  try {
    body = JSON.parse(text)
  } catch {}
  return { status: response.status, body }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/health`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error("L'API n'a pas démarré.")
}

test("API de sauvegarde", async () => {
  const dir = await mkdtemp(join(tmpdir(), "drivly-api-"))
  const child = spawn(process.execPath, ["server/index.mjs"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      PORT,
      DRIVLY_DB: join(dir, "test.sqlite"),
      DRIVLY_TOKEN: TOKEN,
      DRIVLY_MAX_SNAPSHOTS: "3",
      DRIVLY_CORS_ORIGIN: "",
    },
    stdio: "ignore",
  })

  try {
    await waitForServer()

    assert.equal((await call("/health", { headers: { Authorization: "" } })).status, 200)

    const unauthorized = await fetch(`${BASE}/backups`)
    assert.equal(unauthorized.status, 401)

    const first = await call("/backups", {
      method: "POST",
      body: JSON.stringify({ payload: payload("v1"), device: "test" }),
    })
    assert.equal(first.status, 201)
    assert.equal(first.body.backup.counts.refuelings, 1)
    assert.equal(first.body.backup.counts.vehicles, 1)

    const duplicate = await call("/backups", {
      method: "POST",
      body: JSON.stringify({ payload: payload("v1"), device: "test" }),
    })
    assert.equal(duplicate.status, 200)
    assert.equal(duplicate.body.skipped, true)

    const second = await call("/backups", {
      method: "POST",
      body: JSON.stringify({ payload: payload("v2") }),
    })
    assert.equal(second.status, 201)

    const list = await call("/backups")
    assert.equal(list.body.backups.length, 2)

    const latest = await call("/backups/latest")
    assert.equal(latest.body.payload.vehicles[0].nom, "v2")

    const byId = await call(`/backups/${second.body.backup.id}`)
    assert.equal(byId.body.payload.vehicles[0].nom, "v2")

    const entries = await call("/entries/refuelings?limit=10")
    assert.equal(entries.status, 200)
    assert.equal(entries.body.entries.length, 1)
    assert.equal(entries.body.entries[0].data.litres, 40)
    assert.equal(entries.body.entries[0].data.station, "")

    const stats = await call("/stats")
    assert.equal(stats.body.counts.refuelings, 1)
    assert.equal(stats.body.counts.vehicles, 1)
    assert.equal(stats.body.backups, 2)

    const invalid = await call("/backups", {
      method: "POST",
      body: JSON.stringify({ payload: { version: 99 } }),
    })
    assert.equal(invalid.status, 400)

    for (let index = 0; index < 4; index += 1) {
      await call("/backups", {
        method: "POST",
        body: JSON.stringify({ payload: payload(`v${index + 3}`) }),
      })
    }

    const pruned = await call("/backups?limit=10")
    assert.equal(pruned.body.backups.length, 3)
  } finally {
    child.kill("SIGTERM")
    await new Promise((resolve) => child.once("exit", resolve))
    await rm(dir, { recursive: true, force: true })
  }
})

test("store : tables, déduplication et reconstruction", async () => {
  const dir = await mkdtemp(join(tmpdir(), "drivly-store-"))
  const store = createStore(join(dir, "store.sqlite"), { maxSnapshots: 5 })
  try {
    const first = store.save(payload("v1"), "cli")
    assert.equal(first.skipped, false)
    assert.equal(store.entries("refuelings").length, 1)
    assert.equal(store.entries("refuelings")[0].data.coutTotal, 72)

    const duplicate = store.save(payload("v1"), "cli")
    assert.equal(duplicate.skipped, true)
    assert.equal(store.backupCount(), 1)

    // Simule une base migrée : tables vidées, sauvegarde conservée.
    for (const table of ENTRIES) store.db.exec(`DELETE FROM ${table}`)
    assert.equal(store.entries("refuelings").length, 0)
    assert.equal(store.rebuildFromLatest(), true)
    assert.equal(store.entries("refuelings").length, 1)
    assert.equal(store.entries("vehicles").length, 1)
  } finally {
    store.close()
    await rm(dir, { recursive: true, force: true })
  }
})
