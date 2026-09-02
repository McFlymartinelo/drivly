import { ChevronLeft } from "lucide-react"
import type { FormEvent, ReactNode } from "react"
import { useNavigate } from "react-router-dom"

export function OverlayScreen({
  title,
  color = "orange",
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
  const bg = color === "orange" ? "bg-orange" : "bg-teal"
  return (
    <div className="absolute inset-0 flex flex-col bg-white">
      <header className={`${bg} pt-[env(safe-area-inset-top)] text-white`}>
        <div className="relative flex h-12 items-center px-1">
          <button
            type="button"
            aria-label="Retour"
            className="grid h-11 w-11 place-items-center"
            onClick={() => navigate(-1)}
          >
            <ChevronLeft className="h-7 w-7" />
          </button>
          <h1 className="pointer-events-none absolute inset-x-12 text-center text-[18px] font-medium">
            {title}
          </h1>
          <div className="ml-auto flex items-center pr-1">{right}</div>
        </div>
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
}: {
  onSubmit: (e: FormEvent) => void
  label?: string
  color?: "orange" | "teal"
}) {
  return (
    <form
      onSubmit={onSubmit}
      className="border-t border-line bg-white px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]"
    >
      <button
        type="submit"
        className={`w-full rounded-full py-3.5 text-[15px] font-bold tracking-wide text-white shadow-md ${
          color === "orange" ? "bg-orange" : "bg-teal"
        }`}
      >
        {label}
      </button>
    </form>
  )
}
