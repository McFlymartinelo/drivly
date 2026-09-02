import { Download, RotateCcw, Trash2, Upload } from "lucide-react"
import { useRef } from "react"
import { db } from "../../db/db"
import { seedIfEmpty } from "../../db/seed"
import { useApp } from "../../hooks/useApp"
import { downloadJson, exportAll, importAll, type ExportPayload } from "../../utils/export"
import { formatKm } from "../../utils/format"
import { Card } from "../shared/Form"

export function MoreScreen() {
  const { vehicles, vehicle, setVehicleId } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleExport() {
    downloadJson(await exportAll(), `drivly-export-${new Date().toISOString().slice(0, 10)}.json`)
  }

  async function handleImport(file: File) {
    const text = await file.text()
    const payload = JSON.parse(text) as ExportPayload
    await importAll(payload)
  }

  async function resetDemo() {
    if (!confirm("Réinitialiser et recharger les données de démonstration ?")) return
    await db.transaction("rw", db.tables, async () => {
      await Promise.all(db.tables.map((t) => t.clear()))
    })
    await seedIfEmpty()
  }

  async function deleteVehicle(id: string) {
    if (!confirm("Supprimer ce véhicule et toutes ses données ?")) return
    await db.transaction("rw", db.tables, async () => {
      await db.vehicles.delete(id)
      await db.refuelings.where("vehicleId").equals(id).delete()
      await db.reminders.where("vehicleId").equals(id).delete()
      await db.maintenances.where("vehicleId").equals(id).delete()
      await db.expenses.where("vehicleId").equals(id).delete()
      await db.revenues.where("vehicleId").equals(id).delete()
      await db.readings.where("vehicleId").equals(id).delete()
      await db.trips.where("vehicleId").equals(id).delete()
      await db.checklists.where("vehicleId").equals(id).delete()
    })
    const rest = vehicles.filter((v) => v.id !== id)
    if (rest[0]) setVehicleId(rest[0].id)
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <Card className="divide-y divide-line">
        {vehicles.map((v) => (
          <div key={v.id} className="flex items-center justify-between px-4 py-3">
            <button type="button" className="text-left" onClick={() => setVehicleId(v.id)}>
              <p className="font-semibold">{v.nom}</p>
              <p className="text-xs text-muted">
                {v.immatriculation || "Sans immatriculation"} · {formatKm(v.kmActuel)}
                {v.id === vehicle?.id ? " · Actif" : ""}
              </p>
            </button>
            <button type="button" aria-label="Supprimer" className="text-muted" onClick={() => void deleteVehicle(v.id)}>
              <Trash2 className="h-5 w-5" />
            </button>
          </div>
        ))}
      </Card>

      <Card className="divide-y divide-line">
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => void handleExport()}>
          <Download className="h-5 w-5 text-teal" />
          Exporter JSON
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-5 w-5 text-teal" />
          Importer JSON
        </button>
        <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left" onClick={() => void resetDemo()}>
          <RotateCcw className="h-5 w-5 text-orange" />
          Réinitialiser la démo
        </button>
      </Card>
      <input
        ref={fileRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) void handleImport(file)
          e.target.value = ""
        }}
      />
      <p className="px-1 text-center text-xs text-muted">
        Drivly · local-first · IndexedDB · usage personnel
      </p>
    </div>
  )
}
