import { BRANDS, type BrandEntry } from "./catalog"

export const POPULAR_SLUGS = [
  "citroen",
  "peugeot",
  "renault",
  "ds",
  "alpine",
  "dacia",
  "volkswagen",
  "audi",
  "bmw",
  "mercedes-benz",
  "toyota",
  "ford",
  "opel",
  "fiat",
  "hyundai",
  "kia",
  "nissan",
  "honda",
  "seat",
  "skoda",
  "tesla",
  "mini",
  "volvo",
  "porsche",
  "cupra",
  "alfa-romeo",
  "land-rover",
  "jeep",
  "mazda",
  "suzuki",
  "mg",
  "byd",
] as const

const ALIASES: Record<string, string> = {
  vw: "volkswagen",
  volkswagen: "volkswagen",
  mercedes: "mercedes-benz",
  mercedesbenz: "mercedes-benz",
  mb: "mercedes-benz",
  amg: "mercedes-amg",
  rangerover: "land-rover",
  landrover: "land-rover",
  alfa: "alfa-romeo",
  alfaromeo: "alfa-romeo",
  rolls: "rolls-royce",
  rollsroyce: "rolls-royce",
  aston: "aston-martin",
  astonmartin: "aston-martin",
  greatwall: "great-wall",
  dsauto: "ds",
  dsautomobiles: "ds",
  kgm: "ssangyong",
  citroen: "citroen",
  skoda: "skoda",
  bmwm: "bmw-m",
}

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
}

const bySlug = new Map(BRANDS.map((brand) => [brand.slug, brand]))
const byFold = new Map<string, BrandEntry>()
for (const brand of BRANDS) {
  byFold.set(fold(brand.slug), brand)
  byFold.set(fold(brand.name), brand)
}

function fromKey(key: string): BrandEntry | undefined {
  if (!key) return undefined
  const aliased = ALIASES[key]
  if (aliased) return bySlug.get(aliased)
  return byFold.get(key)
}

export function resolveBrand(input: string): BrandEntry | undefined {
  const raw = input.trim()
  if (!raw) return undefined
  const exact = fromKey(fold(raw))
  if (exact) return exact
  const first = raw.split(/[\s/]+/)[0] ?? ""
  return fromKey(fold(first))
}

export function brandLogoUrl(slug: string): string {
  return `https://cdn.jsdelivr.net/gh/filippofilip95/car-logos-dataset@master/logos/thumb/${slug}.png`
}

export function searchBrands(query: string, limit = 40): BrandEntry[] {
  const q = fold(query)
  if (!q) {
    return POPULAR_SLUGS.map((slug) => bySlug.get(slug)).filter(
      (brand): brand is BrandEntry => Boolean(brand),
    )
  }
  const matches: BrandEntry[] = []
  for (const brand of BRANDS) {
    if (fold(brand.name).includes(q) || fold(brand.slug).includes(q)) {
      matches.push(brand)
      if (matches.length >= limit) break
    }
  }
  return matches
}
