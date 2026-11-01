import {
  AlarmClock,
  ClipboardCheck,
  FileSpreadsheet,
  Fuel,
  Route,
  Wallet,
  Wrench,
} from "lucide-react"
import { useEffect, useRef } from "react"
import { useNavigate } from "react-router-dom"
import { useApp } from "../../hooks/useApp"

const items = [
  { label: "Rappel", to: "/rappel/nouveau", color: "oklch(58% 0.15 300)", Icon: AlarmClock },
  { label: "Liste de contrôle", to: "/checklist/nouveau", color: "oklch(60% 0.13 240)", Icon: ClipboardCheck },
  { label: "Relevé", to: "/releve/nouveau", color: "oklch(62% 0.17 355)", Icon: FileSpreadsheet },
  { label: "Itinéraire", to: "/itineraire/nouveau", color: "oklch(55% 0.03 245)", Icon: Route },
  { label: "Entretien", to: "/entretien/nouveau", color: "oklch(52% 0.07 55)", Icon: Wrench },
  { label: "Le revenu", to: "/revenu/nouveau", color: "oklch(58% 0.14 155)", Icon: Wallet },
  { label: "Dépense", to: "/depense/nouveau", color: "oklch(58% 0.18 25)", Icon: Wallet },
  { label: "Plein", to: "/plein/nouveau", color: "oklch(70% 0.15 65)", Icon: Fuel },
] as const

export function QuickAddModal() {
  const { setQuickAddOpen } = useApp()
  const navigate = useNavigate()
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const first = panelRef.current?.querySelector<HTMLButtonElement>("button")
    first?.focus()
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setQuickAddOpen(false)
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [setQuickAddOpen])

  return (
    <div className="absolute inset-0 z-30">
      <button
        type="button"
        tabIndex={-1}
        aria-label="Fermer le menu"
        className="absolute inset-0 bg-[var(--aura-overlay)] backdrop-blur-[2px]"
        onClick={() => setQuickAddOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Ajouter une entrée"
        className="absolute bottom-[108px] left-1/2 w-[214px] -translate-x-1/2"
      >
        <div className="aura-reveal overflow-hidden rounded-2xl border border-line bg-surface py-1.5 shadow-lg">
          {items.map((item) => {
            const Icon = item.Icon
            return (
              <button
                key={item.to}
                type="button"
                className="flex w-full items-center gap-3 px-3.5 py-2.5 text-left text-[14.5px] font-medium text-ink transition-colors hover:bg-surface-2 focus-visible:bg-surface-2"
                onClick={() => {
                  setQuickAddOpen(false)
                  navigate(item.to)
                }}
              >
                <span
                  className="grid h-8 w-8 place-items-center rounded-[10px] text-white"
                  style={{ backgroundColor: item.color }}
                >
                  <Icon className="h-4 w-4" strokeWidth={2.2} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="mx-auto h-0 w-0 border-x-[10px] border-t-[10px] border-x-transparent border-t-[var(--aura-surface)]" />
      </div>
    </div>
  )
}
