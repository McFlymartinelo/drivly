import { Eye, EyeOff, Server, ShieldCheck } from "lucide-react"
import { useState } from "react"
import {
  listBackups,
  normalizeBase,
  saveServerConfig,
  type ServerConfig,
} from "../../utils/server"
import { showToast } from "../../utils/toast"
import { Toggle } from "../shared/Form"

export function ServerConfigForm({
  initial,
  onSaved,
}: {
  initial?: ServerConfig | null
  onSaved: (config: ServerConfig) => void
}) {
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "/api")
  const [token, setToken] = useState(initial?.token ?? "")
  const [auto, setAuto] = useState(initial?.auto ?? true)
  const [showToken, setShowToken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    const config: ServerConfig = {
      baseUrl: normalizeBase(baseUrl),
      token: token.trim(),
      auto,
    }
    if (config.token.length < 16) {
      setError("Le jeton doit contenir au moins 16 caractères.")
      return
    }
    setBusy(true)
    setError(null)
    try {
      // Teste réellement l'authentification (endpoint protégé).
      await listBackups(config, 1)
      saveServerConfig(config)
      showToast("Sauvegarde serveur activée.", { tone: "success" })
      onSaved(config)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Connexion impossible.")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl bg-app px-3 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-teal-deep">
          <Server className="h-5 w-5" />
        </span>
        <p className="text-[12px] leading-snug text-[#616161]">
          Tes données restent d'abord sur cet appareil. Une copie versionnée est
          envoyée sur ton serveur Debian, ce qui permet de restaurer en cas de
          perte ou de changer d'appareil.
        </p>
      </div>

      <label className="block">
        <span className="text-[12px] text-muted">Adresse de l'API</span>
        <input
          value={baseUrl}
          onChange={(event) => setBaseUrl(event.target.value)}
          placeholder="/api"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-teal"
        />
        <span className="mt-1 block text-[11px] text-muted">
          Laisse « /api » si l'app et l'API sont sur le même serveur.
        </span>
      </label>

      <label className="block">
        <span className="text-[12px] text-muted">Jeton de sauvegarde</span>
        <span className="relative mt-1 block">
          <input
            type={showToken ? "text" : "password"}
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="openssl rand -hex 32"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="w-full rounded-lg border border-line px-3 py-2 pr-10 text-[14px] outline-none focus:border-teal"
          />
          <button
            type="button"
            aria-label={showToken ? "Masquer le jeton" : "Afficher le jeton"}
            className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted"
            onClick={() => setShowToken((value) => !value)}
          >
            {showToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </span>
        <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
          <ShieldCheck className="h-3 w-3" />
          Il est dans le fichier .env du serveur (DRIVLY_TOKEN).
        </span>
      </label>

      <div className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
        <div>
          <p className="text-[13px] font-medium text-ink">Sauvegarde automatique</p>
          <p className="text-[11px] text-muted">
            Après chaque modification et quand l'app passe en arrière-plan.
          </p>
        </div>
        <Toggle checked={auto} onChange={setAuto} />
      </div>

      {error ? (
        <p className="rounded-lg bg-[#ffebee] px-3 py-2 text-[12px] text-[#b71c1c]">{error}</p>
      ) : null}

      <button
        type="button"
        disabled={busy}
        onClick={() => void save()}
        className="w-full rounded-full bg-teal py-3 text-[14px] font-bold text-white disabled:opacity-50"
      >
        {busy ? "Connexion…" : "Tester et activer"}
      </button>
    </div>
  )
}
