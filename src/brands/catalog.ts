import data from "./catalog.json" with { type: "json" }

export interface BrandEntry {
  name: string
  slug: string
}

export const BRANDS: BrandEntry[] = data
