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
import { HistoryScreen } from "./components/historique/HistoryScreen"
import { AppShell } from "./components/layout/AppShell"
import { MoreScreen } from "./components/plus/MoreScreen"
import { RefuelingDetail } from "./components/plein/RefuelingDetail"
import { RefuelingForm } from "./components/plein/RefuelingForm"
import { RemindersScreen } from "./components/rappels/RemindersScreen"
import { ReportsScreen } from "./components/reports/ReportsScreen"
import { AppProvider } from "./hooks/useApp"

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <div className="flex min-h-dvh justify-center bg-[#cfd8dc]">
          <div className="relative flex h-dvh w-full max-w-[430px] flex-col overflow-hidden bg-app shadow-2xl">
            <Routes>
              <Route element={<AppShell />}>
                <Route path="/" element={<HistoryScreen />} />
                <Route path="/rapports" element={<ReportsScreen />} />
                <Route path="/rappels" element={<RemindersScreen />} />
                <Route path="/plus" element={<MoreScreen />} />
              </Route>
              <Route path="/plein/nouveau" element={<RefuelingForm />} />
              <Route path="/plein/:id" element={<RefuelingDetail />} />
              <Route path="/plein/:id/edit" element={<RefuelingForm />} />
              <Route path="/depense/nouveau" element={<ExpenseForm />} />
              <Route path="/revenu/nouveau" element={<RevenueForm />} />
              <Route path="/entretien/nouveau" element={<MaintenanceForm />} />
              <Route path="/rappel/nouveau" element={<ReminderForm />} />
              <Route path="/releve/nouveau" element={<ReadingForm />} />
              <Route path="/itineraire/nouveau" element={<TripForm />} />
              <Route path="/checklist/nouveau" element={<ChecklistForm />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </div>
        </div>
      </BrowserRouter>
    </AppProvider>
  )
}
