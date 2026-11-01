import { AlarmClock, Check, Fuel, Pencil, Plus, Sparkles, Trash2 } from "lucide-react"
import { useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import type { Reminder } from "../../types"
import { computeReminderStats, reminderStatus, type ReminderLevel } from "../../utils/calculations"
import { cn, uid } from "../../utils/cn"
import { formatDayMonth, formatIsoDate, formatKmGrouped } from "../../utils/format"
import {
  maintenanceSuggestions,
  type ReminderSuggestion,
} from "../../utils/maintenance"
import { showError, showToast } from "../../utils/toast"
import { Card } from "../shared/Form"

const LEVEL_TEXT: Record<ReminderLevel, string> = {
  ok: "text-muted",
  soon: "text-orange",
  late: "text-danger",
}

const LEVEL_RANK: Record<ReminderLevel, number> = { late: 0, soon: 1, ok: 2 }

export function RemindersScreen() {
  const { ready, reminders, maintenances, vehicle } = useApp()
  const navigate = useNavigate()
  const km = vehicle?.kmActuel ?? 0

  const decorated = useMemo(
    () =>
      reminders
        .filter((reminder) => !reminder.resolu)
        .map((reminder) => {
          const stats = computeReminderStats(reminder, km)
          return {
            reminder,
            status: reminderStatus(reminder, km),
            kmRestants: stats.kmRestants,
            joursRestants: stats.joursRestants,
          }
        })
        .sort((a, b) => {
          const rank = LEVEL_RANK[a.status.level] - LEVEL_RANK[b.status.level]
          if (rank !== 0) return rank
          if (a.kmRestants != null && b.kmRestants != null) {
            return a.kmRestants - b.kmRestants
          }
          if (a.joursRestants != null && b.joursRestants != null) {
            return a.joursRestants - b.joursRestants
          }
          return 0
        }),
    [reminders, km],
  )

  const suggestions = useMemo(
    () => maintenanceSuggestions(maintenances, reminders, vehicle),
    [maintenances, reminders, vehicle],
  )

  const done = reminders.filter((reminder) => reminder.resolu)

  if (!ready) {
    return (
      <p className="py-16 text-center text-sm text-muted" role="status">
        Chargement…
      </p>
    )
  }

  async function plan(suggestion: ReminderSuggestion) {
    if (!vehicle) return
    try {
      await db.reminders.add({
        id: uid(),
        vehicleId: vehicle.id,
        titre: suggestion.titre,
        type: suggestion.titre.toLowerCase().includes("assurance") ? "assurance" : "entretien",
        kmEcheance: suggestion.kmEcheance,
        dateEcheance: suggestion.dateEcheance,
        resolu: false,
        notes: `Suggestion automatique — ${suggestion.reason}`,
        createdAt: new Date().toISOString(),
      })
      showToast("Rappel planifié.", { tone: "success", duration: 3000 })
    } catch (error) {
      console.error(error)
      showError()
    }
  }

  function remove(reminder: Reminder) {
    void (async () => {
      try {
        await db.reminders.delete(reminder.id)
        showToast("Rappel supprimé.", {
          actionLabel: "Annuler",
          duration: 6000,
          onAction: () => {
            void db.reminders.put(reminder)
          },
        })
      } catch (error) {
        console.error(error)
        showError("Suppression impossible.")
      }
    })()
  }

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
        {decorated.length === 0 ? (
          <p className="text-sm text-muted">Aucun rappel actif.</p>
        ) : (
          decorated.map(({ reminder, status }) => (
            <div
              key={reminder.id}
              className="flex overflow-hidden rounded-xl bg-surface shadow-sm"
            >
              <span
                className={`w-1.5 ${
                  status.level === "late"
                    ? "bg-danger"
                    : status.level === "soon"
                      ? "bg-orange"
                      : "bg-teal"
                }`}
              />
              <div className="flex flex-1 items-center gap-2 px-3 py-3">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                  onClick={() => navigate(`/entree/reminder/${reminder.id}`)}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-full text-white ${
                      status.level === "late" ? "bg-danger" : "bg-orange"
                    }`}
                  >
                    <Fuel className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{reminder.titre}</span>
                    <span className="block text-xs text-muted">
                      {reminder.kmEcheance != null ? formatKmGrouped(reminder.kmEcheance) : "—"}
                      {reminder.dateEcheance
                        ? ` · ${formatDayMonth(reminder.dateEcheance)}`
                        : ""}
                    </span>
                    <span className="mt-1 flex items-center gap-1 text-xs">
                      <AlarmClock className={`h-3.5 w-3.5 ${LEVEL_TEXT[status.level]}`} />
                      {status.kmText ? (
                        <span className={LEVEL_TEXT[status.level]}>{status.kmText}</span>
                      ) : null}
                      {status.kmText && status.daysText ? (
                        <span className="text-muted">·</span>
                      ) : null}
                      {status.daysText ? (
                        <span className={LEVEL_TEXT[status.level]}>{status.daysText}</span>
                      ) : null}
                      {!status.kmText && !status.daysText ? (
                        <span className="text-muted">Sans échéance</span>
                      ) : null}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  aria-label="Modifier"
                  className="grid h-8 w-8 place-items-center text-muted"
                  onClick={() => navigate(`/rappel/${reminder.id}/edit`)}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  aria-label="Marquer comme fait"
                  className="grid h-8 w-8 place-items-center text-teal"
                  onClick={() => void db.reminders.update(reminder.id, { resolu: true })}
                >
                  <Check className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  aria-label="Supprimer"
                  className="grid h-8 w-8 place-items-center text-muted"
                  onClick={() => remove(reminder)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {suggestions.length > 0 ? (
        <section className="mt-6">
          <h2 className="mb-2 flex items-center gap-1.5 text-sm font-bold uppercase tracking-wider text-muted">
            <Sparkles className="h-4 w-4 text-teal" /> Suggestions
          </h2>
          <div className="space-y-2">
            {suggestions.map((suggestion) => {
              const overdue =
                (suggestion.kmEcheance != null && suggestion.kmEcheance <= km) ||
                (suggestion.dateEcheance != null &&
                  new Date(suggestion.dateEcheance).getTime() < Date.now())
              return (
                <Card key={suggestion.id} className="flex items-center gap-3 px-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{suggestion.titre}</p>
                    <p className="text-xs text-muted">{suggestion.reason}</p>
                    <p className="mt-0.5 text-xs font-medium text-teal-deep">
                      {suggestion.kmEcheance != null
                        ? `Vers ${formatKmGrouped(suggestion.kmEcheance)}`
                        : ""}
                      {suggestion.kmEcheance != null && suggestion.dateEcheance ? " · " : ""}
                      {suggestion.dateEcheance
                        ? `avant le ${formatIsoDate(suggestion.dateEcheance)}`
                        : ""}
                    </p>
                    <span
                      className={cn(
                        "mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide",
                        overdue
                          ? "bg-danger-soft text-danger"
                          : "bg-orange-soft text-orange",
                      )}
                    >
                      {overdue ? "En retard" : "À planifier"}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="shrink-0 rounded-full bg-teal-soft px-3 py-2 text-[12px] font-bold text-teal-deep"
                    onClick={() => void plan(suggestion)}
                  >
                    Planifier
                  </button>
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}

      {done.length > 0 ? (
        <>
          <h2 className="mb-2 mt-6 text-sm font-bold uppercase tracking-wider text-muted">
            Résolus
          </h2>
          <div className="space-y-2 opacity-60">
            {done.map((reminder) => (
              <button
                key={reminder.id}
                type="button"
                className="w-full rounded-xl bg-surface px-4 py-3 text-left text-sm shadow-sm"
                onClick={() => navigate(`/entree/reminder/${reminder.id}`)}
              >
                {reminder.titre}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  )
}
