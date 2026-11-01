import { CloudDownload, CloudUpload, Server, Settings2 } from "lucide-react"
import { useEffect, useState } from "react"
import { pushBackupNow, useBackupStatus } from "../../hooks/useServerBackup"
import { formatIsoDateTime } from "../../utils/format"
import {
  clearServerConfig,
  loadServerConfig,
  saveServerConfig,
  type ServerConfig,
} from "../../utils/server"
import { showToast } from "../../utils/toast"
import { Card, Toggle } from "../shared/Form"
import { Modal } from "../shared/Modal"
import { ServerConfigForm } from "./ServerConfigForm"
import { ServerRestoreDialog } from "./ServerRestoreDialog"

function statusText(
  state: ReturnType<typeof useBackupStatus>["state"],
  lastSavedAt: string | null,
  error: string | null,
): string {
  if (state === "disabled") return "Non configurée"
  if (state === "saving") return "Envoi en cours…"
  if (state === "error") return error ?? "Erreur de connexion"
  if (lastSavedAt) return `Dernière sauvegarde : ${formatIsoDateTime(lastSavedAt)}`
  return "Aucune sauvegarde envoyée pour le moment"
}

export function ServerBackupCard() {
  const status = useBackupStatus()
  const [config, setConfig] = useState<ServerConfig | null>(() => loadServerConfig())
  const [configOpen, setConfigOpen] = useState(false)
  const [restoreOpen, setRestoreOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    function sync() {
      setConfig(loadServerConfig())
    }
    window.addEventListener("drivly:server-config", sync)
    return () => window.removeEventListener("drivly:server-config", sync)
  }, [])

  async function saveNow() {
    setBusy(true)
    const result = await pushBackupNow()
    setBusy(false)
    if (result.ok) {
      showToast(
        result.skipped
          ? "Rien à sauvegarder : le serveur a déjà cette version."
          : "Sauvegarde envoyée au serveur.",
        { tone: "success" },
      )
    } else {
      showToast(result.error ?? "Sauvegarde impossible.", { tone: "error" })
    }
  }

  function disable() {
    clearServerConfig()
    setConfig(null)
    showToast("Sauvegarde serveur désactivée.")
  }

  return (
    <>
      <Card className="px-4 py-3">
        <div className="flex items-start gap-3">
          <span
            className={`grid h-9 w-9 shrink-0 place-items-center rounded-full ${
              config ? "bg-teal-soft text-teal-deep" : "bg-slate-100 text-slate-500"
            }`}
          >
            <Server className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="text-[14px] font-semibold text-ink">Sauvegarde serveur</p>
              <span
                className={`h-2 w-2 rounded-full ${
                  status.state === "saved"
                    ? "bg-emerald-500"
                    : status.state === "error"
                      ? "bg-danger"
                      : status.state === "saving"
                        ? "bg-orange"
                        : "bg-slate-300"
                }`}
                aria-hidden
              />
            </div>
            <p
              className={`text-[12px] leading-snug ${
                status.state === "error" ? "text-danger" : "text-muted"
              }`}
            >
              {statusText(status.state, status.lastSavedAt, status.error)}
            </p>
            {config?.email ? (
              <p className="mt-0.5 text-[11px] text-muted">Compte : {config.email}</p>
            ) : null}

            {config ? (
              <>
                <div className="mt-2 flex items-center justify-between rounded-lg bg-app px-2.5 py-1.5">
                  <span className="text-[12px] text-ink">Sauvegarde automatique</span>
                  <Toggle
                    checked={config.auto}
                    onChange={(auto) => {
                      const next = { ...config, auto }
                      saveServerConfig(next)
                      setConfig(next)
                    }}
                  />
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy || status.state === "saving"}
                    className="flex items-center gap-1 rounded-full bg-teal px-3 py-1.5 text-[12px] font-bold text-white disabled:opacity-50"
                    onClick={() => void saveNow()}
                  >
                    <CloudUpload className="h-3.5 w-3.5" />
                    {busy ? "Envoi…" : "Sauvegarder"}
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-full bg-teal-soft px-3 py-1.5 text-[12px] font-bold text-teal-deep"
                    onClick={() => setRestoreOpen(true)}
                  >
                    <CloudDownload className="h-3.5 w-3.5" /> Restaurer
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-1 rounded-full bg-app px-3 py-1.5 text-[12px] font-semibold text-muted"
                    onClick={() => setConfigOpen(true)}
                  >
                    <Settings2 className="h-3.5 w-3.5" /> Configurer
                  </button>
                  <button
                    type="button"
                    className="rounded-full px-2 py-1.5 text-[12px] font-medium text-muted"
                    onClick={disable}
                  >
                    {config.email ? "Se déconnecter" : "Désactiver"}
                  </button>
                </div>
              </>
            ) : (
              <button
                type="button"
                className="mt-2 rounded-full bg-teal px-3 py-1.5 text-[12px] font-bold text-white"
                onClick={() => setConfigOpen(true)}
              >
                Configurer la sauvegarde
              </button>
            )}
          </div>
        </div>
      </Card>

      <Modal
        open={configOpen}
        onClose={() => setConfigOpen(false)}
        title="Sauvegarde serveur"
        description="Connecte l'application à l'API de ton serveur Debian."
      >
        <ServerConfigForm
          initial={config}
          onSaved={(saved) => {
            setConfig(saved)
            setConfigOpen(false)
            void pushBackupNow()
          }}
        />
      </Modal>

      <ServerRestoreDialog open={restoreOpen} onClose={() => setRestoreOpen(false)} />
    </>
  )
}
