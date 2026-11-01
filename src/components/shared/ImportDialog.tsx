import { AlertTriangle } from "lucide-react"
import type { useImportBackup } from "../../hooks/useImportBackup"
import { ConfirmDialog, Modal } from "./Modal"

/**
 * Aperçu + confirmation d'un import. Affiche aussi les erreurs de validation
 * au lieu d'écraser silencieusement les données.
 */
export function ImportBackupDialog({
  controller,
}: {
  controller: ReturnType<typeof useImportBackup>
}) {
  const { phase, summary, errors, busy } = controller

  if (phase === "errors") {
    return (
      <Modal
        open
        onClose={controller.cancel}
        title="Sauvegarde refusée"
        description="Le fichier ne correspond pas à une sauvegarde Drivly valide. Aucune donnée n'a été modifiée."
        footer={
          <button
            type="button"
            className="w-full rounded-full bg-teal py-3 text-[14px] font-bold text-white"
            onClick={controller.cancel}
          >
            Fermer
          </button>
        }
      >
        <div className="space-y-2">
          {errors.map((error) => (
            <p
              key={error}
              className="flex items-start gap-2 rounded-lg bg-danger-soft px-3 py-2 text-[13px] text-danger"
            >
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </p>
          ))}
        </div>
      </Modal>
    )
  }

  if (!summary) return null

  return (
    <ConfirmDialog
      open={phase === "confirm"}
      title="Remplacer les données actuelles ?"
      message="Toutes les données présentes sur cet appareil seront remplacées. Une sauvegarde de l'état actuel sera téléchargée automatiquement avant l'import."
      confirmLabel={busy ? "Import…" : "Importer"}
      onCancel={controller.cancel}
      onConfirm={() => {
        if (!busy) void controller.confirm()
      }}
    >
      <div className="space-y-1.5 rounded-lg bg-app px-3 py-3 text-[13px]">
        <Line label="Véhicules" value={summary.vehicles} />
        <Line label="Pleins" value={summary.refuelings} />
        <Line label="Dépenses" value={summary.expenses} />
        <Line label="Revenus" value={summary.revenues} />
        <Line label="Entretiens" value={summary.maintenances} />
        <Line label="Relevés" value={summary.readings} />
        <Line label="Itinéraires" value={summary.trips} />
        <Line label="Rappels" value={summary.reminders} />
        <Line label="Listes de contrôle" value={summary.checklists} />
        <p className="mt-2 border-t border-line pt-2 font-semibold text-ink">
          {summary.entries} entrée{summary.entries > 1 ? "s" : ""} au total
        </p>
      </div>
    </ConfirmDialog>
  )
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  )
}
