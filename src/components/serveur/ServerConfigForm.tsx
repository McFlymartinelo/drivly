import { Eye, EyeOff, LogIn, Server, ShieldCheck, UserPlus } from "lucide-react"
import { useState } from "react"
import {
  listBackups,
  loginServer,
  normalizeBase,
  registerServer,
  saveServerConfig,
  type ServerConfig,
} from "../../utils/server"
import { showToast } from "../../utils/toast"
import { Toggle } from "../shared/Form"

type Mode = "account" | "token"
type Busy = "login" | "register" | "token" | null

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Connexion impossible."
}

export function ServerConfigForm({
  initial,
  onSaved,
}: {
  initial?: ServerConfig | null
  onSaved: (config: ServerConfig) => void
}) {
  const [mode, setMode] = useState<Mode>(
    initial?.email ? "account" : initial?.token ? "token" : "account",
  )
  const [baseUrl, setBaseUrl] = useState(initial?.baseUrl ?? "/api")
  const [email, setEmail] = useState(initial?.email ?? "")
  const [password, setPassword] = useState("")
  const [serverKey, setServerKey] = useState("")
  const [token, setToken] = useState(initial && !initial.email ? initial.token : "")
  const [auto, setAuto] = useState(initial?.auto ?? true)
  const [showSecrets, setShowSecrets] = useState(false)
  const [busy, setBusy] = useState<Busy>(null)
  const [error, setError] = useState<string | null>(null)

  async function activate(config: ServerConfig) {
    // Teste réellement la session (endpoint protégé) avant d'enregistrer.
    await listBackups(config, 1)
    saveServerConfig(config)
    showToast(
      config.email
        ? `Connecté en tant que ${config.email}.`
        : "Sauvegarde serveur activée.",
      { tone: "success" },
    )
    onSaved(config)
  }

  async function signIn() {
    if (!email.trim() || !password) {
      setError("Entre ton email et ton mot de passe.")
      return
    }
    setBusy("login")
    setError(null)
    try {
      const session = await loginServer(baseUrl, email, password)
      await activate({
        baseUrl: normalizeBase(baseUrl),
        token: session.token,
        email: session.user.email,
        auto,
      })
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  async function createAccount() {
    if (!email.trim() || !password) {
      setError("Entre un email et un mot de passe.")
      return
    }
    if (password.length < 8) {
      setError("Le mot de passe doit contenir au moins 8 caractères.")
      return
    }
    if (!serverKey.trim()) {
      setError("Entre la clé serveur (DRIVLY_TOKEN) pour créer un compte.")
      return
    }
    setBusy("register")
    setError(null)
    try {
      const session = await registerServer(baseUrl, {
        email: email.trim(),
        password,
        code: serverKey.trim(),
      })
      await activate({
        baseUrl: normalizeBase(baseUrl),
        token: session.token,
        email: session.user.email,
        auto,
      })
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  async function saveToken() {
    if (token.trim().length < 16) {
      setError("Le jeton doit contenir au moins 16 caractères.")
      return
    }
    setBusy("token")
    setError(null)
    try {
      await activate({
        baseUrl: normalizeBase(baseUrl),
        token: token.trim(),
        auto,
      })
    } catch (caught) {
      setError(messageOf(caught))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3 rounded-xl bg-app px-3 py-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-teal-soft text-teal-deep">
          <Server className="h-5 w-5" />
        </span>
        <p className="text-[12px] leading-snug text-muted">
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

      <div className="grid grid-cols-2 gap-1 rounded-full bg-app p-1">
        <button
          type="button"
          onClick={() => setMode("account")}
          className={`rounded-full py-1.5 text-[12px] font-semibold ${
            mode === "account" ? "bg-teal-soft text-teal-deep" : "text-muted"
          }`}
        >
          Compte
        </button>
        <button
          type="button"
          onClick={() => setMode("token")}
          className={`rounded-full py-1.5 text-[12px] font-semibold ${
            mode === "token" ? "bg-teal-soft text-teal-deep" : "text-muted"
          }`}
        >
          Jeton
        </button>
      </div>

      {mode === "account" ? (
        <>
          {initial?.email ? (
            <p className="rounded-lg bg-teal-soft px-3 py-2 text-[12px] text-teal-deep">
              Connecté en tant que {initial.email}. Saisis ton mot de passe pour
              renouveler la session.
            </p>
          ) : null}

          <label className="block">
            <span className="text-[12px] text-muted">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="toi@exemple.fr"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-teal"
            />
          </label>

          <label className="block">
            <span className="text-[12px] text-muted">Mot de passe</span>
            <span className="relative mt-1 block">
              <input
                type={showSecrets ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete={initial?.email ? "current-password" : "new-password"}
                placeholder="8 caractères minimum"
                className="w-full rounded-lg border border-line px-3 py-2 pr-10 text-[14px] outline-none focus:border-teal"
              />
              <button
                type="button"
                aria-label={showSecrets ? "Masquer" : "Afficher"}
                className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted"
                onClick={() => setShowSecrets((value) => !value)}
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <label className="block">
            <span className="text-[12px] text-muted">Clé serveur (création de compte)</span>
            <input
              type={showSecrets ? "text" : "password"}
              value={serverKey}
              onChange={(event) => setServerKey(event.target.value)}
              autoComplete="off"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="DRIVLY_TOKEN"
              className="mt-1 w-full rounded-lg border border-line px-3 py-2 text-[14px] outline-none focus:border-teal"
            />
            <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
              <ShieldCheck className="h-3 w-3" />
              Uniquement pour créer un compte. Elle reste sur le serveur (.env).
            </span>
          </label>
        </>
      ) : (
        <label className="block">
          <span className="text-[12px] text-muted">Jeton de sauvegarde</span>
          <span className="relative mt-1 block">
            <input
              type={showSecrets ? "text" : "password"}
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
              aria-label={showSecrets ? "Masquer le jeton" : "Afficher le jeton"}
              className="absolute right-1 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center text-muted"
              onClick={() => setShowSecrets((value) => !value)}
            >
              {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </span>
          <span className="mt-1 flex items-center gap-1 text-[11px] text-muted">
            <ShieldCheck className="h-3 w-3" />
            Il est dans le fichier .env du serveur (DRIVLY_TOKEN).
          </span>
        </label>
      )}

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
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-[12px] text-danger">{error}</p>
      ) : null}

      {mode === "account" ? (
        <div className="space-y-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void signIn()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-[14px] font-bold text-white disabled:opacity-50"
          >
            <LogIn className="h-4 w-4" />
            {busy === "login" ? "Connexion…" : "Se connecter"}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void createAccount()}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-teal-soft py-3 text-[14px] font-bold text-teal-deep disabled:opacity-50"
          >
            <UserPlus className="h-4 w-4" />
            {busy === "register" ? "Création…" : "Créer un compte"}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void saveToken()}
          className="w-full rounded-full bg-teal py-3 text-[14px] font-bold text-white disabled:opacity-50"
        >
          {busy === "token" ? "Connexion…" : "Tester et activer"}
        </button>
      )}
    </div>
  )
}
