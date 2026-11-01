import { addMonths, parseISO } from "date-fns"
import {
  Calendar,
  ChevronRight,
  Download,
  Fuel,
  Gauge,
  TrendingUp,
  Wallet,
  Wrench,
} from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import { useNavigate } from "react-router-dom"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useApp } from "../../hooks/useApp"
import type { Expense, Maintenance, Refueling, Revenue } from "../../types"
import {
  aggregateFuel,
  computeRefuelingStats,
  monthlyBuckets,
  periodDays,
  stationBreakdown,
} from "../../utils/calculations"
import { cn } from "../../utils/cn"
import { downloadCsv } from "../../utils/export"
import {
  formatConsumption,
  formatIsoDate,
  formatKmGrouped,
  formatLitres,
  formatMoney,
  formatNumber,
} from "../../utils/format"
import { showToast } from "../../utils/toast"
import { Card } from "../shared/Form"

const tabs = [
  { id: "general", label: "GÉNÉRAL" },
  { id: "plein", label: "PLEIN" },
  { id: "depense", label: "DÉPENSE" },
  { id: "entretien", label: "ENTRETIENS" },
  { id: "revenu", label: "REVENU" },
] as const

type TabId = (typeof tabs)[number]["id"]

type PeriodId = "all" | "12m" | "year" | "custom"

const periods: Array<{ id: PeriodId; label: string }> = [
  { id: "all", label: "Tout" },
  { id: "12m", label: "12 mois" },
  { id: "year", label: "Année" },
  { id: "custom", label: "Perso" },
]

const PIE_COLORS = [
  "var(--color-chart-plein)",
  "var(--color-chart-depense)",
  "var(--color-chart-entretien)",
]
const STATION_COLORS = [
  "var(--color-chart-plein)",
  "var(--color-chart-depense)",
  "var(--color-chart-entretien)",
  "var(--color-chart-revenu)",
  "oklch(38% 0.05 265)",
  "oklch(82% 0.05 265)",
]

const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid var(--aura-line)",
  background: "var(--aura-surface)",
  boxShadow: "var(--aura-shadow-2)",
  fontSize: 11,
  padding: "8px 10px",
}

interface ChartRow {
  key: string
  label: string
  plein: number
  depense: number
  entretien: number
  revenu: number
  litres: number
}

/**
 * Au-delà de 18 points, on agrège par année : des barres mensuelles sur
 * 8 ans deviennent des traits d'un pixel, illisibles.
 */
function groupChartData(
  rows: Array<Omit<ChartRow, "label">>,
  maxGroups = 18,
): { rows: ChartRow[]; yearly: boolean } {
  if (rows.length <= maxGroups) {
    return {
      rows: rows.map((row) => ({
        ...row,
        label: `${row.key.slice(5)}/${row.key.slice(2, 4)}`,
      })),
      yearly: false,
    }
  }

  const map = new Map<string, ChartRow>()
  for (const row of rows) {
    const year = row.key.slice(0, 4)
    const current =
      map.get(year) ?? {
        key: year,
        label: year,
        plein: 0,
        depense: 0,
        entretien: 0,
        revenu: 0,
        litres: 0,
      }
    current.plein += row.plein
    current.depense += row.depense
    current.entretien += row.entretien
    current.revenu += row.revenu
    current.litres += row.litres
    map.set(year, current)
  }

  return {
    rows: [...map.values()].sort((a, b) => a.key.localeCompare(b.key)),
    yearly: true,
  }
}

function compactMoney(value: number): string {
  return `${new Intl.NumberFormat("fr-FR", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value)} €`
}

export function ReportsScreen() {
  const { ready, refuelings, expenses, revenues, maintenances } = useApp()
  const [tab, setTab] = useState<TabId>("general")
  const [period, setPeriod] = useState<PeriodId>("all")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState("")

  const dataRange = useMemo(() => {
    const dates = [
      ...refuelings.map((x) => x.date),
      ...expenses.map((x) => x.date),
      ...revenues.map((x) => x.date),
      ...maintenances.map((x) => x.date),
    ].sort()
    if (dates.length === 0) {
      const now = new Date().toISOString()
      return { from: now, to: now }
    }
    return { from: dates[0], to: dates[dates.length - 1] }
  }, [refuelings, expenses, revenues, maintenances])

  const range = useMemo(() => {
    if (period === "all") return dataRange
    if (period === "12m") {
      const to = parseISO(dataRange.to)
      const from = Number.isNaN(to.getTime())
        ? parseISO(dataRange.from)
        : addMonths(to, -12)
      return {
        from: (from.getTime() > parseISO(dataRange.from).getTime() ? from : parseISO(dataRange.from)).toISOString(),
        to: dataRange.to,
      }
    }
    if (period === "year") {
      const year = dataRange.to.slice(0, 4)
      const from = `${year}-01-01T00:00:00.000Z`
      return { from: from > dataRange.from ? from : dataRange.from, to: dataRange.to }
    }
    return {
      from: customFrom ? new Date(`${customFrom}T00:00:00`).toISOString() : dataRange.from,
      to: customTo ? new Date(`${customTo}T23:59:59`).toISOString() : dataRange.to,
    }
  }, [period, dataRange, customFrom, customTo])

  const fills = useMemo(
    () => refuelings.filter((f) => f.date >= range.from && f.date <= range.to),
    [refuelings, range],
  )
  const exps = useMemo(
    () => expenses.filter((f) => f.date >= range.from && f.date <= range.to),
    [expenses, range],
  )
  const revs = useMemo(
    () => revenues.filter((f) => f.date >= range.from && f.date <= range.to),
    [revenues, range],
  )
  const mains = useMemo(
    () => maintenances.filter((f) => f.date >= range.from && f.date <= range.to),
    [maintenances, range],
  )

  const count = fills.length + exps.length + revs.length + mains.length

  if (!ready) {
    return (
      <p className="py-16 text-center text-sm text-muted" role="status">
        Chargement des rapports…
      </p>
    )
  }

  function exportCsv() {
    const rows: Array<Array<string | number>> = []
    for (const fill of fills) {
      rows.push([
        formatIsoDate(fill.date),
        "Plein",
        fill.carburant,
        fill.coutTotal,
        fill.kilometrage,
        fill.litres,
        fill.prixAuLitre,
        fill.station,
      ])
    }
    for (const expense of exps) {
      rows.push([
        formatIsoDate(expense.date),
        "Dépense",
        expense.categorie,
        expense.montant,
        expense.kilometrage ?? "",
        "",
        "",
        expense.notes,
      ])
    }
    for (const maintenance of mains) {
      rows.push([
        formatIsoDate(maintenance.date),
        "Entretien",
        maintenance.typeEntretien,
        maintenance.coutTotal,
        maintenance.kilometrage,
        "",
        "",
        [maintenance.typeIntervention, maintenance.referencesPieces]
          .filter(Boolean)
          .join(" · "),
      ])
    }
    for (const revenue of revs) {
      rows.push([
        formatIsoDate(revenue.date),
        "Revenu",
        revenue.categorie,
        revenue.montant,
        revenue.kilometrage ?? "",
        "",
        "",
        revenue.notes,
      ])
    }
    rows.sort((a, b) => String(a[0]).localeCompare(String(b[0])))

    if (rows.length === 0) {
      showToast("Aucune donnée à exporter sur cette période.", { tone: "error" })
      return
    }

    downloadCsv(
      `drivly-${range.from.slice(0, 10)}_${range.to.slice(0, 10)}.csv`,
      [
        "Date",
        "Type",
        "Catégorie",
        "Montant (€)",
        "Kilométrage",
        "Litres",
        "Prix/L (€)",
        "Notes",
      ],
      rows,
    )
    showToast("Export CSV généré.", { tone: "success" })
  }

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 border-b border-line bg-[var(--aura-glass-strong)] backdrop-blur-xl">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-2">
          {tabs.map((t) => {
            const active = tab === t.id
            const accent =
              t.id === "plein"
                ? "text-teal border-teal"
                : t.id === "entretien"
                  ? "text-accent-entretien border-accent-entretien"
                  : "text-teal border-teal"
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-3 text-[12px] font-bold tracking-[0.02em] transition-colors",
                  active ? accent : "border-transparent text-muted",
                )}
              >
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="px-3 pt-3">
        <div className="rounded-2xl border border-line bg-surface px-3 py-2.5 text-[13px] shadow-[var(--aura-shadow-1)]">
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate">
              {count} entrée{count > 1 ? "s" : ""} ({formatIsoDate(range.from)} -{" "}
              {formatIsoDate(range.to)})
            </span>
            <button
              type="button"
              className="flex shrink-0 items-center gap-1 rounded-full bg-teal-soft px-2.5 py-1 text-[12px] font-semibold text-teal-deep"
              onClick={exportCsv}
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
          </div>

          <div className="mt-2 flex items-center gap-1.5 overflow-x-auto">
            <Calendar className="h-4 w-4 shrink-0 text-orange" />
            {periods.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setPeriod(item.id)}
                className={cn(
                  "shrink-0 rounded-full px-2.5 py-1 text-[12px] font-semibold transition-colors",
                  period === item.id
                    ? "bg-teal text-white"
                    : "bg-surface-2 text-muted",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {period === "custom" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                type="date"
                aria-label="Date de début"
                value={customFrom}
                onChange={(event) => setCustomFrom(event.target.value)}
                className="rounded-lg border border-line px-2 py-1.5 text-[12px]"
              />
              <input
                type="date"
                aria-label="Date de fin"
                value={customTo}
                onChange={(event) => setCustomTo(event.target.value)}
                className="rounded-lg border border-line px-2 py-1.5 text-[12px]"
              />
            </div>
          ) : null}
        </div>
      </div>

      {count === 0 ? (
        <div className="px-3 pt-3">
          <Card className="px-4 py-8 text-center">
            <p className="text-sm font-semibold text-ink">Aucune donnée sur cette période</p>
            <p className="mt-1 text-[12px] text-muted">
              Ajoutez un plein ou une dépense, ou élargissez la période.
            </p>
          </Card>
        </div>
      ) : null}

      {count > 0 && tab === "general" ? (
        <GeneralReports fills={fills} exps={exps} revs={revs} mains={mains} range={range} />
      ) : null}
      {count > 0 && tab === "plein" ? <FuelReports fills={fills} all={refuelings} /> : null}
      {count > 0 && tab === "depense" ? (
        <SimpleMoney
          items={exps.map((e) => ({ date: e.date, montant: e.montant, label: e.categorie }))}
          color="var(--color-chart-depense)"
        />
      ) : null}
      {count > 0 && tab === "entretien" ? <MaintenanceReports mains={mains} /> : null}
      {count > 0 && tab === "revenu" ? (
        <SimpleMoney
          items={revs.map((e) => ({ date: e.date, montant: e.montant, label: e.categorie }))}
          color="var(--color-chart-revenu)"
        />
      ) : null}
    </div>
  )
}

function GeneralReports({
  fills,
  exps,
  revs,
  mains,
  range,
}: {
  fills: Refueling[]
  exps: Expense[]
  revs: Revenue[]
  mains: Maintenance[]
  range: { from: string; to: string }
}) {
  const fuelCost = fills.reduce((s, f) => s + f.coutTotal, 0)
  const expCost = exps.reduce((s, f) => s + f.montant, 0)
  const maintCost = mains.reduce((s, f) => s + f.coutTotal, 0)
  const totalCost = fuelCost + expCost + maintCost
  const totalRev = revs.reduce((s, f) => s + f.montant, 0)
  const bilan = totalCost - totalRev
  const sortedKm = [...fills].sort((a, b) => a.kilometrage - b.kilometrage)
  const distance =
    sortedKm.length >= 2
      ? sortedKm[sortedKm.length - 1].kilometrage - sortedKm[0].kilometrage
      : 0
  const days = periodDays(range.from, range.to)

  const chart = groupChartData(monthlyBuckets(fills, exps, mains, revs))
  const monthly = chart.rows
  const periodLabel = chart.yearly ? "par an" : "par mois"
  const hasRevenue = totalRev > 0

  const donut = [
    { name: "Plein", value: fuelCost },
    { name: "Dépense", value: expCost },
    { name: "Entretien", value: maintCost },
  ].filter((d) => d.value > 0)

  const odo = [...fills]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({
      label: `${f.date.slice(5, 7)}/${f.date.slice(2, 4)}`,
      km: f.kilometrage,
    }))

  return (
    <div className="space-y-3 px-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          tone="teal"
          icon={<Wallet className="h-4 w-4" />}
          title="Bilan"
          value={formatMoney(bilan)}
          lines={[
            `Par jour ${formatMoney(bilan / days)}`,
            `Par km ${formatMoney(distance ? bilan / distance : 0)}`,
          ]}
        />
        <Kpi
          tone="gray"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Distance"
          value={formatKmGrouped(distance)}
          lines={[`Moyenne journalière ${Math.round(distance / days)} km`]}
        />
        <Kpi
          tone="teal"
          icon={<Wallet className="h-4 w-4" />}
          title="Coût"
          value={formatMoney(totalCost)}
          lines={[
            `Par jour ${formatMoney(totalCost / days)}`,
            `Par km ${formatMoney(distance ? totalCost / distance : 0)}`,
          ]}
        />
        <Kpi
          tone="lime"
          icon={<Wallet className="h-4 w-4" />}
          title="Revenus"
          value={formatMoney(totalRev)}
          lines={[
            `Par jour ${formatMoney(totalRev / days)}`,
            `Par km ${formatMoney(distance ? totalRev / distance : 0)}`,
          ]}
        />
      </div>

      <ChartCard
        title={`Coûts ${periodLabel}${hasRevenue ? " et revenus" : ""}`}
        iconColor="teal"
      >
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={monthly} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--aura-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={54}
                tickFormatter={(value) => compactMoney(Number(value))}
              />
              <Tooltip
                cursor={{ fill: "var(--aura-accent-soft)", opacity: 0.5 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--aura-ink-3)", fontSize: 10, marginBottom: 4 }}
                itemStyle={{ color: "var(--aura-ink)", fontSize: 11 }}
                formatter={(value, name) => [formatMoney(Number(value)), name]}
              />
              <Bar stackId="costs" dataKey="plein" name="Plein" fill="var(--color-chart-plein)" maxBarSize={28} />
              <Bar stackId="costs" dataKey="depense" name="Dépense" fill="var(--color-chart-depense)" maxBarSize={28} />
              <Bar
                stackId="costs"
                dataKey="entretien"
                name="Entretien"
                fill="var(--color-chart-entretien)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
              />
              {hasRevenue ? (
                <Line
                  type="monotone"
                  dataKey="revenu"
                  name="Revenus"
                  stroke="var(--color-chart-revenu)"
                  strokeWidth={2.5}
                  dot={{
                    r: 3,
                    fill: "var(--color-chart-revenu)",
                    stroke: "var(--aura-ink)",
                    strokeWidth: 1,
                  }}
                  activeDot={{ r: 4 }}
                />
              ) : null}
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-1 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-[10px] text-muted">
          {[
            { name: "Plein", color: "var(--color-chart-plein)" },
            { name: "Dépense", color: "var(--color-chart-depense)" },
            { name: "Entretien", color: "var(--color-chart-entretien)" },
            ...(hasRevenue
              ? [{ name: "Revenus", color: "var(--color-chart-revenu)" }]
              : []),
          ].map((item) => (
            <span key={item.name} className="inline-flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: item.color }}
              />
              {item.name}
            </span>
          ))}
        </div>
      </ChartCard>

      <ChartCard title="Répartition des dépenses" iconColor="teal">
        <div className="relative h-56">
          {donut.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donut}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={54}
                    outerRadius={78}
                    paddingAngle={3}
                    cornerRadius={4}
                    stroke="none"
                  >
                    {donut.map((entry, i) => (
                      <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={TOOLTIP_STYLE}
                    formatter={(value) => formatMoney(Number(value))}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted">
                  Total
                </p>
                <p className="text-[18px] font-bold leading-tight">
                  {formatMoney(totalCost)}
                </p>
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center text-[12px] text-muted">
              Aucune dépense sur cette période
            </div>
          )}
        </div>
        {donut.length > 0 ? (
          <div className="mt-2 grid gap-1.5">
            {donut.map((entry, i) => (
              <div key={entry.name} className="flex items-center gap-2 text-[11px]">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                />
                <span className="flex-1 text-muted">{entry.name}</span>
                <span className="font-semibold text-ink">{formatMoney(entry.value)}</span>
                <span className="w-9 text-right text-muted">
                  {Math.round((entry.value / totalCost) * 100)} %
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </ChartCard>

      <ChartCard title="Compteur kilométrique" iconColor="teal">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={odo} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="odoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--aura-accent-solid)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--aura-accent-solid)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--aura-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["dataMin - 500", "dataMax + 500"]}
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={48}
                tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--aura-ink-3)", fontSize: 10 }}
                formatter={(value) => formatKmGrouped(Number(value))}
              />
              <Area
                type="monotone"
                dataKey="km"
                name="Compteur"
                stroke="var(--aura-accent-solid)"
                strokeWidth={2.5}
                fill="url(#odoFill)"
                dot={false}
                activeDot={{
                  r: 4,
                  fill: "var(--aura-accent-solid)",
                  stroke: "var(--aura-surface)",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}

function FuelReports({ fills, all }: { fills: Refueling[]; all: Refueling[] }) {
  const agg = aggregateFuel(fills, all)
  const stations = stationBreakdown(fills)

  if (fills.length === 0) {
    return (
      <div className="px-3 pt-3">
        <Card className="px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">Aucun plein sur cette période</p>
          <p className="mt-1 text-[12px] text-muted">
            Choisissez une autre période ou enregistrez un plein.
          </p>
        </Card>
      </div>
    )
  }

  const chart = groupChartData(monthlyBuckets(fills, [], [], []))
  const monthly = chart.rows
  const periodLabel = chart.yearly ? "par an" : "par mois"
  const priceSeries = [...fills]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((f) => ({
      label: f.date.slice(5, 10),
      prix: f.prixAuLitre,
      conso: computeRefuelingStats(f, all).consommation,
    }))

  return (
    <div className="space-y-3 px-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          tone="teal"
          icon={<Wallet className="h-4 w-4" />}
          title="Coût"
          value={formatMoney(agg.totalCost)}
          lines={[`Min ${formatMoney(agg.minCost)}`, `Max ${formatMoney(agg.maxCost)}`]}
        />
        <Kpi
          tone="teal"
          icon={<Fuel className="h-4 w-4" />}
          title="Total de litres"
          value={formatLitres(agg.totalLitres)}
          lines={[`Min ${formatLitres(agg.minLitres)}`, `Max ${formatLitres(agg.maxLitres)}`]}
        />
        <Kpi
          tone="teal"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Prix moyen/L"
          value={formatMoney(agg.avgPrice)}
          lines={[`Min ${formatMoney(agg.minPrice)}`, `Max ${formatMoney(agg.maxPrice)}`]}
        />
        <Kpi
          tone="teal"
          icon={<Gauge className="h-4 w-4" />}
          title="Consommation"
          value={agg.avgConsumption > 0 ? formatConsumption(agg.avgConsumption) : "—"}
          lines={[`Min ${formatNumber(agg.minConsumption)}`, `Max ${formatNumber(agg.maxConsumption)}`]}
        />
      </div>

      <Card className="px-4 py-4">
        <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
          <Fuel className="h-4 w-4 text-teal" />
          Fréquence de ravitaillement
        </p>
        <div className="grid grid-cols-2 gap-3 text-center">
          <div>
            <p className="text-xs text-muted">Dernier ravitaillement</p>
            <p className="text-lg font-bold">{Math.round(agg.lastIntervalKm)} km</p>
          </div>
          <div>
            <p className="text-xs text-muted">Fréquence</p>
            <p className="text-lg font-bold">~{formatNumber(agg.avgIntervalDays, 2)} Jours</p>
          </div>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-teal-soft">
          <div
            className="h-full rounded-full bg-teal"
            style={{
              width: `${Math.min(
                100,
                Math.max(
                  0,
                  agg.avgIntervalKm > 0
                    ? (agg.lastIntervalKm / agg.avgIntervalKm) * 100
                    : 0,
                ),
              )}%`,
            }}
          />
        </div>
        <p className="mt-1 text-[11px] text-muted">
          Dernier intervalle rapporté à la moyenne ({formatNumber(agg.avgIntervalKm, 0)} km)
        </p>
      </Card>

      <ChartCard title={`Volumes ${periodLabel}`} iconColor="teal">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--aura-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                cursor={{ fill: "var(--aura-accent-soft)", opacity: 0.5 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--aura-ink-3)", fontSize: 10 }}
                formatter={(value) => formatLitres(Number(value))}
              />
              <Bar
                dataKey="litres"
                name="Litres"
                fill="var(--color-chart-plein)"
                radius={[6, 6, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <Card className="px-4 py-4">
        <p className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
          <Gauge className="h-4 w-4 text-teal" /> Efficacité
        </p>
        <p className="text-2xl font-bold">
          {agg.avgConsumption > 0 ? formatConsumption(agg.avgConsumption) : "—"}
        </p>
        <RangeBar
          min={agg.minConsumption}
          max={agg.maxConsumption}
          value={agg.avgConsumption}
          minLabel={formatNumber(agg.minConsumption)}
          maxLabel={formatNumber(agg.maxConsumption)}
        />
        <p className="mt-4 text-sm text-muted">Coût/km</p>
        <p className="text-xl font-bold">
          {agg.costPerKm > 0 ? formatMoney(agg.costPerKm) : "—"}
        </p>
        <RangeBar
          min={agg.minCostPerKm}
          max={agg.maxCostPerKm}
          value={agg.costPerKm}
          minLabel={formatMoney(agg.minCostPerKm)}
          maxLabel={formatMoney(agg.maxCostPerKm)}
        />
      </Card>

      <Card className="px-4 py-4">
        <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
          <Fuel className="h-4 w-4 text-teal" /> Détails par station
        </p>
        <div className="space-y-3">
          {stations.map((s, i) => (
            <div key={s.name} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-muted">
                    {formatMoney(s.avgPrice)}/L · {s.count} visites
                  </p>
                </div>
              </div>
              <span className="rounded-full bg-surface-2 px-2 py-0.5 text-xs font-bold text-ink">
                {formatNumber(s.share, 0)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard title="Par station" iconColor="teal">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stations}
                  dataKey="count"
                  nameKey="name"
                  innerRadius={34}
                  outerRadius={56}
                  paddingAngle={2}
                  stroke="var(--aura-surface)"
                  strokeWidth={2}
                >
                  {stations.map((s, i) => (
                    <Cell key={s.name} fill={STATION_COLORS[i % STATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => `${Number(value)} visite(s)`}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Dépenses" iconColor="teal">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={stations}
                  dataKey="total"
                  nameKey="name"
                  innerRadius={34}
                  outerRadius={56}
                  paddingAngle={2}
                  stroke="var(--aura-surface)"
                  strokeWidth={2}
                >
                  {stations.map((s, i) => (
                    <Cell key={s.name} fill={STATION_COLORS[i % STATION_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={TOOLTIP_STYLE}
                  formatter={(value) => formatMoney(Number(value))}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Prix du carburant dans le temps" iconColor="teal">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceSeries} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="fuelPriceFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-plein)" stopOpacity={0.26} />
                  <stop offset="100%" stopColor="var(--color-chart-plein)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--aura-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--aura-ink-3)", fontSize: 10 }}
                formatter={(value) => `${formatMoney(Number(value))}/L`}
              />
              <Area
                type="monotone"
                dataKey="prix"
                name="Prix / L"
                stroke="var(--color-chart-plein)"
                strokeWidth={2.5}
                fill="url(#fuelPriceFill)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Consommation" iconColor="teal">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={priceSeries.filter((p) => p.conso != null)}
              margin={{ top: 6, right: 4, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="fuelConsoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-chart-depense)" stopOpacity={0.28} />
                  <stop offset="100%" stopColor="var(--color-chart-depense)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--aura-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--aura-ink-3)", fontSize: 10 }}
                formatter={(value) => formatConsumption(Number(value))}
              />
              <Area
                type="monotone"
                dataKey="conso"
                name="L/100km"
                stroke="var(--color-chart-depense)"
                strokeWidth={2.5}
                fill="url(#fuelConsoFill)"
                dot={false}
                activeDot={{ r: 4 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}

function SimpleMoney({
  items,
  color,
}: {
  items: { date: string; montant: number; label: string }[]
  color: string
}) {
  const total = items.reduce((s, i) => s + i.montant, 0)
  return (
    <div className="space-y-3 px-3 pt-3">
      <Kpi tone="gray" icon={<Wallet className="h-4 w-4" />} title="Total" value={formatMoney(total)} lines={[`${items.length} entrée(s)`]} />
      <Card className="divide-y divide-line">
        {items.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">Aucune donnée sur la période.</p>
        ) : (
          items.map((i, idx) => (
            <div key={`${i.date}-${idx}`} className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="font-medium">{i.label}</p>
                <p className="text-xs text-muted">{formatIsoDate(i.date)}</p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <p className="font-bold text-ink">{formatMoney(i.montant)}</p>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  )
}

function MaintenanceReports({ mains }: { mains: Maintenance[] }) {
  const navigate = useNavigate()

  if (mains.length === 0) {
    return (
      <div className="px-3 pt-3">
        <Card className="px-4 py-8 text-center">
          <p className="text-sm font-semibold text-ink">Aucun entretien sur cette période</p>
          <p className="mt-1 text-[12px] text-muted">
            Choisissez une autre période ou enregistrez un entretien.
          </p>
        </Card>
      </div>
    )
  }

  const sorted = [...mains].sort((a, b) => b.date.localeCompare(a.date))
  const total = sorted.reduce((s, m) => s + m.coutTotal, 0)
  const avg = total / sorted.length
  const last = sorted[0]

  const chart = groupChartData(monthlyBuckets([], [], sorted, []))
  const monthly = chart.rows
  const periodLabel = chart.yearly ? "par an" : "par mois"

  const byTypeMap = new Map<string, { name: string; count: number; total: number }>()
  for (const m of sorted) {
    const name = m.typeEntretien || "Entretien"
    const cur = byTypeMap.get(name) ?? { name, count: 0, total: 0 }
    cur.count += 1
    cur.total += m.coutTotal
    byTypeMap.set(name, cur)
  }
  const byType = [...byTypeMap.values()].sort((a, b) => b.total - a.total)
  const maxType = byType[0]?.total ?? 1

  const garage = sorted.filter((m) => m.typeIntervention === "Garage")
  const diy = sorted.filter((m) => m.typeIntervention === "DIY")
  const garageTotal = garage.reduce((s, m) => s + m.coutTotal, 0)
  const diyTotal = diy.reduce((s, m) => s + m.coutTotal, 0)

  return (
    <div className="space-y-3 px-3 pt-3">
      <div className="grid grid-cols-2 gap-3">
        <Kpi
          tone="slate"
          icon={<Wallet className="h-4 w-4" />}
          title="Coût total"
          value={formatMoney(total)}
          lines={[
            `${sorted.length} entretien${sorted.length > 1 ? "s" : ""}`,
            `Moyenne ${formatMoney(avg)}`,
          ]}
        />
        <Kpi
          tone="slate"
          icon={<Gauge className="h-4 w-4" />}
          title="Dernier entretien"
          value={formatKmGrouped(last.kilometrage)}
          lines={[
            formatIsoDate(last.date),
            last.typeEntretien || "Entretien",
          ]}
        />
        <Kpi
          tone="gray"
          icon={<Wrench className="h-4 w-4" />}
          title="Garage"
          value={formatMoney(garageTotal)}
          lines={[`${garage.length} entretien${garage.length > 1 ? "s" : ""}`]}
        />
        <Kpi
          tone="gray"
          icon={<Wrench className="h-4 w-4" />}
          title="DIY"
          value={formatMoney(diyTotal)}
          lines={[`${diy.length} entretien${diy.length > 1 ? "s" : ""}`]}
        />
      </div>

      <ChartCard title={`Coût des entretiens ${periodLabel}`} iconColor="slate">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly} margin={{ top: 6, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid stroke="var(--aura-line)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                dy={6}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fontSize: 10, fill: "var(--aura-ink-3)" }}
                axisLine={false}
                tickLine={false}
                width={46}
                tickFormatter={(value) => compactMoney(Number(value))}
              />
              <Tooltip
                cursor={{ fill: "var(--aura-accent-soft)", opacity: 0.5 }}
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "var(--aura-ink-3)", fontSize: 10 }}
                formatter={(value) => formatMoney(Number(value))}
              />
              <Bar
                dataKey="entretien"
                name="Entretien"
                fill="var(--color-chart-entretien)"
                radius={[6, 6, 0, 0]}
                maxBarSize={30}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <Card className="px-4 py-4">
        <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
          <Wrench className="h-4 w-4 text-accent-entretien" />
          Répartition par type
        </p>
        <div className="space-y-3">
          {byType.map((item) => (
            <div key={item.name}>
              <div className="flex items-center justify-between gap-2 text-[13px]">
                <span className="min-w-0 truncate font-medium">{item.name}</span>
                <span className="shrink-0 font-semibold">{formatMoney(item.total)}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-app">
                <div
                  className="h-full rounded-full bg-accent-entretien"
                  style={{ width: `${(item.total / maxType) * 100}%` }}
                />
              </div>
              <p className="mt-0.5 text-[11px] text-muted">
                {item.count} entretien{item.count > 1 ? "s" : ""}
              </p>
            </div>
          ))}
        </div>
      </Card>

      <Card className="overflow-hidden">
        <p className="flex items-center gap-2 px-4 pb-2 pt-4 text-[14px] font-semibold">
          <Wrench className="h-4 w-4 text-accent-entretien" />
          Historique des entretiens
        </p>
        <div className="divide-y divide-line">
          {sorted.map((m) => {
            const details = [m.referencesPieces, m.notes].filter(Boolean).join(" · ")
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => navigate(`/entree/maintenance/${m.id}`)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left"
              >
                <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-accent-entretien">
                  <Wrench className="h-4 w-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-[14px] font-semibold text-ink">
                      {m.typeEntretien || "Entretien"}
                    </span>
                    <span className="shrink-0 text-[14px] font-bold text-ink">
                      {formatMoney(m.coutTotal)}
                    </span>
                  </span>
                  <span className="mt-0.5 flex items-baseline justify-between gap-2 text-[12px] text-muted">
                    <span className="truncate">
                      {formatIsoDate(m.date)} · {formatKmGrouped(m.kilometrage)} ·{" "}
                      {m.typeIntervention}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </span>
                  {details ? (
                    <span className="mt-1 block truncate text-[12px] text-muted">
                      {details}
                    </span>
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

function Kpi({
  tone,
  icon,
  title,
  value,
  lines,
}: {
  tone: "teal" | "orange" | "green" | "gray" | "brown" | "lime" | "slate"
  icon: ReactNode
  title: string
  value: string
  lines: string[]
}) {
  const tones = {
    teal: "text-teal bg-teal-soft",
    orange: "text-orange bg-orange-soft",
    green: "text-accent-revenu bg-green-50",
    gray: "text-slate-500 bg-slate-100",
    brown: "text-accent-entretien bg-surface-2",
    lime: "text-ink bg-lime-soft ring-1 ring-black/5",
    slate: "text-accent-entretien bg-surface-2",
  }
  return (
    <Card className="px-3 py-3">
      <div className="mb-2 flex items-center justify-between">
        <span className={cn("grid h-7 w-7 place-items-center rounded-md", tones[tone])}>{icon}</span>
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted">{title}</span>
      </div>
      <p className="text-[18px] font-bold leading-tight">{value}</p>
      {lines.map((l) => (
        <p key={l} className="text-[11px] text-muted">
          {l}
        </p>
      ))}
    </Card>
  )
}

function ChartCard({
  title,
  iconColor,
  children,
}: {
  title: string
  iconColor: "teal" | "slate"
  children: ReactNode
}) {
  const dot = iconColor === "teal" ? "bg-teal" : "bg-accent-entretien"
  return (
    <Card className="px-3 py-3">
      <p className="mb-2 flex items-center gap-2 font-display text-[13px] font-bold">
        <span className={cn("h-4 w-4 rounded-sm", dot)} />
        {title}
      </p>
      {children}
    </Card>
  )
}

function RangeBar({
  min,
  max,
  value,
  minLabel,
  maxLabel,
}: {
  min: number
  max: number
  value: number
  minLabel: string
  maxLabel: string
}) {
  const span = max - min || 1
  const pct = Math.min(100, Math.max(0, ((value - min) / span) * 100))
  return (
    <div className="mt-2">
      <div className="relative h-1.5 rounded-full bg-surface-2">
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal"
          style={{ left: `${pct}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted">
        <span>Min {minLabel}</span>
        <span>Max {maxLabel}</span>
      </div>
    </div>
  )
}
