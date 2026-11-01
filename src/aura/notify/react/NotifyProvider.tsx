import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react"

export type NotifyStyle = "auto" | "instrument" | "banner" | "card"
export type NotifyTone = "info" | "success" | "warn" | "danger"

export interface NotifyAction {
  label: string
  onClick: () => void
}

export interface NotifyOptions {
  title?: string
  message: string
  tone?: NotifyTone
  /** Durée en ms. 0 = persistante jusqu'à fermeture. */
  duration?: number
  action?: NotifyAction
  /** Remplace une notification existante ayant le même tag. */
  tag?: string
  icon?: ReactNode
}

export interface NotifyItem extends NotifyOptions {
  id: string
  createdAt: number
  duration: number
}

export interface NotifyProviderProps {
  children: ReactNode
  /** Style initial. `auto` = instrument sur Android, bandeau sur iOS. */
  style?: NotifyStyle
  position?: "top" | "bottom"
  duration?: number
  max?: number
  appName?: string
  appIcon?: ReactNode
}

export interface NotifyContextValue {
  items: NotifyItem[]
  notify: (options: NotifyOptions) => string
  dismiss: (id: string) => void
  clear: () => void
  style: NotifyStyle
  resolvedStyle: Exclude<NotifyStyle, "auto">
  setStyle: (style: NotifyStyle) => void
}

const NotifyContext = createContext<NotifyContextValue | null>(null)

function isIos(): boolean {
  if (typeof navigator === "undefined") return false
  return (
    /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  )
}

export function resolveNotifyStyle(
  style: NotifyStyle,
): Exclude<NotifyStyle, "auto"> {
  if (style !== "auto") return style
  return isIos() ? "banner" : "instrument"
}

export function NotifyProvider({
  children,
  style: controlledStyle,
  position = "bottom",
  duration = 6000,
  max = 3,
  appName = "Aura",
  appIcon,
}: NotifyProviderProps) {
  const [items, setItems] = useState<NotifyItem[]>([])
  const [internalStyle, setInternalStyle] = useState<NotifyStyle>(
    controlledStyle ?? "auto",
  )
  const timers = useRef(new Map<string, number>())
  const itemsRef = useRef<NotifyItem[]>([])
  const counter = useRef(0)

  const style = controlledStyle ?? internalStyle
  const resolvedStyle = resolveNotifyStyle(style)

  useEffect(() => {
    itemsRef.current = items
  }, [items])

  useEffect(() => {
    const map = timers.current
    return () => {
      for (const timer of map.values()) window.clearTimeout(timer)
      map.clear()
    }
  }, [])

  const clearTimer = useCallback((id: string) => {
    const timer = timers.current.get(id)
    if (timer != null) {
      window.clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const dismiss = useCallback(
    (id: string) => {
      clearTimer(id)
      setItems((current) => current.filter((item) => item.id !== id))
    },
    [clearTimer],
  )

  const notify = useCallback(
    (options: NotifyOptions) => {
      counter.current += 1
      const id = `aura-notify-${Date.now()}-${counter.current}`
      const itemDuration = options.duration ?? duration

      if (options.tag) {
        const existing = itemsRef.current.find(
          (item) => item.tag === options.tag,
        )
        if (existing) clearTimer(existing.id)
      }

      setItems((current) => {
        const withoutTag = options.tag
          ? current.filter((item) => item.tag !== options.tag)
          : current
        const next = [
          ...withoutTag,
          { ...options, id, createdAt: Date.now(), duration: itemDuration },
        ]
        return next.slice(-max)
      })

      if (itemDuration > 0) {
        timers.current.set(
          id,
          window.setTimeout(() => dismiss(id), itemDuration),
        )
      }

      return id
    },
    [clearTimer, dismiss, duration, max],
  )

  const clear = useCallback(() => {
    for (const timer of timers.current.values()) window.clearTimeout(timer)
    timers.current.clear()
    setItems([])
  }, [])

  const setStyle = useCallback(
    (next: NotifyStyle) => {
      setInternalStyle(next)
    },
    [],
  )

  const value = useMemo<NotifyContextValue>(
    () => ({
      items,
      notify,
      dismiss,
      clear,
      style,
      resolvedStyle,
      setStyle,
    }),
    [items, notify, dismiss, clear, style, resolvedStyle, setStyle],
  )

  const effectivePosition = resolvedStyle === "banner" ? "top" : position

  return (
    <NotifyContext.Provider value={value}>
      {children}
      <div
        className="aura-notify-viewport"
        data-style={resolvedStyle}
        data-position={effectivePosition}
        aria-live="polite"
        aria-label="Notifications"
      >
        {items.map((item) => (
          <NotifyCard
            key={item.id}
            item={item}
            style={resolvedStyle}
            appName={appName}
            appIcon={appIcon}
            onDismiss={() => dismiss(item.id)}
          />
        ))}
      </div>
    </NotifyContext.Provider>
  )
}

export function useNotify(): NotifyContextValue {
  const context = useContext(NotifyContext)
  if (!context) {
    throw new Error("useNotify doit être utilisé dans <NotifyProvider>")
  }
  return context
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function ToneIcon({ tone }: { tone: NotifyTone }) {
  if (tone === "success") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 6L9 17l-5-5" />
      </svg>
    )
  }
  if (tone === "warn" || tone === "danger") {
    return (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 9v4M12 17h.01" />
        <path d="M10.3 3.9L2.4 18a2 2 0 0 0 1.7 3h15.8a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
      </svg>
    )
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </svg>
  )
}

function NotifyCard({
  item,
  style,
  appName,
  appIcon,
  onDismiss,
}: {
  item: NotifyItem
  style: Exclude<NotifyStyle, "auto">
  appName: string
  appIcon?: ReactNode
  onDismiss: () => void
}) {
  const tone = item.tone ?? "info"
  const showProgress = item.duration > 0 && style !== "banner"

  return (
    <div className="aura-notify" data-tone={tone} role="status">
      {style === "banner" ? (
        appIcon ?? (
          <span className="aura-notify__mark" aria-hidden="true">
            {appName.slice(0, 1).toUpperCase()}
          </span>
        )
      ) : null}

      {style === "card" ? (
        <span className="aura-notify__mark" aria-hidden="true">
          {item.icon ?? <ToneIcon tone={tone} />}
        </span>
      ) : null}

      <div className="aura-notify__body">
        {style === "banner" ? (
          <div className="aura-notify__app">
            <span>{appName}</span>
            <time>maintenant</time>
          </div>
        ) : null}

        {item.title ? (
          <p
            className={
              style === "instrument"
                ? "aura-notify__kicker"
                : "aura-notify__title"
            }
          >
            {item.title}
          </p>
        ) : null}

        <p className="aura-notify__message">{item.message}</p>
      </div>

      {item.action ? (
        <button
          type="button"
          className="aura-notify__action"
          onClick={() => {
            item.action?.onClick()
            onDismiss()
          }}
        >
          {item.action.label}
        </button>
      ) : null}

      <button
        type="button"
        className="aura-notify__close"
        aria-label="Fermer la notification"
        onClick={onDismiss}
      >
        <CloseIcon />
      </button>

      {showProgress ? (
        <span
          className="aura-notify__progress"
          aria-hidden="true"
          style={
            {
              "--aura-notify-duration": `${item.duration}ms`,
            } as CSSProperties
          }
        />
      ) : null}
    </div>
  )
}
