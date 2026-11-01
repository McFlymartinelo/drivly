import { ChevronLeft } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useNavigate } from "react-router-dom"

export function OverlayScreen({
  title,
  children,
  right,
  footer,
}: {
  title: string
  color?: "orange" | "teal"
  children: ReactNode
  right?: ReactNode
  footer?: ReactNode
}) {
  const navigate = useNavigate()
  return (
    <div className="absolute inset-0 flex flex-col bg-surface">
      <header className="aura-appbar">
        <button
          type="button"
          aria-label="Retour"
          className="aura-iconbtn -ml-2"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="h-6 w-6" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-semibold tracking-[-0.02em] text-ink">
          {title}
        </h1>
        <div className="flex min-w-11 items-center justify-end">{right}</div>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer}
    </div>
  )
}

export function SaveBar({
  onSubmit,
  label = "ENREGISTRER",
  color = "orange",
  disabled = false,
}: {
  onSubmit: (e: FormEvent) => void
  label?: string
  color?: "orange" | "teal"
  disabled?: boolean
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-line bg-surface px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
    >
      <button
        type="submit"
        disabled={disabled}
        className={`aura-btn aura-btn--block ${
          color === "orange" ? "bg-orange" : "bg-teal"
        }`}
      >
        {label}
      </button>
    </form>
  )
}
