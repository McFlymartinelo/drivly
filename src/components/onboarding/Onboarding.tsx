import { Car, CloudDownload, Download, Smartphone, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { VEHICLE_ID, loadDemoData } from "../../db/seed"
import { useApp } from "../../hooks/useApp"
import { useImportBackup } from "../../hooks/useImportBackup"
import { showError, showToast } from "../../utils/toast"
import { ImportBackupDialog } from "../shared/ImportDialog"
import { ServerRestoreDialog } from "../serveur/ServerRestoreDialog"

/**
 * Premier lancement : l'utilisateur choisit explicitement entre créer son
 * véhicule ou explorer la démonstration. Aucune donnée d'exemple n'est
 * injectée sans son accord.
 */
export function Onboarding() {
  const navigate = useNavigate()
  const { setVehicleId } = useApp()
  const fileRef = useRef<HTMLInputElement>(null)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const importer = useImportBackup((payload) => {
    const first = payload.vehicles[0]
    if (first) setVehicleId(first.id)
  })

  async function startDemo() {
    try {
      await loadDemoData()
      setVehicleId(VEHICLE_ID)
      showToast("Démonstration chargée. Vous pouvez la supprimer à tout moment.", {
        tone: "success",
        duration: 5000,
      })
    } catch (error) {
      console.error(error)
      showError("Impossible de charger la démonstration.")
    }
  }

  return (
    <div className="flex min-h-full flex-col justify-center px-6 py-10">
      <div className="aura-stagger mx-auto w-full max-w-[360px]">
        <div className="flex items-center gap-3">
          <span className="grid h-14 w-14 place-items-center rounded-[20px] bg-[var(--aura-accent-solid)] text-[var(--aura-on-accent)] shadow-[var(--aura-shadow-accent)]">
            <Car className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="aura-h1">Bienvenue sur Drivly</h1>
            <p className="aura-small mt-1">Votre carnet de bord, hors ligne.</p>
          </div>
        </div>

        <ul className="mt-6 space-y-2.5 text-[13px] leading-snug text-ink-2">
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            Pleins, entretiens, dépenses et rappels au même endroit.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            Consommation réelle, coût au kilomètre et bilan mensuel.
          </li>
          <li className="flex items-start gap-2.5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
            Vos données restent sur cet appareil, sans compte ni serveur.
          </li>
        </ul>

        <div className="mt-7 space-y-2">
          <button
            type="button"
            className="aura-btn aura-btn--primary aura-btn--lg aura-btn--block"
            onClick={() => navigate("/vehicule/nouveau")}
          >
            Créer mon véhicule
          </button>
          <button
            type="button"
            className="aura-btn aura-btn--outline aura-btn--lg aura-btn--block"
            onClick={() => void startDemo()}
          >
            Explorer avec la démonstration
          </button>
          <button
            type="button"
            className="aura-btn aura-btn--ghost aura-btn--block gap-2 !text-[14px] text-teal-deep"
            onClick={() => setRestoreOpen(true)}
          >
            <CloudDownload className="h-4 w-4" /> Restaurer depuis le serveur
          </button>
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 py-2.5 text-[13px] font-medium text-muted"
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" /> Importer une sauvegarde
          </button>
        </div>

        <p className="mt-8 text-center text-[11px] leading-snug text-muted">
          <Smartphone className="mr-1 inline h-3.5 w-3.5 align-[-2px]" />
          Installez Drivly depuis le navigateur pour un accès hors ligne et des
          données conservées durablement.
        </p>

        <p className="mt-1 flex items-center justify-center gap-1 text-center text-[11px] text-muted">
          <Download className="h-3 w-3" /> Pensez à exporter régulièrement.
        </p>

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
        <ServerRestoreDialog open={restoreOpen} onClose={() => setRestoreOpen(false)} />
      </div>
    </div>
  )
}
