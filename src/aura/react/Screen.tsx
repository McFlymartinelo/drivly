import type { HTMLAttributes, ReactNode } from "react"
import { cn } from "./cn"

export function Screen({
  className,
  children,
  tabbar = true,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { tabbar?: boolean }) {
  return (
    <main
      {...rest}
      className={cn("aura-screen", tabbar && "aura-screen--tabbar", className)}
    >
      {children}
    </main>
  )
}

export interface AppBarProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode
  subtitle?: ReactNode
  leading?: ReactNode
  actions?: ReactNode
  /** Barre flottante détachée du bord. */
  floating?: boolean
}

export function AppBar({
  title,
  subtitle,
  leading,
  actions,
  floating = false,
  className,
  ...rest
}: AppBarProps) {
  return (
    <header
      {...rest}
      className={cn("aura-appbar", floating && "aura-appbar--floating", className)}
    >
      {leading}
      <div className="aura-appbar__title">
        <span className="aura-truncate">{title}</span>
        {subtitle ? <span className="aura-appbar__sub">{subtitle}</span> : null}
      </div>
      {actions ? <div className="aura-row-flex">{actions}</div> : null}
    </header>
  )
}
