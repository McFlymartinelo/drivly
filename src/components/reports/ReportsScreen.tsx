import { Calendar, Fuel, Gauge, TrendingUp, Wallet } from "lucide-react"
import { useMemo, useState, type ReactNode } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
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
import {
  formatConsumption,
  formatIsoDate,
  formatKmGrouped,
  formatLitres,
  formatMoney,
  formatNumber,
} from "../../utils/format"
import { Card } from "../shared/Form"

const tabs = [
  { id: "general", label: "GÉNÉRAL" },
  { id: "plein", label: "PLEIN" },
  { id: "depense", label: "DÉPENSE" },
  { id: "revenu", label: "LE REVENU" },
] as const

type TabId = (typeof tabs)[number]["id"]

const PIE_COLORS = ["#F57C00", "#EF5350", "#8D6E63", "#43A047"]
const STATION_COLORS = ["#66BB6A", "#26C6DA", "#EC407A", "#EF5350", "#FFA726", "#7E57C2"]

export function ReportsScreen() {
  const { refuelings, expenses, revenues, maintenances } = useApp()
  const [tab, setTab] = useState<TabId>("general")

  const range = useMemo(() => {
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

  return (
    <div className="pb-8">
      <div className="sticky top-0 z-10 border-b border-line bg-white">
        <div className="no-scrollbar flex gap-1 overflow-x-auto px-2">
          {tabs.map((t) => {
            const active = tab === t.id
            const accent = t.id === "plein" ? "text-orange border-orange" : "text-teal border-teal"
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  "shrink-0 border-b-2 px-3 py-3 text-[12px] font-bold tracking-wide",
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
        <div className="flex items-center justify-between rounded-full bg-white px-4 py-2.5 text-[13px] shadow-sm">
          <span>
            {count} entrée{count > 1 ? "s" : ""} ({formatIsoDate(range.from)} -{" "}
            {formatIsoDate(range.to)})
          </span>
          <Calendar className="h-5 w-5 text-orange" />
        </div>
      </div>

      {tab === "general" ? (
        <GeneralReports fills={fills} exps={exps} revs={revs} mains={mains} range={range} />
      ) : null}
      {tab === "plein" ? <FuelReports fills={fills} all={refuelings} /> : null}
      {tab === "depense" ? (
        <SimpleMoney
          items={exps.map((e) => ({ date: e.date, montant: e.montant, label: e.categorie }))}
          color="#EF5350"
        />
      ) : null}
      {tab === "revenu" ? (
        <SimpleMoney
          items={revs.map((e) => ({ date: e.date, montant: e.montant, label: e.categorie }))}
          color="#43A047"
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

  const monthly = monthlyBuckets(fills, exps, mains, revs).map((m) => ({
    ...m,
    label: `${m.key.slice(5)}/${m.key.slice(2, 4)}`,
  }))

  const donut = [
    { name: "Plein", value: fuelCost },
    { name: "Dépense", value: expCost },
    { name: "Entretien", value: maintCost },
  ].filter((d) => d.value > 0)

  const donutData = donut.length ? donut : [{ name: "Plein", value: 1 }]

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
          tone="orange"
          icon={<Wallet className="h-4 w-4" />}
          title="Coût"
          value={formatMoney(totalCost)}
          lines={[
            `Par jour ${formatMoney(totalCost / days)}`,
            `Par km ${formatMoney(distance ? totalCost / distance : 0)}`,
          ]}
        />
        <Kpi
          tone="green"
          icon={<Wallet className="h-4 w-4" />}
          title="Le revenu"
          value={formatMoney(totalRev)}
          lines={[
            `Par jour ${formatMoney(totalRev / days)}`,
            `Par km ${formatMoney(distance ? totalRev / distance : 0)}`,
          ]}
        />
      </div>

      <ChartCard title="Graphique des coûts et revenus" iconColor="teal">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="plein" name="Plein" fill="#F57C00" radius={[4, 4, 0, 0]} />
              <Bar dataKey="depense" name="Dépense" fill="#EF5350" radius={[4, 4, 0, 0]} />
              <Bar dataKey="entretien" name="Entretien" fill="#8D6E63" radius={[4, 4, 0, 0]} />
              <Bar dataKey="revenu" name="Le revenu" fill="#43A047" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Graphique de comparaison des coûts" iconColor="teal">
        <div className="relative h-52">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={donutData}
                dataKey="value"
                nameKey="name"
                innerRadius={55}
                outerRadius={80}
                paddingAngle={2}
              >
                {donutData.map((entry, i) => (
                  <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          {donut.length <= 1 ? (
            <p className="pointer-events-none absolute inset-0 grid place-items-center text-lg font-bold">
              100%
            </p>
          ) : null}
        </div>
      </ChartCard>

      <ChartCard title="Graphique du compteur kilométrique" iconColor="teal">
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={odo}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis domain={["dataMin - 500", "dataMax + 500"]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Line
                type="monotone"
                dataKey="km"
                name="Plein"
                stroke="#00AEEF"
                strokeWidth={2}
                dot={{ fill: "#F57C00", r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>
    </div>
  )
}

function FuelReports({ fills, all }: { fills: Refueling[]; all: Refueling[] }) {
  const agg = aggregateFuel(fills, all)
  const stations = stationBreakdown(fills)
  const monthly = monthlyBuckets(fills, [], [], []).map((m) => ({
    ...m,
    label: m.key.slice(5),
  }))
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
          tone="orange"
          icon={<Wallet className="h-4 w-4" />}
          title="Coût"
          value={formatMoney(agg.totalCost)}
          lines={[`Min ${formatMoney(agg.minCost)}`, `Max ${formatMoney(agg.maxCost)}`]}
        />
        <Kpi
          tone="orange"
          icon={<Fuel className="h-4 w-4" />}
          title="Total de litres"
          value={formatLitres(agg.totalLitres)}
          lines={[`Min ${formatLitres(agg.minLitres)}`, `Max ${formatLitres(agg.maxLitres)}`]}
        />
        <Kpi
          tone="orange"
          icon={<TrendingUp className="h-4 w-4" />}
          title="Prix moyen/L"
          value={formatMoney(agg.avgPrice)}
          lines={[`Min ${formatMoney(agg.minPrice)}`, `Max ${formatMoney(agg.maxPrice)}`]}
        />
        <Kpi
          tone="orange"
          icon={<Gauge className="h-4 w-4" />}
          title="Consommation"
          value={formatConsumption(agg.avgConsumption)}
          lines={[`Min ${formatNumber(agg.minConsumption)}`, `Max ${formatNumber(agg.maxConsumption)}`]}
        />
      </div>

      <Card className="px-4 py-4">
        <p className="mb-3 flex items-center gap-2 text-[14px] font-semibold">
          <Fuel className="h-4 w-4 text-orange" />
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
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-orange-soft">
          <div className="h-full w-3/4 rounded-full bg-orange" />
        </div>
      </Card>

      <ChartCard title="Tous les volumes mensuels" iconColor="orange">
        <div className="h-52">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="litres" name="Litres" fill="#F57C00" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <Card className="px-4 py-4">
        <p className="mb-1 flex items-center gap-2 text-[14px] font-semibold">
          <Gauge className="h-4 w-4 text-orange" /> Efficacité
        </p>
        <p className="text-2xl font-bold">{formatConsumption(agg.avgConsumption)}</p>
        <RangeBar
          min={agg.minConsumption}
          max={agg.maxConsumption}
          value={agg.avgConsumption}
          minLabel={formatNumber(agg.minConsumption)}
          maxLabel={formatNumber(agg.maxConsumption)}
        />
        <p className="mt-4 text-sm text-muted">Coût/km</p>
        <p className="text-xl font-bold">{formatMoney(agg.costPerKm)}</p>
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
          <Fuel className="h-4 w-4 text-orange" /> Détails par station
        </p>
        <div className="space-y-3">
          {stations.map((s, i) => (
            <div key={s.name} className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{s.name}</p>
                <p className="text-xs text-muted">
                  {formatMoney(s.avgPrice)}/L · {s.count} visites
                </p>
              </div>
              <span
                className="rounded-full px-2 py-0.5 text-xs font-bold text-white"
                style={{ backgroundColor: STATION_COLORS[i % STATION_COLORS.length] }}
              >
                {formatNumber(s.share, 0)}%
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        <ChartCard title="Par station" iconColor="orange">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stations} dataKey="count" nameKey="name" innerRadius={28} outerRadius={48}>
                  {stations.map((s, i) => (
                    <Cell key={s.name} fill={STATION_COLORS[i % STATION_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
        <ChartCard title="Dépenses" iconColor="orange">
          <div className="h-40">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={stations} dataKey="total" nameKey="name" innerRadius={28} outerRadius={48}>
                  {stations.map((s, i) => (
                    <Cell key={s.name} fill={STATION_COLORS[i % STATION_COLORS.length]} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>
      </div>

      <ChartCard title="Prix du carburant dans le temps" iconColor="orange">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceSeries}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area type="monotone" dataKey="prix" name="Prix / L" stroke="#F57C00" fill="#FFE0B2" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </ChartCard>

      <ChartCard title="Graphique de consommation" iconColor="orange">
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={priceSeries.filter((p) => p.conso != null)}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis domain={["auto", "auto"]} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Area
                type="monotone"
                dataKey="conso"
                name="L/100km"
                stroke="#F57C00"
                fill="#FFE0B2"
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
              <p className="font-bold" style={{ color }}>
                {formatMoney(i.montant)}
              </p>
            </div>
          ))
        )}
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
  tone: "teal" | "orange" | "green" | "gray"
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
  iconColor: "teal" | "orange"
  children: ReactNode
}) {
  return (
    <Card className="px-3 py-3">
      <p className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
        <span className={cn("h-4 w-4 rounded-sm", iconColor === "teal" ? "bg-teal" : "bg-orange")} />
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
      <div className="relative h-1.5 rounded-full bg-gray-200">
        <span
          className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange"
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
