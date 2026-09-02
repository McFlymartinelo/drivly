import { AlarmClock, Check, Fuel, Plus, Trash2 } from "lucide-react"
import { useNavigate } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import { computeReminderStats } from "../../utils/calculations"
import { formatDayMonth, formatKm } from "../../utils/format"

export function RemindersScreen() {
  const { reminders, vehicle } = useApp()
  const navigate = useNavigate()
  const km = vehicle?.kmActuel ?? 0
  const open = reminders.filter((r) => !r.resolu)
  const done = reminders.filter((r) => r.resolu)

  return (
    <div className="px-4 py-4 pb-8">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-bold uppercase tracking-wider text-muted">À venir</h2>
        <button
          type="button"
          className="grid h-9 w-9 place-items-center rounded-full bg-teal text-white"
          onClick={() => navigate("/rappel/nouveau")}
          aria-label="Nouveau rappel"
        >
          <Plus className="h-5 w-5" />
        </button>
      </div>
      <div className="space-y-2">
        {open.length === 0 ? (
          <p className="text-sm text-muted">Aucun rappel actif.</p>
        ) : (
          open.map((r) => {
            const stats = computeReminderStats(r, km)
            return (
              <div key={r.id} className="flex overflow-hidden rounded-xl bg-white shadow-sm">
                <span className="w-1.5 bg-orange" />
                <div className="flex flex-1 items-center gap-3 px-3 py-3">
                  <span className="grid h-10 w-10 place-items-center rounded-full bg-orange text-white">
                    <Fuel className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{r.titre}</p>
                    <p className="text-xs text-muted">
                      {r.kmEcheance != null ? formatKm(r.kmEcheance) : "—"}
                      {r.dateEcheance ? ` · ${formatDayMonth(r.dateEcheance)}` : ""}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-xs">
                      <AlarmClock className="h-3.5 w-3.5 text-emerald-600" />
                      {stats.kmRestants != null ? (
                        <span className="text-emerald-600">Dans {formatKm(Math.max(0, stats.kmRestants))}</span>
                      ) : null}
                      {stats.joursRestants != null ? (
                        <span className="text-orange">
                          {" "}
                          · Dans {stats.joursRestants} jour{stats.joursRestants > 1 ? "s" : ""}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label="Marquer comme fait"
                    className="text-teal"
                    onClick={() => void db.reminders.update(r.id, { resolu: true })}
                  >
                    <Check className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    aria-label="Supprimer"
                    className="text-muted"
                    onClick={() => void db.reminders.delete(r.id)}
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>

      {done.length > 0 ? (
        <>
          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted">Résolus</h2>
          <div className="space-y-2 opacity-60">
            {done.map((r) => (
              <div key={r.id} className="rounded-xl bg-white px-4 py-3 text-sm shadow-sm">
                {r.titre}
              </div>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
