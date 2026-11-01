import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Button, Input } from "../../react"
import {
  AuthClientError,
  isAuthSession,
  isOtpChallenge,
  type AuthClient,
  type AuthOtpChallenge,
  type AuthResult,
  type AuthUser,
} from "./AuthClient"
import { AuthProvider, useAuth } from "./AuthProvider"

type Step = "signin" | "signup" | "otp" | "forgot" | "reset"

export interface AuthScreenProps {
  /** Client à utiliser hors provider. Sinon, le provider ambiant est utilisé. */
  client?: AuthClient
  appName?: string
  tagline?: string
  logo?: ReactNode
  initialMode?: "signin" | "signup"
  onSuccess?: (user: AuthUser) => void
}

interface Values {
  identifier: string
  email: string
  password: string
  displayName: string
  code: string
}

const EMPTY: Values = {
  identifier: "",
  email: "",
  password: "",
  displayName: "",
  code: "",
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message
  return "Une erreur est survenue. Réessaie dans un instant."
}

/**
 * Écran d'authentification complet : connexion, inscription, code OTP,
 * mot de passe oublié. À placer hors de la coquille applicative (plein écran).
 */
export function AuthScreen(props: AuthScreenProps) {
  if (props.client) {
    const { client, ...rest } = props
    return (
      <AuthProvider client={client}>
        <AuthFlow {...rest} />
      </AuthProvider>
    )
  }
  return <AuthFlow {...props} />
}

function AuthFlow({
  appName = "Aura",
  tagline,
  logo,
  initialMode = "signin",
  onSuccess,
}: Omit<AuthScreenProps, "client">) {
  const auth = useAuth()
  const [step, setStep] = useState<Step>(initialMode)
  const [otpFrom, setOtpFrom] = useState<"signin" | "signup">(initialMode)
  const [values, setValues] = useState<Values>(EMPTY)
  const [challenge, setChallenge] = useState<AuthOtpChallenge | null>(null)
  const [devOtp, setDevOtp] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown((value) => value - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  function change(field: keyof Values) {
    return (event: { target: { value: string } }) => {
      const value = event.target.value
      setValues((current) => ({ ...current, [field]: value }))
    }
  }

  function handleResult(result: AuthResult) {
    if (isAuthSession(result)) {
      onSuccess?.(result.user)
      return
    }

    if (isOtpChallenge(result)) {
      setChallenge(result)
      setDevOtp(result.devOtp ?? null)
      setNotice(`Code envoyé à ${result.emailMasked}.`)
      setValues((current) => ({ ...current, code: "" }))
      setStep("otp")
      setCooldown(30)
      return
    }

    setError(
      "Ce parcours demande de finaliser l'inscription depuis l'écran dédié.",
    )
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return

    setError(null)
    setBusy(true)

    try {
      if (step === "signin") {
        const result = await auth.signIn({
          identifier: values.identifier,
          password: values.password,
        })
        setOtpFrom("signin")
        handleResult(result)
      } else if (step === "signup") {
        const result = await auth.signUp({
          email: values.email,
          password: values.password,
          displayName: values.displayName || undefined,
        })
        setOtpFrom("signup")
        handleResult(result)
      } else if (step === "otp") {
        if (!challenge) return
        const result = await auth.verifyOtp({
          otpToken: challenge.otpToken,
          code: values.code,
        })
        handleResult(result)
      } else if (step === "forgot") {
        await auth.forgotPassword({ email: values.email })
        setNotice(
          `Si un compte existe pour ${values.email}, un code vient d'être envoyé.`,
        )
        setValues((current) => ({ ...current, code: "", password: "" }))
        setStep("reset")
        setCooldown(30)
      } else if (step === "reset") {
        await auth.resetPassword({
          email: values.email,
          code: values.code,
          password: values.password,
        })
        setNotice("Mot de passe mis à jour. Tu peux te connecter.")
        setValues((current) => ({ ...current, code: "", password: "" }))
        setStep("signin")
      }
    } catch (caught) {
      if (caught instanceof AuthClientError && caught.retryAfter) {
        setCooldown(caught.retryAfter)
      }
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  async function resend() {
    if (!challenge || busy || cooldown > 0) return

    setError(null)
    setBusy(true)

    try {
      const next = await auth.resendOtp({ otpToken: challenge.otpToken })
      setChallenge(next)
      setDevOtp(next.devOtp ?? null)
      setNotice(`Nouveau code envoyé à ${next.emailMasked}.`)
      setCooldown(30)
    } catch (caught) {
      if (caught instanceof AuthClientError && caught.retryAfter) {
        setCooldown(caught.retryAfter)
      }
      setError(messageOf(caught))
    } finally {
      setBusy(false)
    }
  }

  function go(next: Step) {
    setError(null)
    setNotice(null)
    setStep(next)
  }

  const copy: Record<Step, { title: string; subtitle: string; submit: string }> = {
    signin: {
      title: "Content de te revoir",
      subtitle: tagline ?? "Connecte-toi pour retrouver tes données.",
      submit: "Se connecter",
    },
    signup: {
      title: "Créer un compte",
      subtitle: "Un code de vérification et c'est parti.",
      submit: "Créer mon compte",
    },
    otp: {
      title: "Vérifie ton email",
      subtitle: challenge
        ? `Code envoyé à ${challenge.emailMasked}.`
        : "Entre le code reçu par email.",
      submit: "Vérifier",
    },
    forgot: {
      title: "Mot de passe oublié",
      subtitle: "Entre ton email : on t'envoie un code de réinitialisation.",
      submit: "Envoyer le code",
    },
    reset: {
      title: "Nouveau mot de passe",
      subtitle: "Saisis le code reçu et choisis un mot de passe.",
      submit: "Changer le mot de passe",
    },
  }

  const current = copy[step]

  return (
    <div className="aura-auth">
      <div className="aura-auth__panel">
        <div className="aura-auth__brand">
          {logo ?? (
            <span className="aura-auth__mark" aria-hidden="true">
              {appName.slice(0, 1).toUpperCase()}
            </span>
          )}
          <span>{appName}</span>
        </div>

        <div className="aura-auth__head">
          <h1 className="aura-h1">{current.title}</h1>
          <p className="aura-muted">{current.subtitle}</p>
        </div>

        {notice ? (
          <p className="aura-auth__notice" role="status">
            {notice}
          </p>
        ) : null}

        <form
          key={step}
          className="aura-auth__form"
          onSubmit={submit}
          noValidate={false}
        >
          {step === "signin" ? (
            <>
              <Input
                label="Email ou pseudo"
                autoComplete="username"
                autoFocus
                required
                value={values.identifier}
                onChange={change("identifier")}
              />
              <Input
                label="Mot de passe"
                type="password"
                autoComplete="current-password"
                required
                value={values.password}
                onChange={change("password")}
              />
            </>
          ) : null}

          {step === "signup" ? (
            <>
              <Input
                label="Nom affiché"
                hint="Optionnel"
                autoComplete="name"
                value={values.displayName}
                onChange={change("displayName")}
              />
              <Input
                label="Email"
                type="email"
                autoComplete="email"
                required
                value={values.email}
                onChange={change("email")}
              />
              <Input
                label="Mot de passe"
                type="password"
                autoComplete="new-password"
                minLength={8}
                hint="8 caractères minimum"
                required
                value={values.password}
                onChange={change("password")}
              />
            </>
          ) : null}

          {step === "otp" ? (
            <>
              <Input
                label="Code à 6 chiffres"
                className="aura-auth__code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
                value={values.code}
                onChange={change("code")}
              />
              {devOtp ? (
                <p className="aura-auth__dev">
                  Code de développement : <strong>{devOtp}</strong>
                </p>
              ) : null}
            </>
          ) : null}

          {step === "forgot" ? (
            <Input
              label="Email"
              type="email"
              autoComplete="email"
              autoFocus
              required
              value={values.email}
              onChange={change("email")}
            />
          ) : null}

          {step === "reset" ? (
            <>
              <Input
                label="Code à 6 chiffres"
                className="aura-auth__code"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                autoComplete="one-time-code"
                autoFocus
                required
                value={values.code}
                onChange={change("code")}
              />
              <Input
                label="Nouveau mot de passe"
                type="password"
                autoComplete="new-password"
                minLength={8}
                hint="8 caractères minimum"
                required
                value={values.password}
                onChange={change("password")}
              />
            </>
          ) : null}

          {error ? (
            <p className="aura-error-text" role="alert">
              {error}
            </p>
          ) : null}

          <Button type="submit" block loading={busy}>
            {current.submit}
          </Button>
        </form>

        <div className="aura-auth__links">
          {step === "signin" ? (
            <>
              <button
                type="button"
                className="aura-auth__link"
                onClick={() => go("signup")}
              >
                Créer un compte
              </button>
              <button
                type="button"
                className="aura-auth__link"
                onClick={() => go("forgot")}
              >
                Mot de passe oublié ?
              </button>
            </>
          ) : null}

          {step === "signup" ? (
            <button
              type="button"
              className="aura-auth__link"
              onClick={() => go("signin")}
            >
              J'ai déjà un compte
            </button>
          ) : null}

          {step === "otp" ? (
            <>
              <button
                type="button"
                className="aura-auth__link"
                onClick={resend}
                disabled={busy || cooldown > 0}
              >
                {cooldown > 0 ? `Renvoyer dans ${cooldown}s` : "Renvoyer le code"}
              </button>
              <button
                type="button"
                className="aura-auth__link"
                onClick={() => go(otpFrom)}
              >
                Changer d'email
              </button>
            </>
          ) : null}

          {step === "forgot" ? (
            <button
              type="button"
              className="aura-auth__link"
              onClick={() => go("signin")}
            >
              Retour à la connexion
            </button>
          ) : null}

          {step === "reset" ? (
            <>
              <button
                type="button"
                className="aura-auth__link"
                onClick={() => go("forgot")}
              >
                Renvoyer un code
              </button>
              <button
                type="button"
                className="aura-auth__link"
                onClick={() => go("signin")}
              >
                Retour à la connexion
              </button>
            </>
          ) : null}
        </div>
      </div>

      <p className="aura-auth__legal">
        Ton email sert uniquement à vérifier ton compte et à sécuriser ta
        connexion.
      </p>
    </div>
  )
}
