import { cn } from "./cn"

export interface SkeletonProps {
  className?: string
  lines?: number
  /** Dernière ligne plus courte, comme un paragraphe. */
  shortLast?: boolean
}

export function Skeleton({ className, lines, shortLast = true }: SkeletonProps) {
  if (!lines || lines < 2) {
    return <div className={cn("aura-skeleton", className)} aria-hidden />
  }

  return (
    <div className="aura-stack" aria-hidden>
      {Array.from({ length: lines }, (_, index) => (
        <div
          key={index}
          className={cn(
            "aura-skeleton",
            shortLast && index === lines - 1 && "aura-skeleton--short",
            className,
          )}
        />
      ))}
    </div>
  )
}
