/**
 * Contrat client de l'auth Aura.
 *
 * Le client HTTP fourni parle à l'adaptateur Express ou Web du kit, mais toute
 * implémentation respectant cette interface fonctionne (Supabase, API maison…).
 */

export interface AuthUser {
  id: number
  email: string
  emailVerified: boolean
  displayName: string | null
  username: string | null
  isAdmin: boolean
  createdAt?: string
}

export interface AuthSessionResult {
  user: AuthUser
  token?: string
}

export interface AuthOtpChallenge {
  needsOtp: true
  otpToken: string
  emailMasked: string
  devOtp?: string
}

export interface AuthProfileChallenge {
  needsProfile: true
  email: string
  emailMasked: string
  emailToken: string
}

export type AuthResult =
  | AuthSessionResult
  | AuthOtpChallenge
  | AuthProfileChallenge

export function isAuthSession(result: AuthResult): result is AuthSessionResult {
  return "user" in result
}

export function isOtpChallenge(
  result: AuthResult,
): result is AuthOtpChallenge {
  return "needsOtp" in result
}

export interface RegisterInput {
  email: string
  password: string
  displayName?: string
  username?: string
  emailToken?: string
  /** Code d'inscription si le serveur en exige un. */
  code?: string
}

export interface LoginInput {
  identifier: string
  password: string
}

export interface VerifyOtpInput {
  code: string
  otpToken?: string
  email?: string
}

export interface ResetPasswordInput {
  email: string
  code: string
  password: string
}

export interface UpdateProfileInput {
  displayName?: string
  username?: string
}

export interface AuthClient {
  register(input: RegisterInput): Promise<AuthResult>
  login(input: LoginInput): Promise<AuthResult>
  sendOtp(input: { email: string }): Promise<{
    ok: true
    emailMasked: string
    devOtp?: string
  }>
  verifyOtp(input: VerifyOtpInput): Promise<AuthResult>
  resendOtp(input: { otpToken: string }): Promise<AuthOtpChallenge>
  forgotPassword(input: { email: string }): Promise<{ ok: true }>
  resetPassword(input: ResetPasswordInput): Promise<{ ok: true }>
  changePassword(input: {
    currentPassword: string
    newPassword: string
  }): Promise<{ ok: true; user?: AuthUser }>
  me(): Promise<AuthUser | null>
  updateProfile(input: UpdateProfileInput): Promise<{ user: AuthUser }>
  logout(): Promise<void>
}

export class AuthClientError extends Error {
  readonly status: number
  readonly code: string
  readonly retryAfter?: number

  constructor(
    message: string,
    options: { status: number; code?: string; retryAfter?: number },
  ) {
    super(message)
    this.name = "AuthClientError"
    this.status = options.status
    this.code = options.code ?? "error"
    this.retryAfter = options.retryAfter
  }
}

export interface HttpAuthClientOptions {
  /** Base de l'API. Par défaut `/api/auth`. */
  baseUrl?: string
  /**
   * `cookie` (défaut) : session httpOnly, `credentials: include`.
   * `bearer` : token renvoyé par l'API et stocké côté client (Expo, mobile).
   */
  mode?: "cookie" | "bearer"
  storageKey?: string
  fetch?: typeof fetch
}

interface ErrorPayload {
  error?: string
  code?: string
  retryAfter?: number
}

interface TokenPayload {
  token?: string
}

export function createHttpAuthClient(
  options: HttpAuthClientOptions = {},
): AuthClient {
  const baseUrl = (options.baseUrl ?? "/api/auth").replace(/\/+$/, "")
  const mode = options.mode ?? "cookie"
  const storageKey = options.storageKey ?? "aura_session_token"
  const doFetch = options.fetch ?? globalThis.fetch

  if (typeof doFetch !== "function") {
    throw new Error("createHttpAuthClient : fetch est indisponible")
  }

  function readToken(): string | null {
    if (mode !== "bearer" || typeof localStorage === "undefined") return null
    return localStorage.getItem(storageKey)
  }

  function writeToken(token?: string) {
    if (mode !== "bearer" || typeof localStorage === "undefined") return
    if (token) localStorage.setItem(storageKey, token)
    else localStorage.removeItem(storageKey)
  }

  async function request<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...((init.headers as Record<string, string> | undefined) ?? {}),
    }

    const token = readToken()
    if (token) headers.authorization = `Bearer ${token}`

    const response = await doFetch(`${baseUrl}${path}`, {
      ...init,
      headers,
      credentials: mode === "cookie" ? "include" : "same-origin",
    })

    const payload = (await response.json().catch(() => ({}))) as
      | ErrorPayload
      | (T & TokenPayload)

    if (!response.ok) {
      const error = payload as ErrorPayload
      throw new AuthClientError(
        error.error ?? `Erreur ${response.status}`,
        {
          status: response.status,
          code: error.code,
          retryAfter: error.retryAfter,
        },
      )
    }

    if (mode === "bearer") {
      const tokenPayload = payload as TokenPayload
      if (tokenPayload.token) writeToken(tokenPayload.token)
    }

    return payload as T
  }

  return {
    register: (input) =>
      request<AuthResult>("/register", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    login: (input) =>
      request<AuthResult>("/login", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    sendOtp: (input) =>
      request("/send-otp", { method: "POST", body: JSON.stringify(input) }),

    verifyOtp: (input) =>
      request<AuthResult>("/verify-otp", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    resendOtp: (input) =>
      request<AuthOtpChallenge>("/resend-otp", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    forgotPassword: (input) =>
      request<{ ok: true }>("/forgot-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    resetPassword: (input) =>
      request<{ ok: true }>("/reset-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    changePassword: (input) =>
      request<{ ok: true; user?: AuthUser }>("/change-password", {
        method: "POST",
        body: JSON.stringify(input),
      }),

    async me() {
      try {
        const payload = await request<{ user: AuthUser }>("/me", {
          method: "GET",
        })
        return payload.user
      } catch (error) {
        if (error instanceof AuthClientError && error.status === 401) return null
        throw error
      }
    },

    updateProfile: (input) =>
      request<{ user: AuthUser }>("/me", {
        method: "PATCH",
        body: JSON.stringify(input),
      }),

    async logout() {
      try {
        await request<{ ok: true }>("/logout", { method: "POST" })
      } finally {
        writeToken(undefined)
      }
    },
  }
}
