import { CloudDownload, HardDrive, RefreshCw } from "lucide-react"
import { useEffect, useState } from "react"
import { pushBackupNow } from "../../hooks/useServerBackup"
import { useApp } from "../../hooks/useApp"
import {
  downloadJson,
  exportAll,
  importAll,
  validateExportPayload,
} from "../../utils/export"
import { formatBytes } from "../../utils/storage"
import { formatIsoDateTime } from "../../utils/format"
import {
  getBackup,
  listBackups,
  loadServerConfig,
  type BackupMeta,
  type ServerConfig,
} from "../../utils/server"
import { showToast } from "../../utils/toast"
import { ConfirmDialog, Modal } from "../shared/Modal"
import { ServerConfigForm } from "./ServerConfigForm"

/**
 * Liste les sauvegardes du serveur et restaure celle qui est choisie. Un
 * export local est téléchargé avant remplacement, et le contenu est validé.
 */
export function ServerRestoreDialog({
  open,
  onClose,
  onRestored,
}: {
  open: boolean
  onClose: () => void
  onRestored?: () => void
}) {
  const { setVehicleId } = useApp()
  const [config, setConfig] = useState<ServerConfig | null>(null)
  const [backups, setBackups] = useState<BackupMeta[]>([])
  const [selected, setSelected] = useState<number | undefined>()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)

  async function refresh(activeConfig: ServerConfig) {
    setBusy(true)
    setError(null)
    try {
      const list = await listBackups(activeConfig, 20)
      setBackups(list)
      setSelected(list[0]?.id)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Serveur injoignable.")
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!open) return
    const active = loadServerConfig()
    setConfig(active)
    setBackups([])
    setSelected(undefined)
    setError(null)
    setConfirming(false)
    if (active) void refresh(active)
  }, [open])

  async function restore() {
    if (!config || selected == null) return
    setBusy(true)
    setError(null)
    try {
      const result = await getBackup(config, selected)
      const validation = validateExportPayload(result.payload)
      if (!validation.ok) {
        throw new Error(`Sauvegarde invalide : ${validation.errors.join(" ")}`)
      }

      const current = await exportAll()
      const hasData =
        current.vehicles.length > 0 ||
        current.refuelings.length > 0 ||
        current.expenses.length > 0
      if (hasData) {
        downloadJson(
          current,
          `drivly-avant-restauration-${new Date().toISOString().slice(0, 10)}.json`,
        )
      }

      await importAll(validation.payload)
      const firstVehicle = validation.payload.vehicles[0]
      if (firstVehicle) setVehicleId(firstVehicle.id)
      showToast("Sauvegarde restaurée.", { tone: "success" })
      onRestored?.()
      onClose()
    } catch (caught) {
      console.error(caught)
      setError(caught instanceof Error ? caught.message : "Restauration impossible.")
    } finally {
      setBusy(false)
      setConfirming(false)
    }
  }

  if (!open) return null

  if (!config) {
    return (
      <Modal
        open
        onClose={onClose}
        title="Sauvegarde serveur"
        description="Connecte l'app à l'API de ton serveur pour restaurer une sauvegarde."
      >
        <ServerConfigForm
          onSaved={(saved) => {
            setConfig(saved)
            void refresh(saved)
          }}
        />
      </Modal>
    )
  }

  const active = backups.find((backup) => backup.id === selected)

  return (
    <>
      <Modal
        open={!confirming}
        onClose={onClose}
        title="Restaurer une sauvegarde"
        description="Choisis une sauvegarde serveur. Une copie de l'état actuel sera téléchargée avant remplacement."
        footer={
          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-full border border-line py-3 text-[14px] font-semibold text-ink"
              onClick={onClose}
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={busy || selected == null}
              className="flex flex-1 items-center justify-center gap-2 rounded-full bg-teal py-3 text-[14px] font-bold text-white disabled:opacity-50"
              onClick={() => setConfirming(true)}
            >
              <CloudDownload className="h-4 w-4" /> Restaurer
            </button>
          </div>
        }
      >
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[12px] font-medium uppercase tracking-wide text-muted">
              {busy && backups.length === 0
                ? "Chargement…"
                : `${backups.length} sauvegarde${backups.length > 1 ? "s" : ""}`}
            </p>
            <button
              type="button"
              className="flex items-center gap-1 text-[12px] font-semibold text-teal-deep"
              onClick={() => {
                void (async () => {
                  const result = await pushBackupNow()
                  if (result.ok) await refresh(config)
                })()
              }}
            >
              <RefreshCw className="h-3.5 w-3.5" /> Actualiser
            </button>
          </div>

          {busy && backups.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Chargement…</p>
          ) : null}

          {!busy && backups.length === 0 && !error ? (
            <p className="rounded-lg bg-app px-3 py-4 text-center text-[13px] text-muted">
              Aucune sauvegarde sur le serveur pour le moment.
            </p>
          ) : null}

          {backups.map((backup) => {
            const isSelected = backup.id === selected
            const counts = backup.counts
            return (
              <button
                key={backup.id}
                type="button"
                onClick={() => setSelected(backup.id)}
                className={`w-full rounded-xl border px-3 py-2.5 text-left ${
                  isSelected
                    ? "border-teal bg-teal-soft"
                    : "border-line bg-white"
                }`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[14px] font-semibold text-ink">
                    {formatIsoDateTime(backup.createdAt)}
                  </span>
                  <span className="flex items-center gap-1 text-[11px] text-muted">
                    <HardDrive className="h-3 w-3" />
                    {formatBytes(backup.bytes)}
                  </span>
                </div>
                <p className="text-[11px] text-muted">{backup.device || "Appareil inconnu"}</p>
                <p className="mt-0.5 text-[12px] text-[#616161]">
                  {counts.refuelings ?? 0} pleins · {counts.maintenances ?? 0} entretiens ·{" "}
                  {counts.expenses ?? 0} dépenses
                </p>
              </button>
            )
          })}

          {error ? (
            <p className="rounded-lg bg-[#ffebee] px-3 py-2 text-[12px] text-[#b71c1c]">
              {error}
            </p>
          ) : null}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirming}
        title="Remplacer les données actuelles ?"
        message={
          active
            ? `La sauvegarde du ${formatIsoDateTime(active.createdAt)} va remplacer les données de cet appareil. Une copie locale sera téléchargée avant.`
            : "La sauvegarde sélectionnée va remplacer les données de cet appareil."
        }
        confirmLabel={busy ? "Restauration…" : "Restaurer"}
        destructive
        onCancel={() => setConfirming(false)}
        onConfirm={() => {
          if (!busy) void restore()
        }}
      >
        {active ? (
          <p className="rounded-lg bg-app px-3 py-2 text-[12px] text-muted">
            {active.counts.vehicles ?? 0} véhicule(s) · {active.counts.refuelings ?? 0} pleins ·{" "}
            {active.counts.expenses ?? 0} dépenses · {active.counts.reminders ?? 0} rappels
          </p>
        ) : null}
      </ConfirmDialog>
    </>
  )
}
