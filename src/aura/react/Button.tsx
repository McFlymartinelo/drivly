import type { ButtonHTMLAttributes, ReactNode } from "react"
import { cn } from "./cn"

export type ButtonVariant = "primary" | "soft" | "outline" | "ghost" | "danger"
export type ButtonSize = "sm" | "md" | "lg"

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  block?: boolean
  loading?: boolean
  icon?: ReactNode
}

export function Button({
  variant = "primary",
  size = "md",
  block = false,
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "aura-btn",
        `aura-btn--${variant}`,
        size !== "md" && `aura-btn--${size}`,
        block && "aura-btn--block",
        className,
      )}
    >
      {loading ? <span className="aura-spinner" aria-hidden /> : icon}
      {children}
    </button>
  )
}
