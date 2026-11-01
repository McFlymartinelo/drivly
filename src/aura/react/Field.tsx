import {
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react"
import { cn } from "./cn"

interface CommonFieldProps {
  label?: string
  hint?: string
  error?: string
  containerClassName?: string
}

function useFieldIds(id: string | undefined, hint?: string, error?: string) {
  const autoId = useId()
  const fieldId = id ?? autoId
  const describedBy =
    [error ? `${fieldId}-error` : null, hint ? `${fieldId}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined
  return { fieldId, describedBy }
}

export interface InputProps
  extends InputHTMLAttributes<HTMLInputElement>,
    CommonFieldProps {}

export function Input({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  ...rest
}: InputProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error)
  return (
    <div className={cn("aura-field", containerClassName)}>
      {label ? (
        <label className="aura-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <input
        {...rest}
        id={fieldId}
        className={cn("aura-input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p className="aura-error-text" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="aura-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface TextareaProps
  extends TextareaHTMLAttributes<HTMLTextAreaElement>,
    CommonFieldProps {}

export function Textarea({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  ...rest
}: TextareaProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error)
  return (
    <div className={cn("aura-field", containerClassName)}>
      {label ? (
        <label className="aura-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <textarea
        {...rest}
        id={fieldId}
        className={cn("aura-input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      />
      {error ? (
        <p className="aura-error-text" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="aura-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}

export interface SelectProps
  extends SelectHTMLAttributes<HTMLSelectElement>,
    CommonFieldProps {}

export function Select({
  label,
  hint,
  error,
  containerClassName,
  className,
  id,
  children,
  ...rest
}: SelectProps) {
  const { fieldId, describedBy } = useFieldIds(id, hint, error)
  return (
    <div className={cn("aura-field", containerClassName)}>
      {label ? (
        <label className="aura-label" htmlFor={fieldId}>
          {label}
        </label>
      ) : null}
      <select
        {...rest}
        id={fieldId}
        className={cn("aura-input", className)}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
      >
        {children}
      </select>
      {error ? (
        <p className="aura-error-text" id={`${fieldId}-error`}>
          {error}
        </p>
      ) : hint ? (
        <p className="aura-hint" id={`${fieldId}-hint`}>
          {hint}
        </p>
      ) : null}
    </div>
  )
}
