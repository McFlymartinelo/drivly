import { AlertTriangle, Download, RotateCcw, Trash2 } from "lucide-react"
import { Component, type ErrorInfo, type ReactNode } from "react"
import { downloadJson, exportAll } from "../../utils/export"

interface State {
  error: Error | null
}

/**
 * Filet de sécurité global : une donnée corrompue ne doit pas laisser
 * l'utilisateur devant un écran blanc sans moyen d'exporter ou de réparer.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Drivly a rencontré une erreur", error, info.componentStack)
  }

  private reload = () => {
    window.location.reload()
  }

  private exportData = async () => {
    try {
      downloadJson(
        await exportAll(),
        `drivly-secours-${new Date().toISOString().slice(0, 10)}.json`,
      )
    } catch (error) {
      console.error(error)
      window.alert("Export impossible. Vos données restent dans le navigateur.")
    }
  }

  private resetData = () => {
    const ok = window.confirm(
      "Supprimer définitivement toutes les données locales de Drivly ?\n\nExportez d'abord une sauvegarde si possible.",
    )
    if (!ok) return
    window.indexedDB.deleteDatabase("drivly")
    window.location.reload()
  }

  render() {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex min-h-dvh items-center justify-center bg-app p-6">
        <div className="w-full max-w-[430px] rounded-2xl bg-white p-5 shadow-lg">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-full bg-orange-soft text-orange">
              <AlertTriangle className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-[17px] font-bold text-ink">Un écran a planté</h1>
              <p className="text-[13px] text-muted">Vos données sont toujours sur cet appareil.</p>
            </div>
          </div>

          <pre className="mt-4 max-h-32 overflow-auto rounded-lg bg-app p-3 text-[11px] leading-snug text-[#616161]">
            {error.message}
          </pre>

          <div className="mt-4 space-y-2">
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-[14px] font-bold text-white"
              onClick={this.reload}
            >
              <RotateCcw className="h-4 w-4" /> Recharger l'application
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-full border border-line py-3 text-[14px] font-semibold text-ink"
              onClick={() => void this.exportData()}
            >
              <Download className="h-4 w-4" /> Exporter une sauvegarde
            </button>
            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-full py-3 text-[13px] font-medium text-[#c62828]"
              onClick={this.resetData}
            >
              <Trash2 className="h-4 w-4" /> Réinitialiser les données locales
            </button>
          </div>
        </div>
      </div>
    )
  }
}
