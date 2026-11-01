import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  isAuthSession,
  type AuthClient,
  type AuthOtpChallenge,
  type AuthResult,
  type AuthUser,
  type LoginInput,
  type RegisterInput,
  type ResetPasswordInput,
  type UpdateProfileInput,
  type VerifyOtpInput,
} from "./AuthClient"

export type AuthStatus = "loading" | "anonymous" | "authenticated"

export interface AuthContextValue {
  client: AuthClient
  user: AuthUser | null
  status: AuthStatus
  error: string | null
  signIn: (input: LoginInput) => Promise<AuthResult>
  signUp: (input: RegisterInput) => Promise<AuthResult>
  verifyOtp: (input: VerifyOtpInput) => Promise<AuthResult>
  resendOtp: (input: { otpToken: string }) => Promise<AuthOtpChallenge>
  forgotPassword: (input: { email: string }) => Promise<void>
  resetPassword: (input: ResetPasswordInput) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  changePassword: (input: {
    currentPassword: string
    newPassword: string
  }) => Promise<void>
  updateProfile: (input: UpdateProfileInput) => Promise<void>
  clearError: () => void
}

export interface AuthProviderProps {
  client: AuthClient
  children: ReactNode
  onAuthChange?: (user: AuthUser | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({
  client,
  children,
  onAuthChange,
}: AuthProviderProps) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [status, setStatus] = useState<AuthStatus>("loading")
  const [error, setError] = useState<string | null>(null)

  const apply = useCallback(
    (result: AuthResult) => {
      if (isAuthSession(result)) {
        setUser(result.user)
        setStatus("authenticated")
        onAuthChange?.(result.user)
      }
      return result
    },
    [onAuthChange],
  )

  const guard = useCallback(async function guard<T>(
    run: () => Promise<T>,
  ): Promise<T> {
    setError(null)
    try {
      return await run()
    } catch (caught) {
      const message =
        caught instanceof Error
          ? caught.message
          : "Une erreur est survenue. Réessaie dans un instant."
      setError(message)
      throw caught
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const current = await client.me()
      setUser(current)
      setStatus(current ? "authenticated" : "anonymous")
      onAuthChange?.(current)
    } catch {
      setUser(null)
      setStatus("anonymous")
      onAuthChange?.(null)
    }
  }, [client, onAuthChange])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const signIn = useCallback(
    (input: LoginInput) =>
      guard(async () => apply(await client.login(input))),
    [apply, client, guard],
  )

  const signUp = useCallback(
    (input: RegisterInput) =>
      guard(async () => apply(await client.register(input))),
    [apply, client, guard],
  )

  const verifyOtp = useCallback(
    (input: VerifyOtpInput) =>
      guard(async () => apply(await client.verifyOtp(input))),
    [apply, client, guard],
  )

  const resendOtp = useCallback(
    (input: { otpToken: string }) =>
      guard(async () => client.resendOtp(input)),
    [client, guard],
  )

  const forgotPassword = useCallback(
    async (input: { email: string }) => {
      await guard(async () => client.forgotPassword(input))
    },
    [client, guard],
  )

  const resetPassword = useCallback(
    async (input: ResetPasswordInput) => {
      await guard(async () => client.resetPassword(input))
    },
    [client, guard],
  )

  const signOut = useCallback(async () => {
    await guard(async () => client.logout())
    setUser(null)
    setStatus("anonymous")
    onAuthChange?.(null)
  }, [client, guard, onAuthChange])

  const changePassword = useCallback(
    async (input: { currentPassword: string; newPassword: string }) => {
      await guard(async () => {
        await client.changePassword(input)
        const current = await client.me()
        setUser(current)
      })
    },
    [client, guard],
  )

  const updateProfile = useCallback(
    async (input: UpdateProfileInput) => {
      await guard(async () => {
        const result = await client.updateProfile(input)
        setUser(result.user)
        onAuthChange?.(result.user)
      })
    },
    [client, guard, onAuthChange],
  )

  const clearError = useCallback(() => setError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      client,
      user,
      status,
      error,
      signIn,
      signUp,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      signOut,
      refresh,
      changePassword,
      updateProfile,
      clearError,
    }),
    [
      client,
      user,
      status,
      error,
      signIn,
      signUp,
      verifyOtp,
      resendOtp,
      forgotPassword,
      resetPassword,
      signOut,
      refresh,
      changePassword,
      updateProfile,
      clearError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth doit être utilisé dans <AuthProvider>")
  }
  return context
}
