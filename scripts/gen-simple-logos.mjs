import { writeFileSync } from "node:fs"
import * as icons from "simple-icons/icons"
import catalog from "../src/brands/catalog.json" with { type: "json" }

const byFold = new Map(catalog.map((c) => [c.slug.replace(/-/g, ""), c.slug]))
const extra = {
  citroen: "citroen",
  peugeot: "peugeot",
  rollsroyce: "rolls-royce",
  astonmartin: "aston-martin",
  generalmotors: "general-motors",
}

const hits = []
for (const [exportName, value] of Object.entries(icons)) {
  if (!exportName.startsWith("si") || !value?.slug) continue
  const folded = value.slug.replace(/-/g, "")
  const mapped = extra[folded] === undefined ? byFold.get(folded) : extra[folded]
  if (mapped) hits.push({ exportName, brand: mapped })
}

hits.sort((a, b) => a.brand.localeCompare(b.brand))
const names = [...new Set(hits.map((h) => h.exportName))]

const body = `import {
  ${names.join(",\n  ")},
} from "simple-icons"
import type { SimpleIcon } from "simple-icons"

export const SIMPLE_LOGOS: Record<string, Pick<SimpleIcon, "hex" | "path">> = {
${hits
  .map((h) => `  "${h.brand}": { hex: ${h.exportName}.hex, path: ${h.exportName}.path },`)
  .join("\n")}
}
`

writeFileSync(new URL("../src/brands/simpleLogos.ts", import.meta.url), body)
console.log("wrote", hits.length)
