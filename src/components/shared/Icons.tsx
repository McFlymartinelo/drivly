import type { ReactNode } from "react"

export function FuelCan({ percent, className }: { percent: number; className?: string }) {
  return (
    <div className={className}>
      <svg viewBox="0 0 88 110" className="h-full w-full" aria-hidden>
        <path
          d="M22 18h28l10 10h10v8h-8v62a10 10 0 0 1-10 10H22a10 10 0 0 1-10-10V28a10 10 0 0 1 10-10z"
          fill="var(--color-chart-plein)"
        />
        <rect x="18" y="32" width="48" height="52" rx="4" fill="var(--aura-warn-soft)" />
        <rect x="54" y="14" width="16" height="10" rx="3" fill="var(--aura-warn)" />
        <text
          x="42"
          y="64"
          textAnchor="middle"
          fill="var(--aura-ink)"
          fontSize="22"
          fontWeight="700"
          fontFamily="Inter, sans-serif"
        >
          {Math.round(percent)}%
        </text>
      </svg>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="mb-2 px-1 text-[11px] font-medium uppercase tracking-[0.14em] text-muted">
      {children}
    </p>
  )
}
