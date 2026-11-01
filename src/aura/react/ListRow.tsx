import type { ReactNode } from "react"
import { cn } from "./cn"
import { ChevronRightIcon } from "./icons"

export interface ListRowProps {
  icon?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}

export function ListRow({
  icon,
  title,
  subtitle,
  meta,
  trailing,
  onClick,
  className,
}: ListRowProps) {
  const content = (
    <>
      {icon ? <span className="aura-row__icon">{icon}</span> : null}
      <span className="aura-row__body">
        <span className="aura-row__title">{title}</span>
        {subtitle ? <span className="aura-row__sub">{subtitle}</span> : null}
      </span>
      {meta ? <span className="aura-row__meta">{meta}</span> : null}
      {trailing ?? (onClick ? <ChevronRightIcon size={16} /> : null)}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        className={cn("aura-row aura-press", className)}
        onClick={onClick}
      >
        {content}
      </button>
    )
  }

  return <div className={cn("aura-row", className)}>{content}</div>
}
