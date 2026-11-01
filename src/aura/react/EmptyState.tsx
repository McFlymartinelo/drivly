import type { ReactNode } from "react"
import { cn } from "./cn"

export interface EmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
  className?: string
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("aura-empty", className)}>
      {icon ? <div className="aura-empty__icon">{icon}</div> : null}
      <h2 className="aura-empty__title">{title}</h2>
      {description ? <p className="aura-empty__desc">{description}</p> : null}
      {action}
    </div>
  )
}
