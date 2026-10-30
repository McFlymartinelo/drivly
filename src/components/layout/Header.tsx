import { ChevronDown, Download, Search, Share2 } from "lucide-react"
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { useApp } from "../../hooks/useApp"
import { formatKm } from "../../utils/format"
import { exportAll, shareOrDownloadJson } from "../../utils/export"
import { showError, showToast } from "../../utils/toast"
import { BrandLogo } from "../shared/BrandLogo"

export function Header({
  onOpenVehicles,
  onSearch,
}: {
  onOpenVehicles: () => void
  onSearch?: () => void
}) {
  const { vehicle, ready } = useApp()
  const location = useLocation()
  const isReports = location.pathname.startsWith("/rapports")
  const [busy, setBusy] = useState(false)

  async function handleExport() {
    if (busy) return
    setBusy(true)
    try {
      const data = await exportAll()
      const result = await shareOrDownloadJson(
        data,
        `drivly-export-${new Date().toISOString().slice(0, 10)}.json`,
      )
      localStorage.setItem("drivly.lastExport", new Date().toISOString())
      if (result === "shared") showToast("Sauvegarde partagée.", { tone: "success" })
      else if (result === "downloaded") showToast("Sauvegarde exportée.", { tone: "success" })
    } catch (error) {
      console.error(error)
      showError("Export impossible.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <header className="sticky top-0 z-30 bg-teal pt-[env(safe-area-inset-top)] text-white">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={onOpenVehicles}
          className="flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-black/20 px-2 py-1.5 text-left"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white p-1.5 text-teal">
            <BrandLogo marque={vehicle?.marque} className="h-7 w-7" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-bold leading-tight">
              {vehicle?.marque ?? "Véhicule"}
            </span>
            <span className="block truncate text-[11px] leading-tight text-white/90">
              {!ready
                ? "Chargement…"
                : vehicle
                  ? `${vehicle.nom} · ${formatKm(vehicle.kmActuel)}`
                  : "Aucun véhicule"}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 opacity-90" />
        </button>
        <button
          type="button"
          aria-label={isReports ? "Partager la sauvegarde" : "Exporter la sauvegarde"}
          className="grid h-10 w-10 place-items-center disabled:opacity-60"
          onClick={() => void handleExport()}
          disabled={busy}
        >
          {isReports ? <Share2 className="h-5 w-5" /> : <Download className="h-5 w-5" />}
        </button>
        {onSearch ? (
          <button
            type="button"
            aria-label="Rechercher"
            className="grid h-10 w-10 place-items-center"
            onClick={onSearch}
          >
            <Search className="h-5 w-5" />
          </button>
        ) : null}
      </div>
    </header>
  )
}
