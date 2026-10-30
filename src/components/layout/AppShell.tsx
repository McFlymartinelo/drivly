import { useState } from "react"
import { Outlet, useLocation } from "react-router-dom"
import { useApp } from "../../hooks/useApp"
import { BottomNav } from "./BottomNav"
import { Header } from "./Header"
import { QuickAddModal } from "./QuickAddModal"
import { VehicleSwitcher } from "./VehicleSwitcher"

export function AppShell() {
  const { quickAddOpen, setQuickAddOpen, search, setSearch } = useApp()
  const [vehiclesOpen, setVehiclesOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const location = useLocation()
  const showSearch = location.pathname === "/"

  return (
    <div className="absolute inset-0 flex flex-col bg-app">
      <Header
        onOpenVehicles={() => setVehiclesOpen(true)}
        onSearch={
          showSearch
            ? () => setSearchOpen((v) => !v)
            : undefined
        }
      />
      {searchOpen && showSearch ? (
        <div className="border-b border-line bg-white px-3 py-2">
          <input
            autoFocus
            type="search"
            aria-label="Rechercher dans l'historique"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher une station, un type…"
            className="w-full rounded-lg bg-app px-3 py-2 text-sm outline-none"
          />
        </div>
      ) : null}
      <main className="min-h-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
      <BottomNav
        quickAddOpen={quickAddOpen}
        onToggleQuickAdd={() => setQuickAddOpen(!quickAddOpen)}
      />
      {quickAddOpen ? <QuickAddModal /> : null}
      <VehicleSwitcher open={vehiclesOpen} onClose={() => setVehiclesOpen(false)} />
    </div>
  )
}
