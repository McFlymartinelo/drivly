import {
  AlarmClock,
  BarChart3,
  List,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react"
import { NavLink, useLocation } from "react-router-dom"
import { cn } from "../../utils/cn"

const tabs = [
  { to: "/", label: "Historique", icon: List, end: true },
  { to: "/rapports", label: "Rapports", icon: BarChart3, end: false },
  { to: "/rappels", label: "Rappels", icon: AlarmClock, end: false },
  { to: "/plus", label: "Plus", icon: MoreHorizontal, end: false },
] as const

export function BottomNav({
  quickAddOpen,
  onToggleQuickAdd,
}: {
  quickAddOpen: boolean
  onToggleQuickAdd: () => void
}) {
  const location = useLocation()

  return (
    <nav className="relative z-40 border-t border-line bg-white pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-5 items-end px-1 pt-1 pb-1">
        {tabs.slice(0, 2).map((tab) => (
          <TabLink key={tab.to} tab={tab} pathname={location.pathname} />
        ))}
        <div className="relative flex justify-center">
          <button
            type="button"
            aria-label={quickAddOpen ? "Fermer" : "Ajouter"}
            onClick={onToggleQuickAdd}
            className="-mt-7 grid h-14 w-14 place-items-center rounded-full bg-teal text-white shadow-lg shadow-teal/30"
          >
            {quickAddOpen ? <X className="h-7 w-7" strokeWidth={2.5} /> : <Plus className="h-7 w-7" strokeWidth={2.5} />}
          </button>
        </div>
        {tabs.slice(2).map((tab) => (
          <TabLink key={tab.to} tab={tab} pathname={location.pathname} />
        ))}
      </div>
    </nav>
  )
}

function TabLink({
  tab,
  pathname,
}: {
  tab: (typeof tabs)[number]
  pathname: string
}) {
  const active = tab.end ? pathname === tab.to : pathname.startsWith(tab.to)
  const Icon = tab.icon
  return (
    <NavLink
      to={tab.to}
      className="flex flex-col items-center gap-0.5 pb-1 pt-1 text-[11px]"
    >
      <span
        className={cn(
          "grid h-8 w-14 place-items-center rounded-full",
          active ? "bg-teal-soft text-teal" : "text-muted",
        )}
      >
        <Icon className="h-5 w-5" strokeWidth={active ? 2.4 : 2} />
      </span>
      <span className={cn("font-medium", active ? "text-teal" : "text-muted")}>
        {tab.label}
      </span>
    </NavLink>
  )
}
