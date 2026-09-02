import { ChevronDown, Download, Search, Share2 } from "lucide-react"
import { useLocation } from "react-router-dom"
import { useApp } from "../../hooks/useApp"
import { formatKm } from "../../utils/format"
import { downloadJson, exportAll } from "../../utils/export"
import { CitroenMark } from "../shared/Icons"

export function Header({
  onOpenVehicles,
  onSearch,
}: {
  onOpenVehicles: () => void
  onSearch?: () => void
}) {
  const { vehicle } = useApp()
  const location = useLocation()
  const isReports = location.pathname.startsWith("/rapports")

  async function handleExport() {
    const data = await exportAll()
    downloadJson(data, `drivly-export-${new Date().toISOString().slice(0, 10)}.json`)
  }

  return (
    <header className="sticky top-0 z-30 bg-teal pt-[env(safe-area-inset-top)] text-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onOpenVehicles}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-teal">
            <CitroenMark className="h-6 w-6" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight">
              {vehicle?.marque ?? "Véhicule"}
            </span>
            <span className="block truncate text-[11px] leading-tight text-white/90">
              {vehicle ? `${vehicle.nom} · ${formatKm(vehicle.kmActuel)}` : "Aucun véhicule"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
        </button>
        <button
          type="button"
          aria-label={isReports ? "Partager" : "Exporter"}
          className="grid h-10 w-10 place-items-center"
          onClick={handleExport}
        >
          {isReports ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </button>
        <button
          type="button"
          aria-label="Rechercher"
          className="grid h-10 w-10 place-items-center"
          onClick={onSearch}
        >
          <Search className="h-5 w-5" />
        </button>
      </div>
    </header>
  )
}
