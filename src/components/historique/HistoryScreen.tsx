import { AlarmClock, ClipboardCheck, Eye, FileSpreadsheet, Fuel, Info, Pencil, Route, Trash2, Wallet, Wrench } from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import type { Refueling, TimelineEvent } from "../../types"
import { computeRefuelingStats, computeReminderStats } from "../../utils/calculations"
import { cn } from "../../utils/cn"
import {
  formatConsumption,
  formatDayMonth,
  formatKm,
  formatLitres,
  formatMoney,
  formatMonthYear,
  formatPricePerLitre,
} from "../../utils/format"

export function HistoryScreen() {
  const {
    vehicle,
    refuelings,
    reminders,
    expenses,
    revenues,
    maintenances,
    readings,
    trips,
    checklists,
    search,
  } = useApp()
  const navigate = useNavigate()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const openReminders = useMemo(
    () => reminders.filter((r) => !r.resolu),
    [reminders],
  )

  const events = useMemo(() => {
    const list: TimelineEvent[] = []
    for (const f of refuelings) {
      list.push({
        id: f.id,
        kind: "refueling",
        date: f.date,
        kilometrage: f.kilometrage,
        title: f.carburant,
        amount: f.coutTotal,
        subtitle: `${formatKm(f.kilometrage)} · ${formatLitres(f.litres)} · ${formatPricePerLitre(f.prixAuLitre)}`,
      })
    }
    for (const e of expenses) {
      list.push({
        id: e.id,
        kind: "expense",
        date: e.date,
        kilometrage: e.kilometrage,
        title: e.categorie,
        amount: e.montant,
        subtitle: e.notes || "Dépense",
      })
    }
    for (const r of revenues) {
      list.push({
        id: r.id,
        kind: "revenue",
        date: r.date,
        kilometrage: r.kilometrage,
        title: r.categorie,
        amount: r.montant,
        subtitle: r.notes || "Revenu",
      })
    }
    for (const m of maintenances) {
      list.push({
        id: m.id,
        kind: "maintenance",
        date: m.date,
        kilometrage: m.kilometrage,
        title: m.typeEntretien || "Entretien",
        amount: m.coutTotal,
        subtitle: m.typeIntervention,
      })
    }
    for (const r of readings) {
      list.push({
        id: r.id,
        kind: "reading",
        date: r.date,
        kilometrage: r.kilometrage,
        title: "Relevé",
        subtitle: formatKm(r.kilometrage),
      })
    }
    for (const t of trips) {
      list.push({
        id: t.id,
        kind: "trip",
        date: t.date,
        kilometrage: t.kmFin,
        title: t.destination || "Itinéraire",
        subtitle: `${formatKm(t.kmDebut)} → ${formatKm(t.kmFin)}`,
      })
    }
    for (const c of checklists) {
      list.push({
        id: c.id,
        kind: "checklist",
        date: c.date,
        title: c.titre,
        subtitle: `${c.items.filter((i) => i.done).length}/${c.items.length} faits`,
      })
    }
    const q = search.trim().toLowerCase()
    return list
      .filter((e) =>
        q
          ? `${e.title} ${e.subtitle}`.toLowerCase().includes(q)
          : true,
      )
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [refuelings, expenses, revenues, maintenances, readings, trips, checklists, search])

  const months = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; items: TimelineEvent[] }>()
    for (const e of events) {
      const key = e.date.slice(0, 7)
      const cur = map.get(key) ?? {
        key,
        label: formatMonthYear(e.date),
        total: 0,
        items: [],
      }
      cur.items.push(e)
      if (e.kind !== "revenue") cur.total += e.amount ?? 0
      else cur.total -= e.amount ?? 0
      map.set(key, cur)
    }
    return [...map.values()]
  }, [events])

  const fillById = (id: string) => refuelings.find((f) => f.id === id)

  return (
    <div className="pb-6">
      <section className="px-4 pt-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Rappels
        </p>
        {openReminders.length === 0 ? (
          <p className="pb-2 text-sm text-muted">Aucun rappel actif</p>
        ) : (
          <div className="space-y-2">
            {openReminders.map((r) => {
              const stats = computeReminderStats(r, vehicle?.kmActuel ?? 0)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate("/rappels")}
                  className="flex w-full overflow-hidden rounded-xl border border-line bg-white text-left shadow-sm"
                >
                  <span className="w-1.5 bg-orange" />
                  <span className="flex flex-1 items-center gap-3 px-3 py-2.5">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-orange text-white">
                      <Fuel className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">
                        {r.titre}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {r.kmEcheance != null ? formatKm(r.kmEcheance) : "—"}
                        {r.dateEcheance ? ` · ${formatDayMonth(r.dateEcheance)}` : ""}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[12px]">
                        <AlarmClock className="h-3.5 w-3.5 text-emerald-600" />
                        {stats.kmRestants != null ? (
                          <span className="text-emerald-600">
                            Dans {formatKm(Math.max(0, stats.kmRestants))}
                          </span>
                        ) : null}
                        {stats.joursRestants != null ? (
                          <span className="text-orange">
                            · Dans {stats.joursRestants} jour
                            {stats.joursRestants > 1 ? "s" : ""}
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="relative mt-4">
        <div className="absolute bottom-0 left-[18px] top-2 w-[10px] rounded-full bg-road">
          <div className="absolute inset-y-2 left-1/2 w-0 -translate-x-1/2 border-l-[2px] border-dashed border-white/90" />
        </div>

        {months.length === 0 ? (
          <p className="px-12 py-10 text-sm text-muted">Aucun événement pour le moment.</p>
        ) : (
          months.map((month) => (
            <div key={month.key} className="relative mb-2">
              <div className="relative mb-3 ml-12 mr-4">
                <div className="absolute top-1/2 -left-[38px] h-3 w-8 -translate-y-1/2 rounded-sm bg-[#7a7a7a]" />
                <div className="flex items-center justify-between rounded-xl border border-line bg-white px-4 py-3 shadow-sm">
                  <span className="text-[13px] font-semibold tracking-wide text-ink">
                    {month.label}
                  </span>
                  <span className="text-[15px] font-bold text-ink">
                    {formatMoney(month.total)}
                  </span>
                </div>
              </div>

              {month.items.map((event) => {
                const fill = event.kind === "refueling" ? fillById(event.id) : undefined
                const expanded = expandedId === event.id
                return (
                  <div key={`${event.kind}-${event.id}`} className="relative mb-4">
                    <TimelineDot kind={event.kind} />
                    <div className="ml-12 mr-4">
                      <button
                        type="button"
                        className="w-full text-left"
                        onClick={() =>
                          setExpandedId(expanded ? null : event.id)
                        }
                      >
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-[16px] font-bold text-ink">{event.title}</span>
                          {event.amount != null ? (
                            <span className="text-[16px] font-bold text-ink">
                              {formatMoney(event.amount)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-between gap-2 text-[12px] text-muted">
                          <span>{event.subtitle}</span>
                          <span>{formatDayMonth(event.date)}</span>
                        </div>
                      </button>

                      {expanded && fill ? (
                        <FuelDetails
                          fill={fill}
                          fills={refuelings}
                          onDelete={async () => {
                            await db.refuelings.delete(fill.id)
                            setExpandedId(null)
                          }}
                          onEdit={() => navigate(`/plein/${fill.id}/edit`)}
                          onView={() => navigate(`/plein/${fill.id}`)}
                        />
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          ))
        )}
      </section>
    </div>
  )
}

function TimelineDot({ kind }: { kind: TimelineEvent["kind"] }) {
  const map: Record<TimelineEvent["kind"], string> = {
    refueling: "bg-orange",
    expense: "bg-accent-depense",
    revenue: "bg-accent-revenu",
    maintenance: "bg-accent-entretien",
    reading: "bg-accent-releve",
    trip: "bg-accent-itineraire",
    checklist: "bg-accent-checklist",
    reminder: "bg-accent-rappel",
  }
  const iconClass = "h-4 w-4"
  return (
    <div
      className={cn(
        "absolute left-[7px] top-0 z-10 grid h-8 w-8 place-items-center rounded-full text-white shadow",
        map[kind],
      )}
    >
      {kind === "refueling" ? <Fuel className={iconClass} /> : null}
      {kind === "expense" ? <Wallet className={iconClass} /> : null}
      {kind === "revenue" ? <Wallet className={iconClass} /> : null}
      {kind === "maintenance" ? <Wrench className={iconClass} /> : null}
      {kind === "reading" ? <FileSpreadsheet className={iconClass} /> : null}
      {kind === "trip" ? <Route className={iconClass} /> : null}
      {kind === "checklist" ? <ClipboardCheck className={iconClass} /> : null}
      {kind === "reminder" ? <AlarmClock className={iconClass} /> : null}
    </div>
  )
}

function FuelDetails({
  fill,
  fills,
  onDelete,
  onEdit,
  onView,
}: {
  fill: Refueling
  fills: Refueling[]
  onDelete: () => void
  onEdit: () => void
  onView: () => void
}) {
  const { vehicle } = useApp()
  const stats = computeRefuelingStats(fill, fills, vehicle)
  return (
    <div className="mt-3 rounded-lg bg-white px-1 pb-2">
      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
        Carburant
      </p>
      <DetailRow
        label={`${fill.carburant} ${formatLitres(fill.litres)} · ${formatPricePerLitre(fill.prixAuLitre)}`}
        value={formatMoney(fill.coutTotal)}
      />
      <DetailRow label="Compteur kilométrique" value={formatKm(fill.kilometrage)} />
      <DetailRow
        label="Consommation"
        value={
          stats.consommation != null ? formatConsumption(stats.consommation) : "0 L/100km"
        }
        info
      />
      <DetailRow label="Réservoir rempli" value={fill.pleinComplet ? "Oui" : "Non"} />
      <DetailRow label="Station service" value={fill.station || "—"} />
      <div className="mt-2 flex justify-end gap-4 pr-1 text-muted">
        <button type="button" aria-label="Supprimer" onClick={onDelete}>
          <Trash2 className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Modifier" onClick={onEdit}>
          <Pencil className="h-5 w-5" />
        </button>
        <button type="button" aria-label="Voir" onClick={onView}>
          <Eye className="h-5 w-5" />
        </button>
      </div>
    </div>
  )
}

function DetailRow({
  label,
  value,
  info,
}: {
  label: string
  value: string
  info?: boolean
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-[13px]">
      <span className="text-ink">
        {label}
        {info ? <Info className="ml-1 inline h-3.5 w-3.5 text-muted" /> : null}
      </span>
      <span className="shrink-0 font-medium text-ink">{value}</span>
    </div>
  )
}
