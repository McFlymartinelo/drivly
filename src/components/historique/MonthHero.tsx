import { ArrowDownRight, ArrowUpRight } from "lucide-react"
import { useId } from "react"
import {
  formatDecimal,
  formatKmGrouped,
  formatMoney,
} from "../../utils/format"

export function MonthHero({
  label,
  total,
  distance,
  consumption,
  comparison,
  fills,
  trend,
}: {
  label: string
  total: number
  distance: number | null
  consumption: number | null
  comparison?: string | null
  fills: number
  trend: number[]
}) {
  const up = comparison?.includes("au-dessus") ?? false
  const TrendIcon = up ? ArrowUpRight : ArrowDownRight

  return (
    <div className="month-hero aura-grain relative flex h-full flex-col overflow-hidden rounded-[28px] border border-white/10 p-5 text-white shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="aura-hero__eyebrow">{label}</p>
          <p className="month-hero__value mt-2">{formatMoney(total)}</p>
          <p className="aura-hero__meta mt-1.5">de dépenses sur le mois</p>
        </div>
        <Sparkline values={trend} />
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-white/10 pt-4">
        <HeroStat
          label="Distance"
          value={distance ? formatKmGrouped(distance) : "-"}
        />
        <HeroStat
          label="Conso"
          value={consumption != null ? formatDecimal(consumption, 2) : "—"}
          unit="L/100"
        />
        <HeroStat label="Pleins" value={String(fills)} />
      </div>

      {comparison ? (
        <p className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-medium text-white/80 backdrop-blur-sm">
          <TrendIcon className="h-3.5 w-3.5" />
          {comparison}
        </p>
      ) : null}
    </div>
  )
}

function HeroStat({
  label,
  value,
  unit,
}: {
  label: string
  value: string
  unit?: string
}) {
  return (
    <div className="min-w-0">
      <p className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-white/60">
        {label}
      </p>
      <p className="tabular mt-1 truncate text-[15px] font-semibold leading-none text-white">
        {value}
        {unit ? (
          <span className="ml-1 text-[10px] font-medium text-white/55">{unit}</span>
        ) : null}
      </p>
    </div>
  )
}

function Sparkline({ values }: { values: number[] }) {
  const id = useId().replace(/:/g, "")
  if (values.length < 2) return null

  const width = 76
  const height = 36
  const max = Math.max(...values, 1)
  const min = Math.min(...values, 0)
  const range = max - min || 1

  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * width
    const y = height - ((value - min) / range) * (height - 8) - 4
    return `${x.toFixed(1)},${y.toFixed(1)}`
  })
  const line = points.join(" ")
  const area = `0,${height} ${line} ${width},${height}`

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="month-hero__spark shrink-0"
      role="img"
      aria-label={`Évolution des dépenses sur ${values.length} mois`}
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="white" stopOpacity="0.45" />
          <stop offset="1" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${id})`} />
      <polyline
        points={line}
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
