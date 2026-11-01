import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export type ThemeMode = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export interface ThemeContextValue {
  theme: ThemeMode
  resolvedTheme: ResolvedTheme
  accent: string
  setTheme: (theme: ThemeMode) => void
  setAccent: (accent: string) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

function systemPrefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

export interface ThemeProviderProps {
  children: ReactNode
  defaultTheme?: ThemeMode
  defaultAccent?: string
  storageKey?: string
}

export function ThemeProvider({
  children,
  defaultTheme = "system",
  defaultAccent = "teal",
  storageKey = "aura",
}: ThemeProviderProps) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const stored = readStored(`${storageKey}-theme`)
    return stored === "light" || stored === "dark" || stored === "system"
      ? stored
      : defaultTheme
  })
  const [accent, setAccentState] = useState<string>(
    () => readStored(`${storageKey}-accent`) ?? defaultAccent,
  )
  const [systemDark, setSystemDark] = useState(systemPrefersDark)

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)")
    const onChange = (event: MediaQueryListEvent) => setSystemDark(event.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  const resolvedTheme: ResolvedTheme =
    theme === "system" ? (systemDark ? "dark" : "light") : theme

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = resolvedTheme
    root.dataset.accent = accent
    root.style.colorScheme = resolvedTheme
    try {
      window.localStorage.setItem(`${storageKey}-theme`, theme)
      window.localStorage.setItem(`${storageKey}-accent`, accent)
    } catch {
      /* stockage indisponible : on continue sans persistance */
    }
  }, [resolvedTheme, accent, theme, storageKey])

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      accent,
      setTheme: setThemeState,
      setAccent: setAccentState,
      toggleTheme: () =>
        setThemeState(resolvedTheme === "dark" ? "light" : "dark"),
    }),
    [theme, resolvedTheme, accent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const value = useContext(ThemeContext)
  if (!value) {
    throw new Error("useTheme doit être utilisé dans <ThemeProvider>.")
  }
  return value
}
