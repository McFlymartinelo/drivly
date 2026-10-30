import { useLiveQuery } from "dexie-react-hooks"
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { db } from "../db/db"
import type {
  Checklist,
  Expense,
  Maintenance,
  OdometerReading,
  Refueling,
  Reminder,
  Revenue,
  Trip,
  Vehicle,
} from "../types"

const STORAGE_KEY = "drivly.vehicleId"

/** Référence stable pour éviter de recréer un tableau à chaque rendu. */
const EMPTY: never[] = []

interface AppContextValue {
  ready: boolean
  vehicles: Vehicle[]
  vehicle: Vehicle | undefined
  vehicleId: string | undefined
  setVehicleId: (id: string) => void
  refuelings: Refueling[]
  reminders: Reminder[]
  maintenances: Maintenance[]
  expenses: Expense[]
  revenues: Revenue[]
  readings: OdometerReading[]
  trips: Trip[]
  checklists: Checklist[]
  quickAddOpen: boolean
  setQuickAddOpen: (open: boolean) => void
  search: string
  setSearch: (q: string) => void
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const vehiclesQuery = useLiveQuery(() => db.vehicles.toArray())
  const vehicles = vehiclesQuery ?? EMPTY
  const [storedId, setStoredId] = useState<string | null>(() =>
    localStorage.getItem(STORAGE_KEY),
  )
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [search, setSearch] = useState("")

  const vehicleId = storedId && vehicles.some((v) => v.id === storedId)
    ? storedId
    : vehicles[0]?.id

  const setVehicleId = useCallback((id: string) => {
    localStorage.setItem(STORAGE_KEY, id)
    setStoredId(id)
  }, [])

  const vehicle = vehicles.find((v) => v.id === vehicleId)

  const refuelings =
    useLiveQuery(
      () =>
        vehicleId
          ? db.refuelings.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const reminders =
    useLiveQuery(
      () =>
        vehicleId
          ? db.reminders.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const maintenances =
    useLiveQuery(
      () =>
        vehicleId
          ? db.maintenances.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const expenses =
    useLiveQuery(
      () =>
        vehicleId
          ? db.expenses.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const revenues =
    useLiveQuery(
      () =>
        vehicleId
          ? db.revenues.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const readings =
    useLiveQuery(
      () =>
        vehicleId
          ? db.readings.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const trips =
    useLiveQuery(
      () =>
        vehicleId
          ? db.trips.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const checklists =
    useLiveQuery(
      () =>
        vehicleId
          ? db.checklists.where("vehicleId").equals(vehicleId).toArray()
          : [],
      [vehicleId],
    ) ?? EMPTY

  const ready = vehiclesQuery !== undefined

  const value = useMemo(
    () => ({
      ready,
      vehicles,
      vehicle,
      vehicleId,
      setVehicleId,
      refuelings,
      reminders,
      maintenances,
      expenses,
      revenues,
      readings,
      trips,
      checklists,
      quickAddOpen,
      setQuickAddOpen,
      search,
      setSearch,
    }),
    [
      ready,
      vehicles,
      vehicle,
      vehicleId,
      setVehicleId,
      refuelings,
      reminders,
      maintenances,
      expenses,
      revenues,
      readings,
      trips,
      checklists,
      quickAddOpen,
      search,
    ],
  )

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error("useApp must be used within AppProvider")
  return ctx
}
