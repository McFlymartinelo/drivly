import { useMemo, useState } from "react"
import type { BrandEntry } from "../../brands/catalog"
import { searchBrands } from "../../brands/resolve"
import { BrandLogo } from "./BrandLogo"

export function BrandPicker({
  value,
  onChange,
}: {
  value: BrandEntry | null
  onChange: (brand: BrandEntry) => void
}) {
  const [query, setQuery] = useState("")
  const results = useMemo(() => searchBrands(query), [query])

  return (
    <div className="space-y-2">
      {value ? (
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-lg border border-line bg-app px-3 py-2 text-left"
          onClick={() => onChange(value)}
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-white shadow-sm">
            <BrandLogo marque={value.name} className="h-5 w-5" />
          </span>
          <span className="text-sm font-semibold">{value.name}</span>
        </button>
      ) : null}
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={value ? "Changer de marque…" : "Rechercher une marque"}
        className="w-full rounded-lg border border-line px-3 py-2 text-sm outline-none focus:border-teal"
      />
      <div className="max-h-44 overflow-y-auto rounded-xl border border-line">
        {results.map((brand) => (
          <button
            key={brand.slug}
            type="button"
            className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm ${
              value?.slug === brand.slug ? "bg-teal-soft font-semibold" : "hover:bg-app"
            }`}
            onClick={() => {
              onChange(brand)
              setQuery("")
            }}
          >
            <span className="grid h-8 w-8 place-items-center rounded-full bg-white">
              <BrandLogo marque={brand.name} className="h-5 w-5" />
            </span>
            {brand.name}
          </button>
        ))}
        {results.length === 0 ? (
          <p className="px-3 py-2 text-xs text-muted">Aucune marque</p>
        ) : null}
      </div>
    </div>
  )
}
