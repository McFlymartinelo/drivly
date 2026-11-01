import { addYears, differenceInYears, parseISO } from "date-fns"
import {
  AlarmClock,
  Cake,
  ChevronRight,
  ClipboardCheck,
  Eye,
  FileSpreadsheet,
  Fuel,
  Info,
  Pencil,
  Route,
  Trash2,
  Trophy,
  Wallet,
  Wrench,
} from "lucide-react"
import { useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { db } from "../../db/db"
import { useApp } from "../../hooks/useApp"
import type { Refueling, TimelineEvent } from "../../types"
import {
  computeRefuelingStats,
  reminderStatus,
  summarizeFuel,
  type ReminderLevel,
} from "../../utils/calculations"
import { cn } from "../../utils/cn"
import {
  formatConsumption,
  formatDayMonth,
  formatDecimal,
  formatKm,
  formatKmGrouped,
  formatLitres,
  formatMoney,
  formatMonthName,
  formatMonthYear,
  formatNumber,
  formatPricePerLitre,
} from "../../utils/format"
import { recomputeOdometer } from "../../utils/odometer"
import { showToast } from "../../utils/toast"
import { Onboarding } from "../onboarding/Onboarding"
import { MonthHero } from "./MonthHero"

const REMINDER_TEXT: Record<ReminderLevel, string> = {
  ok: "text-muted",
  soon: "text-orange",
  late: "text-danger",
}


export function HistoryScreen() {
  const {
    ready,
    vehicles,
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

  // Une année de suivi est fêtée chaque année à la date du premier enregistrement.
  const anniversaries = useMemo(() => {
    const start = [
      vehicle?.createdAt,
      ...refuelings.map((f) => f.date),
      ...expenses.map((e) => e.date),
      ...maintenances.map((m) => m.date),
    ]
      .filter((d): d is string => Boolean(d))
      .sort()[0]
    if (!start) return [] as TimelineEvent[]
    const years = differenceInYears(new Date(), parseISO(start))
    const list: TimelineEvent[] = []
    for (let year = 1; year <= years; year += 1) {
      const date = addYears(parseISO(start), year).toISOString()
      list.push({
        id: `anniversary-${year}`,
        kind: "anniversary",
        date,
        title:
          year === 1
            ? "Vous avez terminé une année de contrôle de votre véhicule."
            : `Vous avez complété ${year} année(s) de contrôle de votre véhicule.`,
        subtitle: "",
        count: year,
      })
    }
    return list
  }, [vehicle?.createdAt, refuelings, expenses, maintenances])

  // Récapitulatif mensuel : distance, litres et consommation sont calculés
  // sur exactement le même périmètre (avant, ils ne couvraient pas le même
  // mois et affichaient donc des chiffres incohérents).
  const monthStats = useMemo(() => {
    const fillsByMonth = new Map<string, Refueling[]>()
    for (const fill of refuelings) {
      const key = fill.date.slice(0, 7)
      const list = fillsByMonth.get(key)
      if (list) list.push(fill)
      else fillsByMonth.set(key, [fill])
    }

    const biggestByMonth = new Map<string, { title: string; amount: number }>()
    const consider = (key: string, title: string, amount: number) => {
      const current = biggestByMonth.get(key)
      if (!current || amount > current.amount) {
        biggestByMonth.set(key, { title, amount })
      }
    }
    for (const expense of expenses) {
      consider(expense.date.slice(0, 7), expense.categorie, expense.montant)
    }
    for (const maintenance of maintenances) {
      consider(
        maintenance.date.slice(0, 7),
        maintenance.typeEntretien || "Entretien",
        maintenance.coutTotal,
      )
    }

    const keys = new Set<string>([
      ...fillsByMonth.keys(),
      ...biggestByMonth.keys(),
    ])

    const map = new Map<
      string,
      {
        distance: number | null
        consumption: number | null
        biggest: { title: string; amount: number } | null
      }
    >()

    for (const key of keys) {
      const fills = fillsByMonth.get(key) ?? []
      const summary = summarizeFuel(fills, refuelings)
      map.set(key, {
        distance: summary.distance,
        consumption: summary.consumption,
        biggest: biggestByMonth.get(key) ?? null,
      })
    }
    return map
  }, [refuelings, expenses, maintenances])


  const baseEvents = useMemo(() => {
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
      const items = Array.isArray(c.items) ? c.items : []
      list.push({
        id: c.id,
        kind: "checklist",
        date: c.date,
        title: c.titre,
        subtitle: `${items.filter((i) => i.done).length}/${items.length} faits`,
      })
    }
    return list
  }, [refuelings, expenses, revenues, maintenances, readings, trips, checklists])

  const events = useMemo(() => {
    const list = [...baseEvents]
    for (const anniversary of anniversaries) {
      const previous = baseEvents
        .filter((e) => e.date < anniversary.date)
        .sort((a, b) => b.date.localeCompare(a.date))[0]
      list.push({
        ...anniversary,
        groupKey: previous ? previous.date.slice(0, 7) : undefined,
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
  }, [baseEvents, anniversaries, search])

  const months = useMemo(() => {
    const map = new Map<string, { key: string; label: string; total: number; items: TimelineEvent[] }>()
    for (const e of events) {
      const key = e.groupKey ?? e.date.slice(0, 7)
      const cur = map.get(key) ?? {
        key,
        label: formatMonthYear(`${key}-01`),
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

  if (!ready) {
    return (
      <div className="grid place-items-center py-16 text-sm text-muted" role="status">
        Chargement du carnet…
      </div>
    )
  }

  if (vehicles.length === 0) return <Onboarding />

  const insightFor = (key: string) => {
    const current = monthStats.get(key)
    const prevKey = [...monthStats.keys()]
      .filter((k) => k < key)
      .sort()
      .at(-1)
    const prev = prevKey ? monthStats.get(prevKey) : undefined
    let comparison: string | null = null
    if (current?.consumption != null && prev?.consumption) {
      const pct = ((current.consumption - prev.consumption) / prev.consumption) * 100
      const dir = pct >= 0 ? "au-dessus" : "en dessous"
      const month = formatMonthName(`${prevKey}-01`)
      const link = /^[aeiouyàâäéèêëîïôöûü]/i.test(month) ? `d'${month}` : `de ${month}`
      comparison = `Consommation ${formatNumber(Math.abs(pct), 1)} % ${dir} ${link}`
    }
    const expense =
      current?.biggest && current.biggest.amount >= 100
        ? `Plus grosse dépense du mois : ${current.biggest.title} · ${formatMoney(current.biggest.amount)}`
        : null
    return { comparison, expense }
  }

  const heroMonth = months[0]
  const heroMeta = heroMonth ? monthStats.get(heroMonth.key) : undefined
  const heroInsight = heroMonth ? insightFor(heroMonth.key) : undefined
  const heroFills = heroMonth
    ? heroMonth.items.filter((event) => event.kind === "refueling").length
    : 0
  const heroTotal = heroMonth
    ? heroMonth.items.reduce(
        (sum, event) =>
          event.kind === "revenue" || event.kind === "anniversary"
            ? sum
            : sum + (event.amount ?? 0),
        0,
      )
    : 0
  const heroTrend = [...months]
    .reverse()
    .slice(-6)
    .map((month) =>
      month.items.reduce(
        (sum, event) =>
          event.kind === "revenue" || event.kind === "anniversary"
            ? sum
            : sum + (event.amount ?? 0),
        0,
      ),
    )

  return (
    <div className="pb-6">
      {heroMonth ? (
        <MonthHero
          label={heroMonth.label}
          total={heroTotal}
          distance={heroMeta?.distance ?? null}
          consumption={heroMeta?.consumption ?? null}
          comparison={heroInsight?.comparison ?? null}
          fills={heroFills}
          trend={heroTrend}
        />
      ) : null}

      <section className="px-4 pt-3">
        <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-muted">
          Rappels
        </p>
        {openReminders.length === 0 ? (
          <p className="pb-2 text-sm text-muted">Aucun rappel actif</p>
        ) : (
          <div className="space-y-2">
            {openReminders.map((r) => {
              const status = reminderStatus(r, vehicle?.kmActuel ?? 0)
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => navigate(`/entree/reminder/${r.id}`)}
                  className="aura-press flex w-full overflow-hidden rounded-2xl border border-line bg-surface text-left shadow-[var(--aura-shadow-1)]"
                >
                  <span
                    className={cn(
                      "w-1.5",
                      status.level === "late"
                        ? "bg-danger"
                        : status.level === "soon"
                          ? "bg-orange"
                          : "bg-teal",
                    )}
                  />
                  <span className="flex flex-1 items-center gap-3 px-3 py-2.5">
                    <span
                      className={cn(
                        "grid h-10 w-10 place-items-center rounded-full text-white",
                        status.level === "late" ? "bg-danger" : "bg-orange",
                      )}
                    >
                      <Fuel className="h-5 w-5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] font-semibold text-ink">
                        {r.titre}
                      </span>
                      <span className="block text-[12px] text-muted">
                        {r.kmEcheance != null ? formatKmGrouped(r.kmEcheance) : "—"}
                        {r.dateEcheance ? ` · ${formatDayMonth(r.dateEcheance)}` : ""}
                      </span>
                      <span className="mt-0.5 flex items-center gap-1 text-[12px]">
                        <AlarmClock
                          className={cn("h-3.5 w-3.5", REMINDER_TEXT[status.level])}
                        />
                        {status.kmText ? (
                          <span className={REMINDER_TEXT[status.level]}>
                            {status.kmText}
                          </span>
                        ) : null}
                        {status.kmText && status.daysText ? (
                          <span className="text-muted">·</span>
                        ) : null}
                        {status.daysText ? (
                          <span className={REMINDER_TEXT[status.level]}>
                            {status.daysText}
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted" />
                  </span>
                </button>
              )
            })}
          </div>
        )}
      </section>

      <section className="relative mt-4">
        <div className="timeline-rail absolute bottom-0 left-[18px] top-2 w-[10px] rounded-full" />

        {months.length === 0 ? (
          <p className="px-12 py-10 text-sm text-muted">Aucun événement pour le moment.</p>
        ) : (
          months.map((month) => {
            const meta = monthStats.get(month.key)
            const insight = insightFor(month.key)
            const hasData = month.items.some((e) => e.kind !== "anniversary")
            return (
              <div key={month.key} className="relative mb-2">
                {hasData ? (
                  <div className="relative mb-3 ml-12 mr-4">
                    <div className="absolute top-1/2 -left-[37px] h-2.5 w-6 -translate-y-1/2 rounded-full bg-line-strong" />
                    <div className="rounded-2xl border border-line/80 bg-surface-2 px-4 py-3">
                      <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted">
                        {month.label}
                      </p>
                      <p className="mt-1 text-[16px] font-semibold leading-snug text-ink">
                        {formatMoney(month.total)}
                        {meta?.distance ? ` · ${formatKm(meta.distance)}` : ""}
                        {meta?.consumption != null
                          ? ` · ${formatDecimal(meta.consumption, 3)} L/100km`
                          : ""}
                      </p>
                      {insight.comparison ? (
                        <p className="mt-1 text-[13px] leading-snug text-muted">
                          {insight.comparison}
                        </p>
                      ) : null}
                      {insight.expense ? (
                        <p className="mt-0.5 text-[13px] leading-snug text-muted">
                          {insight.expense}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}

              {month.items.map((event) => {
                const fill = event.kind === "refueling" ? fillById(event.id) : undefined
                const expanded = expandedId === event.id
                const isAnniversary = event.kind === "anniversary"
                return (
                  <div key={`${event.kind}-${event.id}`} className="relative mb-4">
                    <TimelineDot kind={event.kind} />
                    <div className="ml-12 mr-4 border-b border-line/70 pb-3">
                      {isAnniversary ? (
                        <div className="flex items-start justify-between gap-3 py-1 pl-2">
                          <p className="text-[15px] font-medium leading-snug text-ink">
                            {event.count === 1 ? (
                              <>Vous avez terminé une année de contrôle de votre véhicule.</>
                            ) : (
                              <>
                                Vous avez complété{" "}
                                <span className="font-bold text-teal-deep">{event.count}</span>{" "}
                                année(s) de contrôle de votre véhicule.
                              </>
                            )}
                          </p>
                          <span className="shrink-0 pt-0.5 text-[13px] text-muted">
                            {formatDayMonth(event.date)}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() => {
                            if (event.kind === "refueling") {
                              setExpandedId(expanded ? null : event.id)
                            } else {
                              navigate(`/entree/${event.kind}/${event.id}`)
                            }
                          }}
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
                            <span className="flex items-center gap-0.5">
                              {formatDayMonth(event.date)}
                              {event.kind !== "refueling" ? (
                                <ChevronRight className="h-3 w-3" />
                              ) : null}
                            </span>
                          </div>
                        </button>
                      )}

                      {expanded && fill ? (
                        <FuelDetails
                          fill={fill}
                          fills={refuelings}
                          onDelete={async () => {
                            try {
                              await db.refuelings.delete(fill.id)
                              await recomputeOdometer(fill.vehicleId)
                              setExpandedId(null)
                              showToast("Plein supprimé.", {
                                actionLabel: "Annuler",
                                duration: 7000,
                                onAction: () => {
                                  void db.refuelings
                                    .put(fill)
                                    .then(() => recomputeOdometer(fill.vehicleId))
                                },
                              })
                            } catch (error) {
                              console.error(error)
                              showToast("Suppression impossible.", { tone: "error" })
                            }
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
            )
          })
        )}
      </section>
    </div>
  )
}

function TimelineDot({ kind }: { kind: TimelineEvent["kind"] }) {
  const map: Record<TimelineEvent["kind"], string> = {
    refueling: "bg-teal",
    expense: "bg-accent-depense",
    revenue: "bg-accent-revenu",
    maintenance: "bg-accent-entretien",
    reading: "bg-accent-releve",
    trip: "bg-accent-itineraire",
    checklist: "bg-accent-checklist",
    reminder: "bg-accent-rappel",
    anniversary: "bg-teal",
  }
  const iconClass = "h-4 w-4"
  if (kind === "anniversary") {
    return (
      <>
        <div className="absolute left-[7px] top-0 z-10 grid h-8 w-8 place-items-center rounded-full bg-teal text-white shadow">
          <Trophy className={iconClass} />
        </div>
        <div className="absolute left-[30px] top-[-3px] z-20 grid h-5 w-5 place-items-center rounded-full bg-teal text-white ring-2 ring-white">
          <Cake className="h-3 w-3" />
        </div>
      </>
    )
  }
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
    <div className="mt-3 rounded-lg bg-surface px-1 pb-2">
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
          stats.consommation != null ? formatConsumption(stats.consommation) : "—"
        }
        info
      />
      <DetailRow label="Réservoir rempli" value={fill.pleinComplet ? "Oui" : "Non"} />
      <DetailRow label="Station service" value={fill.station || "—"} />
      {fill.pleinComplet &&
      stats.distance != null &&
      stats.consommation == null ? (
        <p className="mt-1 text-[11px] leading-snug text-muted">
          Consommation incohérente ignorée (plein partiel ou relevé manquant).
        </p>
      ) : null}
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
