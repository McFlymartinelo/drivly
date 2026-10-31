import { lazy, Suspense } from "react"
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import {
  ChecklistForm,
  ExpenseForm,
  MaintenanceForm,
  ReadingForm,
  ReminderForm,
  RevenueForm,
  TripForm,
} from "./components/forms/QuickForms"
import { EntryDetail } from "./components/entree/EntryDetail"
import { HistoryScreen } from "./components/historique/HistoryScreen"
import { AppShell } from "./components/layout/AppShell"
import { MoreScreen } from "./components/plus/MoreScreen"
import { RefuelingDetail } from "./components/plein/RefuelingDetail"
import { RefuelingForm } from "./components/plein/RefuelingForm"
import { RemindersScreen } from "./components/rappels/RemindersScreen"
import { VehicleForm } from "./components/vehicule/VehicleForm"
import { AppProvider } from "./hooks/useApp"
import { AutoBackup } from "./hooks/useServerBackup"

// Recharts pèse l'essentiel du bundle : les rapports sont chargés à la demande.
const ReportsScreen = lazy(() =>
  import("./components/reports/ReportsScreen").then((module) => ({
    default: module.ReportsScreen,
  })),
)

function ScreenFallback() {
  return (
    <div className="grid place-items-center py-16 text-sm text-muted">
      Chargement…
    </div>
  )
}

export default function App() {
  return (
    <AppProvider>
      <AutoBackup />
      <BrowserRouter>
        <div className="flex min-h-dvh justify-center bg-[#cfd8dc]">
          <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-app shadow-2xl">
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<HistoryScreen />} />
                <Route
                  path="/rapports"
                  element={
                    <Suspense fallback={<ScreenFallback />}>
                      <ReportsScreen />
                    </Suspense>
                  }
                />
                <Route path="/rappels" element={<RemindersScreen />} />
                <Route path="/plus" element={<MoreScreen />} />
              </Route>
              <Route path="/plein/nouveau" element={<RefuelingForm />} />
              <Route path="/plein/:id" element={<RefuelingDetail />} />
              <Route path="/plein/:id/edit" element={<RefuelingForm />} />
              <Route path="/depense/nouveau" element={<ExpenseForm />} />
              <Route path="/depense/:id/edit" element={<ExpenseForm />} />
              <Route path="/revenu/nouveau" element={<RevenueForm />} />
              <Route path="/revenu/:id/edit" element={<RevenueForm />} />
              <Route path="/entretien/nouveau" element={<MaintenanceForm />} />
              <Route path="/entretien/:id/edit" element={<MaintenanceForm />} />
              <Route path="/rappel/nouveau" element={<ReminderForm />} />
              <Route path="/rappel/:id/edit" element={<ReminderForm />} />
              <Route path="/releve/nouveau" element={<ReadingForm />} />
              <Route path="/releve/:id/edit" element={<ReadingForm />} />
              <Route path="/itineraire/nouveau" element={<TripForm />} />
              <Route path="/itineraire/:id/edit" element={<TripForm />} />
              <Route path="/checklist/nouveau" element={<ChecklistForm />} />
              <Route path="/checklist/:id/edit" element={<ChecklistForm />} />
              <Route path="/vehicule/nouveau" element={<VehicleForm />} />
              <Route path="/vehicule/:id" element={<VehicleForm />} />
              <Route path="/entree/:kind/:id" element={<EntryDetail />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
