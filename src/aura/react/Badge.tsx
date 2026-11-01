import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react"
import { cn } from "./cn"

export type BadgeTone = "accent" | "success" | "warn" | "danger" | "neutral"

export function Badge({
  tone = "accent",
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        "aura-badge",
        tone !== "accent" && `aura-badge--${tone}`,
        className,
      )}
    >
      {children}
    </span>
  )
}

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

export function Chip({
  active = false,
  className,
  type = "button",
  children,
  ...rest
}: ChipProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-pressed={active}
      className={cn("aura-chip aura-press", active && "aura-chip--active", className)}
    >
      {children}
    </button>
  )
}

export function Avatar({
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span {...rest} className={cn("aura-avatar", className)}>
      {children}
    </span>
  )
}
