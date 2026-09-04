import { mkdir, writeFile, readFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import path from "node:path"

const ROOT = path.resolve(import.meta.dirname, "..")
const OUT_DIR = path.join(ROOT, "public", "brands")
const CATALOG_PATH = path.join(ROOT, "src", "brands", "catalog.json")
const BASE =
  "https://raw.githubusercontent.com/filippofilip95/car-logos-dataset/master/logos/thumb"

const CONCURRENCY = 8

async function fetchWithRetry(url, attempts = 4) {
  let lastError
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url)
      if (res.ok) return Buffer.from(await res.arrayBuffer())
      if (res.status === 404) throw new Error("404")
      lastError = new Error(`HTTP ${res.status}`)
    } catch (error) {
      lastError = error
    }
    await new Promise((r) => setTimeout(r, 400 * (i + 1)))
  }
  throw lastError
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"))
  let ok = 0
  let skipped = 0
  let failed = 0
  const missing = []
  let index = 0

  async function worker() {
    while (index < catalog.length) {
      const item = catalog[index++]
      const dest = path.join(OUT_DIR, `${item.slug}.png`)
      if (existsSync(dest)) {
        skipped++
        continue
      }
      try {
        const buf = await fetchWithRetry(`${BASE}/${item.slug}.png`)
        await writeFile(dest, buf)
        ok++
        if ((ok + skipped) % 40 === 0) {
          console.log(`progress ${ok + skipped}/${catalog.length}`)
        }
      } catch (error) {
        failed++
        missing.push(item.slug)
        console.warn(`fail ${item.slug}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }

  await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))
  console.log(JSON.stringify({ total: catalog.length, ok, skipped, failed, missing }))
}

await main()
