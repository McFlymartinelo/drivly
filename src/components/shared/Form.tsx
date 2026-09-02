import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react"
import { cn } from "../../utils/cn"

export function FormRow({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex items-start gap-4 px-4 py-3">
      <div className="mt-4 text-muted">{icon}</div>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

export function UnderlineField({
  label,
  hint,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-[12px] text-muted">{label}</span>
      <input
        {...props}
        className="w-full border-0 border-b border-line bg-transparent py-1.5 text-[16px] text-ink outline-none focus:border-orange"
      />
      {hint ? (
        <span className="mt-1 block text-right text-[11px] text-muted">{hint}</span>
      ) : null}
    </label>
  )
}

export function UnderlineSelect({
  label,
  children,
  className,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; children: ReactNode }) {
  return (
    <label className={cn("block min-w-0", className)}>
      <span className="text-[12px] text-muted">{label}</span>
      <select
        {...props}
        className="w-full appearance-none border-0 border-b border-line bg-transparent py-1.5 text-[16px] text-ink outline-none focus:border-orange"
      >
        {children}
      </select>
    </label>
  )
}

export function Toggle({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-orange" : "bg-gray-300",
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "left-5.5 translate-x-0" : "left-0.5",
        )}
        style={{ left: checked ? 22 : 2 }}
      />
    </button>
  )
}

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("rounded-xl bg-white shadow-sm", className)}>{children}</div>
  )
}
