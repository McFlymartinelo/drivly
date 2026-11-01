import { LocateFixed, MapPin } from "lucide-react"
import { useState } from "react"

export interface FuelStation {
  id: string
  name: string
  latitude: number
  longitude: number
  distance: number
  address?: string
}

const ZOOM = 15
const TILE_SIZE = 256
const MAP_SIZE = 768

function worldPoint(latitude: number, longitude: number) {
  const scale = TILE_SIZE * 2 ** ZOOM
  const lat = Math.max(-85.0511, Math.min(85.0511, latitude)) * Math.PI / 180
  return {
    x: ((longitude + 180) / 360) * scale,
    y: ((1 - Math.log(Math.tan(lat) + 1 / Math.cos(lat)) / Math.PI) / 2) * scale,
  }
}

function distanceKm(a: number, b: number, c: number, d: number) {
  const rad = Math.PI / 180
  const value = Math.sin((c - a) * rad / 2) ** 2 + Math.cos(a * rad) * Math.cos(c * rad) * Math.sin((d - b) * rad / 2) ** 2
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value))
}

export function StationFinder({ onSelect }: { onSelect: (station: FuelStation) => void }) {
  const [center, setCenter] = useState<{ latitude: number; longitude: number } | null>(null)
  const [stations, setStations] = useState<FuelStation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  function locate() {
    if (!navigator.geolocation) {
      setError("La géolocalisation n'est pas disponible sur cet appareil.")
      return
    }
    setLoading(true)
    setError("")
    navigator.geolocation.getCurrentPosition(async ({ coords }) => {
      const latitude = coords.latitude
      const longitude = coords.longitude
      setCenter({ latitude, longitude })
      try {
        const query = `[out:json][timeout:20];(node[amenity=fuel](around:5000,${latitude},${longitude});way[amenity=fuel](around:5000,${latitude},${longitude}););out center tags;`
        const response = await fetch("https://overpass-api.de/api/interpreter", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
          body: `data=${encodeURIComponent(query)}`,
        })
        if (!response.ok) throw new Error("Recherche indisponible")
        const data = await response.json() as { elements: Array<{ id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> }> }
        const found = data.elements.flatMap((item) => {
          const lat = item.lat ?? item.center?.lat
          const lon = item.lon ?? item.center?.lon
          if (lat == null || lon == null) return []
          const tags = item.tags ?? {}
          const name = tags.name || tags.brand || tags.operator || "Station-service"
          return [{ id: `osm-${item.id}`, name, latitude: lat, longitude: lon, distance: distanceKm(latitude, longitude, lat, lon), address: [tags["addr:street"], tags["addr:housenumber"], tags["addr:city"]].filter(Boolean).join(" ") }]
        }).sort((a, b) => a.distance - b.distance)
        setStations(found)
        if (!found.length) setError("Aucune station trouvée dans un rayon de 5 km.")
      } catch {
        setError("Impossible de récupérer les stations. Vérifiez votre connexion et réessayez.")
      } finally {
        setLoading(false)
      }
    }, () => {
      setLoading(false)
      setError("Position inaccessible. Autorisez la géolocalisation dans votre navigateur.")
    }, { enableHighAccuracy: true, timeout: 12000 })
  }

  const origin = center ? worldPoint(center.latitude, center.longitude) : null
  const centerTileX = origin ? Math.floor(origin.x / TILE_SIZE) : 0
  const centerTileY = origin ? Math.floor(origin.y / TILE_SIZE) : 0

  return (
    <div className="mt-3 space-y-3">
      <button type="button" onClick={locate} disabled={loading} className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-soft px-3 text-sm font-semibold text-teal-deep disabled:opacity-60">
        <LocateFixed className="h-4 w-4" />{loading ? "Recherche autour de vous…" : "Stations autour de moi"}
      </button>
      {error ? <p role="status" className="text-xs text-muted">{error}</p> : null}
      {center && origin ? <>
        <div className="relative aspect-square max-h-60 max-w-60 overflow-hidden rounded-2xl border border-line bg-surface-2" aria-label="Carte des stations-service proches">
          {[-1, 0, 1].flatMap((dx) => [-1, 0, 1].map((dy) => {
            const x = centerTileX + dx
            const y = centerTileY + dy
            const count = 2 ** ZOOM
            const wrappedX = ((x % count) + count) % count
            return <img key={`${x}-${y}`} alt="" loading="lazy" src={`https://tile.openstreetmap.org/${ZOOM}/${wrappedX}/${y}.png`} className="absolute max-w-none" style={{ width: "33.333%", height: "33.333%", left: `calc(50% + ${dx * 33.333 - (origin.x % TILE_SIZE) / 768 * 100 - 16.667}%)`, top: `calc(50% + ${dy * 33.333 - (origin.y % TILE_SIZE) / 768 * 100 - 16.667}%)` }} />
          }))}
          <div className="absolute left-1/2 top-1/2 z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-ink shadow" title="Votre position" />
          {stations.map((station) => {
            const point = worldPoint(station.latitude, station.longitude)
            const left = 50 + (point.x - origin.x) / MAP_SIZE * 100
            const top = 50 + (point.y - origin.y) / MAP_SIZE * 100
            if (left < 0 || left > 100 || top < 0 || top > 100) return null
            return <button key={station.id} type="button" title={station.name} onClick={() => onSelect(station)} className="absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal p-1.5 text-white shadow"><MapPin className="h-4 w-4" /></button>
          })}
          <a className="absolute bottom-1 right-1 z-30 rounded bg-white/85 px-1 text-[9px] text-slate-700" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">© OpenStreetMap</a>
        </div>
        <div className="max-h-36 space-y-1 overflow-y-auto">
          {stations.slice(0, 8).map((station) => <button key={station.id} type="button" onClick={() => onSelect(station)} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-surface-2">
            <span className="min-w-0"><span className="block truncate text-sm font-medium text-ink">{station.name}</span>{station.address ? <span className="block truncate text-xs text-muted">{station.address}</span> : null}</span>
            <span className="shrink-0 text-xs text-muted">{station.distance < 1 ? `${Math.round(station.distance * 1000)} m` : `${station.distance.toFixed(1)} km`}</span>
          </button>)}
        </div>
      </> : null}
    </div>
  )
}
