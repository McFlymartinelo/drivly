import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "./cn"

export interface StatProps extends HTMLAttributes<HTMLDivElement> {
  label: string
  value: ReactNode
  hint?: ReactNode
  tone?: "default" | "accent" | "success" | "warn" | "danger"
}

const TONE: Record<NonNullable<StatProps["tone"]>, string> = {
  default: "",
  accent: "aura-accent-text",
  success: "aura-text-success",
  warn: "aura-text-warn",
  danger: "aura-text-danger",
}

export function Stat({
  label,
  value,
  hint,
  tone = "default",
  className,
  ...rest
}: StatProps) {
  return (
    <div {...rest} className={cn("aura-stat", className)}>
      <span className="aura-stat__label">{label}</span>
      <span className={cn("aura-stat__value", TONE[tone])}>{value}</span>
      {hint ? <span className="aura-stat__hint">{hint}</span> : null}
    </div>
  )
}
