import type { KeyboardEvent, ReactNode } from "react"
import type { CSSProperties } from "react"
import { cn } from "./cn"

export interface TabItem {
  id: string
  label: string
  icon: ReactNode
  /** Pastille numérique (notifications, rappels…). */
  badge?: number | string
  /** Transforme l'onglet en bouton d'action surélevé. */
  cta?: boolean
}

export interface BottomTabsProps {
  items: TabItem[]
  value: string
  onChange: (id: string) => void
  label?: string
  className?: string
  /**
   * `fill` : fond de l'onglet actif (par défaut).
   * `capsule` : pastille pleine qui glisse sous l'onglet actif.
   */
  variant?: "fill" | "capsule"
}

/**
 * Barre d'onglets flottante, accessible au clavier (flèches gauche/droite).
 * Elle vit dans le flux (pas en position fixed) pour rester dans le cadre.
 */
export function BottomTabs({
  items,
  value,
  onChange,
  label = "Navigation principale",
  className,
  variant = "fill",
}: BottomTabsProps) {
  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    const tabs = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    )
    if (tabs.length === 0) return
    const current = tabs.findIndex((tab) => tab === document.activeElement)
    const delta = event.key === "ArrowRight" ? 1 : -1
    const next = (current + delta + tabs.length) % tabs.length
    event.preventDefault()
    tabs[next]?.focus()
    onChange(tabs[next]?.dataset.tabId ?? value)
  }

  return (
    <nav
      className={cn(
        "aura-tabbar",
        variant === "capsule" && "aura-tabbar--capsule",
        className,
      )}
      aria-label={label}
    >
      <div className="aura-tabbar__inner" role="tablist" onKeyDown={onKeyDown}>
        {variant === "capsule" ? (
          <span
            aria-hidden
            className="aura-tabbar__pill"
            style={
              {
                "--aura-tab-index": Math.max(
                  0,
                  items.findIndex((item) => item.id === value),
                ),
                "--aura-tab-count": items.length,
              } as CSSProperties
            }
          />
        ) : null}
        {items.map((item) => {
          const selected = item.id === value
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              data-tab-id={item.id}
              aria-selected={selected}
              tabIndex={selected ? 0 : -1}
              className={cn("aura-tab", item.cta && "aura-tab--cta")}
              onClick={() => onChange(item.id)}
            >
              <span className="aura-tab__icon">{item.icon}</span>
              <span className="aura-tab__label">{item.label}</span>
              {item.badge != null ? (
                <span className="aura-tab__badge">{item.badge}</span>
              ) : null}
            </button>
          )
        })}
      </div>
    </nav>
  )
}
