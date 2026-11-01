import { ChevronDown, Download, Loader2, Search, Share2 } from "lucide-react"
import { useState } from "react"
import { useLocation } from "react-router-dom"
import { useApp } from "../../hooks/useApp"
import { formatKmGrouped } from "../../utils/format"
import { exportAll, shareOrDownloadJson } from "../../utils/export"
import { showError, showToast } from "../../utils/toast"
import { BrandLogo } from "../shared/BrandLogo"
import { DrivlyLogo } from "../shared/DrivlyLogo"

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
    <header className="aura-appbar">
      <button
        type="button"
        onClick={onOpenVehicles}
        aria-label="Changer de véhicule"
        className="aura-press flex min-w-0 flex-1 items-center gap-4 rounded-2xl text-left"
      >
        <DrivlyLogo />
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full bg-surface-2 ring-1 ring-black/5">
            <BrandLogo marque={vehicle?.marque} className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold leading-tight tracking-[-0.01em] text-ink">
              {vehicle?.nom ?? "Véhicule"}
            </span>
            <span className="block truncate text-[11px] leading-tight text-muted">
              {!ready
                ? "Chargement…"
                : vehicle
                  ? formatKmGrouped(vehicle.kmActuel)
                  : "Aucun véhicule"}
            </span>
          </span>
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted" />
      </button>

      <button
        type="button"
        aria-label={isReports ? "Partager la sauvegarde" : "Exporter la sauvegarde"}
        className="aura-iconbtn disabled:opacity-50"
        onClick={() => void handleExport()}
        disabled={busy}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : isReports ? (
          <Share2 className="h-5 w-5" />
        ) : (
          <Download className="h-5 w-5" />
        )}
      </button>

      {onSearch ? (
        <button
          type="button"
          aria-label="Rechercher"
          className="aura-iconbtn -mr-1"
          onClick={onSearch}
        >
          <Search className="h-5 w-5" />
        </button>
      ) : null}
    </header>
  )
}
