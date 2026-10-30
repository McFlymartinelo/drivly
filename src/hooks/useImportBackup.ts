import { useCallback, useState } from "react"
import {
  downloadJson,
  exportAll,
  importAll,
  validateExportPayload,
  type ExportPayload,
  type ImportSummary,
} from "../utils/export"
import { showError, showToast } from "../utils/toast"

type Phase = "idle" | "confirm" | "errors"

/**
 * Import en trois temps : validation → aperçu → confirmation, avec export de
 * sécurité automatique. Un mauvais fichier ne peut plus effacer le carnet.
 */
export function useImportBackup(onImported?: (payload: ExportPayload) => void) {
  const [phase, setPhase] = useState<Phase>("idle")
  const [payload, setPayload] = useState<ExportPayload | null>(null)
  const [summary, setSummary] = useState<ImportSummary | null>(null)
  const [errors, setErrors] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const handleFile = useCallback(async (file: File) => {
    setErrors([])
    try {
      const raw = JSON.parse(await file.text()) as unknown
      const result = validateExportPayload(raw)
      if (!result.ok) {
        setErrors(result.errors)
        setPhase("errors")
        return
      }
      setPayload(result.payload)
      setSummary(result.summary)
      setPhase("confirm")
    } catch {
      setErrors([
        "Fichier illisible : ce n'est pas un JSON valide.",
        "Vérifiez que vous avez choisi une sauvegarde Drivly (.json).",
      ])
      setPhase("errors")
    }
  }, [])

  const confirm = useCallback(async () => {
    if (!payload) return
    setBusy(true)
    try {
      const current = await exportAll()
      const hasData =
        current.vehicles.length > 0 ||
        current.refuelings.length > 0 ||
        current.expenses.length > 0
      if (hasData) {
        downloadJson(
          current,
          `drivly-avant-import-${new Date().toISOString().slice(0, 10)}.json`,
        )
      }
      await importAll(payload)
      onImported?.(payload)
      showToast("Sauvegarde importée.", { tone: "success" })
      setPhase("idle")
      setPayload(null)
      setSummary(null)
    } catch (error) {
      console.error(error)
      showError("Import impossible. Vos données actuelles sont intactes.")
    } finally {
      setBusy(false)
    }
  }, [payload, onImported])

  const cancel = useCallback(() => {
    setPhase("idle")
    setPayload(null)
    setSummary(null)
    setErrors([])
  }, [])

  return { phase, summary, errors, busy, handleFile, confirm, cancel }
}
