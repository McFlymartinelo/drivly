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
    <div className="flex items-start gap-3 px-4 py-2.5">
      <div className="mt-5 text-muted">{icon}</div>
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
      <span className="aura-label">{label}</span>
      <input
        {...props}
        className="aura-input mt-1.5"
        aria-label={props["aria-label"] ?? label}
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
      <span className="aura-label">{label}</span>
      <select
        {...props}
        className="aura-input mt-1.5"
        aria-label={props["aria-label"] ?? label}
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
      className="aura-switch"
      onClick={() => onChange(!checked)}
    />
  )
}

export function Card({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={cn("aura-card", className)}>{children}</div>
}
