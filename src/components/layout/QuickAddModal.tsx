import {
  AlarmClock,
  ClipboardCheck,
  FileSpreadsheet,
  Fuel,
  Route,
  Wallet,
  Wrench,
} from "lucide-react"
import { useNavigate } from "react-router-dom"
import { useApp } from "../../hooks/useApp"

const items = [
  { label: "Rappel", to: "/rappel/nouveau", color: "#7E57C2", Icon: AlarmClock },
  { label: "Liste de contrôle", to: "/checklist/nouveau", color: "#29B6F6", Icon: ClipboardCheck },
  { label: "Relevé", to: "/releve/nouveau", color: "#EC407A", Icon: FileSpreadsheet },
  { label: "Itinéraire", to: "/itineraire/nouveau", color: "#78909C", Icon: Route },
  { label: "Entretien", to: "/entretien/nouveau", color: "#8D6E63", Icon: Wrench },
  { label: "Le revenu", to: "/revenu/nouveau", color: "#43A047", Icon: Wallet },
  { label: "Dépense", to: "/depense/nouveau", color: "#EF5350", Icon: Wallet },
  { label: "Plein", to: "/plein/nouveau", color: "#FFA726", Icon: Fuel },
] as const

export function QuickAddModal() {
  const { setQuickAddOpen } = useApp()
  const navigate = useNavigate()

  return (
    <div className="absolute inset-0 z-30">
      <button
        type="button"
        aria-label="Fermer le menu"
        className="absolute inset-0 bg-black/35"
        onClick={() => setQuickAddOpen(false)}
      />
      <div className="absolute bottom-[84px] left-1/2 w-[210px] -translate-x-1/2">
        <div className="overflow-hidden rounded-xl bg-white py-2 shadow-2xl">
          {items.map((item) => {
            const Icon = item.Icon
            return (
              <button
                key={item.to}
                type="button"
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[15px] text-ink hover:bg-app"
                onClick={() => {
                  setQuickAddOpen(false)
                  navigate(item.to)
                }}
              >
                <span
                  className="grid h-9 w-9 place-items-center rounded-full text-white"
                  style={{ backgroundColor: item.color }}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={2.2} />
                </span>
                {item.label}
              </button>
            )
          })}
        </div>
        <div className="mx-auto h-0 w-0 border-x-[10px] border-t-[10px] border-x-transparent border-t-white" />
      </div>
    </div>
  )
}
