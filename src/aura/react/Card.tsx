import type { HTMLAttributes } from "react"
import { cn } from "./cn"

export type CardVariant = "default" | "soft" | "flat" | "hero"

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant
  /** Ajoute le retour tactile + hover si la carte est cliquable. */
  interactive?: boolean
  flush?: boolean
}

export function Card({
  variant = "default",
  interactive = false,
  flush = false,
  className,
  children,
  ...rest
}: CardProps) {
  return (
    <div
      {...rest}
      className={cn(
        "aura-card",
        variant !== "default" && `aura-card--${variant}`,
        flush && "aura-card--flush",
        interactive && "aura-card--interactive aura-press",
        className,
      )}
    >
      {children}
    </div>
  )
}
