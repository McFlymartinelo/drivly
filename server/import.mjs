import { readFileSync } from "node:fs"
import { createStore } from "./store.mjs"
import { normalizePayload } from "./validate.mjs"

const file = process.argv[2]
if (!file) {
  console.error("Usage : node server/import.mjs <sauvegarde.json>")
  process.exit(1)
}

const dbPath = process.env.DRIVLY_DB ?? "/data/drivly.sqlite"
const maxSnapshots = Number(process.env.DRIVLY_MAX_SNAPSHOTS ?? 50)

let payload
try {
  payload = normalizePayload(JSON.parse(readFileSync(file, "utf8")))
} catch (error) {
  console.error(`Import impossible : ${error.message}`)
  process.exit(1)
}

const store = createStore(dbPath, { maxSnapshots })
try {
  const result = store.save(payload, "import CLI")
  console.log(
    JSON.stringify(
      {
        backup: result.backup,
        skipped: result.skipped,
        counts: store.tableCounts(),
      },
      null,
      2,
    ),
  )
} finally {
  store.close()
}
