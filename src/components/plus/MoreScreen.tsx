import {
  Download,
  HardDrive,
  Pencil,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
  UserPlus,
} from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "../../db/db"
import { VEHICLE_ID, loadDemoData } from "../../db/seed"
import { useApp } from "../../hooks/useApp"
import { useImportBackup } from "../../hooks/useImportBackup"
import { usePwaInstall } from "../../hooks/usePwaInstall"
import { downloadJson, exportAll, shareOrDownloadJson } from "../../utils/export"
import { daysUntil, formatKm } from "../../utils/format"
import {
  ensurePersistentStorage,
  formatBytes,
  getStorageInfo,
  type StorageInfo,
} from "../../utils/storage"
import { showError, showToast } from "../../utils/toast"
import { BrandLogo } from "../shared/BrandLogo"
import { Card } from "../shared/Form"
import { ImportBackupDialog } from "../shared/ImportDialog"
import { ConfirmDialog } from "../shared/Modal"
import { ServerBackupCard } from "../serveur/ServerBackupCard"
import { NotificationsCard } from "./NotificationsCard"

const LAST_EXPORT_KEY = "drivly.lastExport"

function lastExportLabel(): string {
  const raw = localStorage.getItem(LAST_EXPORT_KEY)
  if (!raw) return "Aucune sauvegarde exportée pour l'instant."
  const days = -daysUntil(raw)
  if (days <= 0) return "Dernière sauvegarde : aujourd'hui."
  if (days === 1) return "Dernière sauvegarde : hier."
  return `Dernière sauvegarde : il y a ${days} jours.`
}

export function MoreScreen() {
  const { ready, vehicles, vehicle, setVehicleId } = useApp()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const pwa = usePwaInstall()
  const [storage, setStorage] = useState<StorageInfo>({
    persisted: false,
    usage: null,
    quota: null,
  })
  const [backupLabel, setBackupLabel] = useState(lastExportLabel)
  const [confirm, setConfirm] = useState<
    | { kind: "delete-vehicle"; id: string; name: string }
    | { kind: "demo" }
    | null
  >(null)

  const importer = useImportBackup((payload) => {
    const first = payload.vehicles[0]
    if (first) setVehicleId(first.id)
  })

  useEffect(() => {
    void getStorageInfo().then(setStorage)
  }, [])

  async function handleExport() {
    try {
      const data = await exportAll()
      await shareOrDownloadJson(
        data,
        `drivly-export-${new Date().toISOString().slice(0, 10)}.json`,
      )
      localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
      setBackupLabel(lastExportLabel())
      showToast("Sauvegarde exportée.", { tone: "success" })
    } catch (error) {
      console.error(error)
      showError("Export impossible.")
    }
  }

  async function handleDownload() {
    downloadJson(
      await exportAll(),
      `drivly-export-${new Date().toISOString().slice(0, 10)}.json`,
    )
    localStorage.setItem(LAST_EXPORT_KEY, new Date().toISOString())
    setBackupLabel(lastExportLabel())
  }

  async function activatePersistence() {
    const ok = await ensurePersistentStorage()
    setStorage(await getStorageInfo())
    showToast(
      ok
        ? "Stockage persistant activé : le navigateur ne supprimera plus vos données."
        : "Le navigateur a refusé la persistance. Installez l'application et exportez régulièrement.",
      { tone: ok ? "success" : "error", duration: 6000 },
    )
  }

  async function removeVehicle(id: string) {
    try {
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
      const rest = vehicles.filter((item) => item.id !== id)
      if (rest[0]) setVehicleId(rest[0].id)
      showToast("Véhicule supprimé.")
    } catch (error) {
      console.error(error)
      showError("Suppression impossible.")
    }
  }

  async function resetDemo() {
    try {
      await db.transaction("rw", db.tables, async () => {
        for (const table of db.tables) await table.clear()
      })
      await loadDemoData()
      setVehicleId(VEHICLE_ID)
      showToast("Démonstration rechargée.", { tone: "success" })
    } catch (error) {
      console.error(error)
      showError("Impossible de recharger la démonstration.")
    }
  }

  if (!ready) {
    return (
      <p className="py-16 text-center text-sm text-muted" role="status">
        Chargement…
      </p>
    )
  }

  return (
    <div className="space-y-4 px-4 py-4 pb-10">
      <Card className="divide-y divide-line">
        {vehicles.length === 0 ? (
          <p className="px-4 py-4 text-sm text-muted">Aucun véhicule pour le moment.</p>
        ) : null}
        {vehicles.map((item) => (
          <div key={item.id} className="flex items-center gap-2 px-4 py-3">
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => setVehicleId(item.id)}
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-surface p-1.5 shadow-sm">
                <BrandLogo marque={item.marque} className="h-7 w-7" />
              </span>
              <span className="min-w-0">
                <span className="block font-semibold">{item.nom}</span>
                <span className="block text-xs text-muted">
                  {item.immatriculation || "Sans immatriculation"} · {formatKm(item.kmActuel)}
                  {item.id === vehicle?.id ? " · Actif" : ""}
                </span>
              </span>
            </button>
            <button
              type="button"
              aria-label={`Modifier ${item.nom}`}
              className="grid h-9 w-9 place-items-center text-muted"
              onClick={() => navigate(`/vehicule/${item.id}`)}
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label={`Supprimer ${item.nom}`}
              className="grid h-9 w-9 place-items-center text-muted"
              onClick={() =>
                setConfirm({ kind: "delete-vehicle", id: item.id, name: item.nom })
              }
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left font-medium text-teal-deep"
          onClick={() => navigate("/vehicule/nouveau")}
        >
          <UserPlus className="h-5 w-5 text-teal" /> Ajouter un véhicule
        </button>
      </Card>

      <Card className="divide-y divide-line">
        {pwa.canInstall ? (
          <button
            type="button"
            className="flex w-full items-center gap-3 px-4 py-3 text-left"
            onClick={() => void pwa.install()}
          >
            <Smartphone className="h-5 w-5 text-teal" />
            Installer l'application
          </button>
        ) : null}
        {pwa.installed ? (
          <p className="flex items-center gap-3 px-4 py-3 text-sm text-muted">
            <Smartphone className="h-5 w-5 text-teal" />
            Application installée
          </p>
        ) : null}
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => void handleExport()}
        >
          <Download className="h-5 w-5 text-teal" />
          <span className="flex-1">Exporter / partager (JSON)</span>
          <span className="flex items-center gap-1 text-[11px] text-muted">
            <Save className="h-3.5 w-3.5" /> CSV dans Rapports
          </span>
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-5 w-5 text-teal" />
          Importer une sauvegarde
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => void handleDownload()}
        >
          <Download className="h-5 w-5 text-muted" />
          Télécharger une copie locale
        </button>
        <button
          type="button"
          className="flex w-full items-center gap-3 px-4 py-3 text-left"
          onClick={() => setConfirm({ kind: "demo" })}
        >
          <RotateCcw className="h-5 w-5 text-orange" />
          Recharger la démonstration
        </button>
      </Card>

      <Card className="px-4 py-3">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              storage.persisted ? "bg-teal-soft text-teal-deep" : "bg-orange-soft text-orange"
            }`}
          >
            {storage.persisted ? (
              <ShieldCheck className="h-5 w-5" />
            ) : (
              <HardDrive className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-ink">
              {storage.persisted ? "Stockage protégé" : "Stockage non persistant"}
            </p>
            <p className="text-[12px] leading-snug text-muted">
              {storage.persisted
                ? "Le navigateur s'engage à conserver ces données."
                : "Le navigateur peut supprimer ces données en cas de manque de place."}
              {storage.usage != null ? ` Utilisé : ${formatBytes(storage.usage)}.` : ""}
            </p>
            <p className="mt-1 text-[12px] font-medium text-teal-deep">{backupLabel}</p>
            {!storage.persisted ? (
              <button
                type="button"
                className="mt-2 rounded-full bg-teal px-3 py-1.5 text-[12px] font-bold text-white"
                onClick={() => void activatePersistence()}
              >
                Activer la persistance
              </button>
            ) : null}
          </div>
        </div>
      </Card>

      <NotificationsCard />

      <ServerBackupCard />

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0]
          if (file) void importer.handleFile(file)
          event.target.value = ""
        }}
      />
      <ImportBackupDialog controller={importer} />

      <ConfirmDialog
        open={confirm?.kind === "delete-vehicle"}
        title="Supprimer ce véhicule ?"
        message={`« ${
          confirm?.kind === "delete-vehicle" ? confirm.name : ""
        } » et toutes ses données (pleins, entretiens, dépenses…) seront supprimés définitivement.`}
        confirmLabel="Supprimer"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          if (confirm?.kind === "delete-vehicle") void removeVehicle(confirm.id)
          setConfirm(null)
        }}
      />

      <ConfirmDialog
        open={confirm?.kind === "demo"}
        title="Recharger la démonstration ?"
        message="Toutes les données actuelles seront effacées et remplacées par l'historique de démonstration."
        confirmLabel="Recharger"
        destructive
        onCancel={() => setConfirm(null)}
        onConfirm={() => {
          setConfirm(null)
          void resetDemo()
        }}
      />

      <p className="px-1 text-center text-xs text-muted">
        Drivly · local-first · IndexedDB · usage personnel
      </p>
    </div>
  )
}
