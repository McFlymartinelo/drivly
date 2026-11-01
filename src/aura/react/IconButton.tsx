import type { ButtonHTMLAttributes } from "react"
import { cn } from "./cn"

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Libellé accessible obligatoire (icône seule). */
  label: string
}

export function IconButton({
  label,
  className,
  children,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      aria-label={rest["aria-label"] ?? label}
      className={cn("aura-iconbtn", className)}
    >
      {children}
    </button>
  )
}
