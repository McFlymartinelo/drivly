import {
  AlarmClock,
  CalendarClock,
  Check,
  Gauge,
  Pencil,
  RotateCcw,
  StickyNote,
  Trash2,
  Wallet,
  Wrench,
} from "lucide-react"
import { useState, type ReactNode } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import type {
  Checklist,
  Expense,
  Maintenance,
  OdometerReading,
  Reminder,
  Revenue,
  Trip,
} from "../../types"
import { computeReminderStats, reminderStatus } from "../../utils/calculations"
import { formatIsoDateTime, formatKm, formatMoney } from "../../utils/format"
import { recomputeOdometer } from "../../utils/odometer"
import { showError, showToast } from "../../utils/toast"
import { Card } from "../shared/Form"
import { ConfirmDialog } from "../shared/Modal"
import { OverlayScreen } from "../shared/OverlayScreen"

const KINDS = [
  "expense",
  "revenue",
  "maintenance",
  "reading",
  "trip",
  "checklist",
  "reminder",
] as const

type Kind = (typeof KINDS)[number]
type Entry =
  | Expense
  | Revenue
  | Maintenance
  | OdometerReading
  | Trip
  | Checklist
  | Reminder

const CONFIG: Record<
  Kind,
  {
    title: string
    color: "orange" | "teal"
    editPath: (id: string) => string
    /** Formulation correcte pour la confirmation de suppression. */
    deleteTarget: string
    /** Message affiché après suppression. */
    deleted: string
  }
> = {
  expense: {
    title: "Dépense",
    color: "orange",
    editPath: (id) => `/depense/${id}/edit`,
    deleteTarget: "cette dépense",
    deleted: "Dépense supprimée.",
  },
  revenue: {
    title: "Revenu",
    color: "teal",
    editPath: (id) => `/revenu/${id}/edit`,
    deleteTarget: "ce revenu",
    deleted: "Revenu supprimé.",
  },
  maintenance: {
    title: "Entretien",
    color: "orange",
    editPath: (id) => `/entretien/${id}/edit`,
    deleteTarget: "cet entretien",
    deleted: "Entretien supprimé.",
  },
  reading: {
    title: "Relevé",
    color: "orange",
    editPath: (id) => `/releve/${id}/edit`,
    deleteTarget: "ce relevé",
    deleted: "Relevé supprimé.",
  },
  trip: {
    title: "Itinéraire",
    color: "teal",
    editPath: (id) => `/itineraire/${id}/edit`,
    deleteTarget: "cet itinéraire",
    deleted: "Itinéraire supprimé.",
  },
  checklist: {
    title: "Liste de contrôle",
    color: "teal",
    editPath: (id) => `/checklist/${id}/edit`,
    deleteTarget: "cette liste de contrôle",
    deleted: "Liste de contrôle supprimée.",
  },
  reminder: {
    title: "Rappel",
    color: "teal",
    editPath: (id) => `/rappel/${id}/edit`,
    deleteTarget: "ce rappel",
    deleted: "Rappel supprimé.",
  },
}

interface UntypedTable {
  put(value: unknown): Promise<unknown>
  delete(key: string): Promise<unknown>
}

const TABLES: Record<Kind, UntypedTable> = {
  expense: db.expenses as unknown as UntypedTable,
  revenue: db.revenues as unknown as UntypedTable,
  maintenance: db.maintenances as unknown as UntypedTable,
  reading: db.readings as unknown as UntypedTable,
  trip: db.trips as unknown as UntypedTable,
  checklist: db.checklists as unknown as UntypedTable,
  reminder: db.reminders as unknown as UntypedTable,
}

interface Row {
  icon: ReactNode
  label: string
  value: string
  strong?: boolean
}

interface Detail {
  vehicleId: string
  rows: Row[]
  notes?: string
  checklist?: Checklist
  reminder?: Reminder
}

function icon(children: ReactNode) {
  return <span className="[&>svg]:h-4 [&>svg]:w-4">{children}</span>
}

function buildDetail(kind: Kind, entry: Entry, kmActuel: number): Detail {
  const entryDate = "date" in entry ? entry.date : entry.createdAt
  const dateRow: Row = {
    icon: icon(<CalendarClock />),
    label: "Date",
    value: formatIsoDateTime(entryDate),
  }

  switch (kind) {
    case "expense": {
      const item = entry as Expense
      return {
        vehicleId: item.vehicleId,
        notes: item.notes,
        rows: [
          dateRow,
          {
            icon: icon(<Wallet />),
            label: item.categorie,
            value: formatMoney(item.montant),
            strong: true,
          },
          ...(item.kilometrage != null
            ? [{ icon: icon(<Gauge />), label: "Compteur", value: formatKm(item.kilometrage) }]
            : []),
        ],
      }
    }
    case "revenue": {
      const item = entry as Revenue
      return {
        vehicleId: item.vehicleId,
        notes: item.notes,
        rows: [
          dateRow,
          {
            icon: icon(<Wallet />),
            label: item.categorie,
            value: formatMoney(item.montant),
            strong: true,
          },
        ],
      }
    }
    case "maintenance": {
      const item = entry as Maintenance
      return {
        vehicleId: item.vehicleId,
        notes: [item.notes, item.referencesPieces ? `Pièces : ${item.referencesPieces}` : ""]
          .filter(Boolean)
          .join("\n"),
        rows: [
          dateRow,
          {
            icon: icon(<Wrench />),
            label: item.typeEntretien || "Entretien",
            value: formatMoney(item.coutTotal),
            strong: true,
          },
          { icon: icon(<Gauge />), label: "Compteur", value: formatKm(item.kilometrage) },
          { icon: icon(<Wrench />), label: "Réalisé par", value: item.typeIntervention },
        ],
      }
    }
    case "reading": {
      const item = entry as OdometerReading
      return {
        vehicleId: item.vehicleId,
        notes: item.notes,
        rows: [
          dateRow,
          {
            icon: icon(<Gauge />),
            label: "Compteur",
            value: formatKm(item.kilometrage),
            strong: true,
          },
        ],
      }
    }
    case "trip": {
      const item = entry as Trip
      return {
        vehicleId: item.vehicleId,
        notes: item.notes,
        rows: [
          dateRow,
          {
            icon: icon(<Gauge />),
            label: "Trajet",
            value: `${formatKm(item.kmDebut)} → ${formatKm(item.kmFin)}`,
            strong: true,
          },
          {
            icon: icon(<Gauge />),
            label: "Distance",
            value: formatKm(Math.max(0, item.kmFin - item.kmDebut)),
          },
          {
            icon: icon(<StickyNote />),
            label: "Destination",
            value: item.destination || "—",
          },
        ],
      }
    }
    case "checklist": {
      const item = entry as Checklist
      return {
        vehicleId: item.vehicleId,
        rows: [dateRow],
        checklist: item,
      }
    }
    case "reminder": {
      const item = entry as Reminder
      const stats = computeReminderStats(item, kmActuel)
      const status = reminderStatus(item, kmActuel)
      const rows: Row[] = [
        dateRow,
        {
          icon: icon(<AlarmClock />),
          label: item.titre,
          value: item.resolu ? "Résolu" : "En cours",
          strong: true,
        },
      ]
      if (item.kmEcheance != null) {
        rows.push({
          icon: icon(<Gauge />),
          label: "Échéance",
          value: `${formatKm(item.kmEcheance)} · ${
            stats.kmRestants != null && stats.kmRestants < 0 ? "dépassée" : "à venir"
          }`,
        })
      }
      if (status.kmText) {
        rows.push({ icon: icon(<Gauge />), label: "Kilométrage", value: status.kmText })
      }
      if (status.daysText) {
        rows.push({ icon: icon(<CalendarClock />), label: "Délai", value: status.daysText })
      }
      return {
        vehicleId: item.vehicleId,
        notes: item.notes,
        rows,
        reminder: item,
      }
    }
  }
}

export function EntryDetail() {
  const { kind = "", id = "" } = useParams()
  const navigate = useNavigate()
  const app = useApp()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (!KINDS.includes(kind as Kind)) {
    return (
      <OverlayScreen title="Entrée">
        <p className="p-6 text-sm text-muted">Type d'entrée inconnu.</p>
      </OverlayScreen>
    )
  }

  const currentKind = kind as Kind
  const config = CONFIG[currentKind]

  const entry: Entry | undefined = (() => {
    switch (currentKind) {
      case "expense":
        return app.expenses.find((item) => item.id === id)
      case "revenue":
        return app.revenues.find((item) => item.id === id)
      case "maintenance":
        return app.maintenances.find((item) => item.id === id)
      case "reading":
        return app.readings.find((item) => item.id === id)
      case "trip":
        return app.trips.find((item) => item.id === id)
      case "checklist":
        return app.checklists.find((item) => item.id === id)
      case "reminder":
        return app.reminders.find((item) => item.id === id)
    }
  })()

  if (!entry) {
    return (
      <OverlayScreen title={config.title}>
        <p className="p-6 text-sm text-muted">Entrée introuvable.</p>
      </OverlayScreen>
    )
  }

  const detail = buildDetail(currentKind, entry, app.vehicle?.kmActuel ?? 0)
  const deleteTarget = config.deleteTarget
  const needsOdometer = currentKind !== "checklist" && currentKind !== "reminder"

  async function remove() {
    const snapshot = entry
    try {
      await TABLES[currentKind].delete(id)
      if (needsOdometer) await recomputeOdometer(detail.vehicleId)
      navigate(-1)
      showToast(config.deleted, {
        actionLabel: "Annuler",
        duration: 7000,
        onAction: () => {
          void (async () => {
            try {
              await TABLES[currentKind].put(snapshot)
              if (needsOdometer) await recomputeOdometer(detail.vehicleId)
              showToast("Suppression annulée.", { tone: "success" })
            } catch (error) {
              console.error(error)
              showError("Restauration impossible.")
            }
          })()
        },
      })
    } catch (error) {
      console.error(error)
      showError("Suppression impossible.")
    }
  }

  return (
    <OverlayScreen
      title={config.title}
      color={config.color}
      right={
        <>
          <button
            type="button"
            aria-label="Supprimer"
            className="grid h-11 w-11 place-items-center"
            onClick={() => setConfirmOpen(true)}
          >
            <Trash2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Modifier"
            className="grid h-11 w-11 place-items-center"
            onClick={() => navigate(config.editPath(id))}
          >
            <Pencil className="h-5 w-5" />
          </button>
        </>
      }
    >
      <div className="space-y-4 bg-app px-4 py-4 pb-10">
        <Card className="divide-y divide-line">
          {detail.rows.map((row) => (
            <div key={row.label} className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 shrink-0 text-muted">{row.icon}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted">{row.label}</p>
                <p
                  className={
                    row.strong
                      ? "text-[16px] font-bold text-ink"
                      : "text-[14px] font-medium text-ink"
                  }
                >
                  {row.value}
                </p>
              </div>
            </div>
          ))}
          {detail.notes ? (
            <div className="flex items-start gap-3 px-4 py-3">
              <span className="mt-0.5 shrink-0 text-muted">{icon(<StickyNote />)}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-muted">Notes</p>
                <p className="whitespace-pre-line text-[14px] text-ink">{detail.notes}</p>
              </div>
            </div>
          ) : null}
        </Card>

        {detail.checklist ? (
          <ChecklistBody
            checklist={detail.checklist}
            onToggle={async (itemId) => {
              const currentItems = Array.isArray(detail.checklist!.items)
                ? detail.checklist!.items
                : []
              const items = currentItems.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item,
              )
              await db.checklists.update(detail.checklist!.id, { items })
            }}
            onReset={async () => {
              const currentItems = Array.isArray(detail.checklist!.items)
                ? detail.checklist!.items
                : []
              await db.checklists.update(detail.checklist!.id, {
                items: currentItems.map((item) => ({ ...item, done: false })),
              })
              showToast("Liste réinitialisée.", { tone: "success" })
            }}
          />
        ) : null}

        {detail.reminder && !detail.reminder.resolu ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-2 rounded-full bg-teal py-3 text-[14px] font-bold text-white"
            onClick={() => {
              void db.reminders.update(detail.reminder!.id, { resolu: true })
              showToast("Rappel marqué comme fait.", { tone: "success" })
            }}
          >
            <Check className="h-4 w-4" /> Marquer comme fait
          </button>
        ) : null}
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title={`Supprimer ${deleteTarget} ?`}
        message="Vous pourrez annuler pendant quelques secondes après la suppression."
        confirmLabel="Supprimer"
        destructive
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false)
          void remove()
        }}
      />
    </OverlayScreen>
  )
}

function ChecklistBody({
  checklist,
  onToggle,
  onReset,
}: {
  checklist: Checklist
  onToggle: (itemId: string) => Promise<void>
  onReset: () => Promise<void>
}) {
  const items = Array.isArray(checklist.items) ? checklist.items : []
  const done = items.filter((item) => item.done).length
  const total = items.length
  const percent = total > 0 ? Math.round((done / total) * 100) : 0

  return (
    <Card className="px-4 py-4">
      <div className="flex items-center justify-between">
        <p className="text-[15px] font-bold text-ink">{checklist.titre}</p>
        <span className="text-[12px] font-semibold text-muted">
          {done}/{total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-teal" style={{ width: `${percent}%` }} />
      </div>
      <ul className="mt-3 space-y-1">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-lg px-1 py-2 text-left"
              onClick={() => void onToggle(item.id)}
              aria-pressed={item.done}
            >
              <span
                className={`grid h-5 w-5 shrink-0 place-items-center rounded border ${
                  item.done ? "border-teal bg-teal text-white" : "border-line bg-white"
                }`}
              >
                {item.done ? <Check className="h-3.5 w-3.5" /> : null}
              </span>
              <span
                className={`text-[14px] ${
                  item.done ? "text-muted line-through" : "text-ink"
                }`}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {done > 0 ? (
        <button
          type="button"
          className="mt-2 flex items-center gap-2 text-[12px] font-medium text-muted"
          onClick={() => void onReset()}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Tout décocher
        </button>
      ) : null}
    </Card>
  )
}
