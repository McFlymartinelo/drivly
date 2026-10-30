import { uid } from "./cn"

export type ToastTone = "info" | "success" | "error"

export interface ToastItem {
  id: string
  message: string
  tone: ToastTone
  actionLabel?: string
  onAction?: () => void
  /** Durée d'affichage en ms (0 = persistante jusqu'au clic). */
  duration: number
}

type Listener = () => void

let toasts: ToastItem[] = []
const listeners = new Set<Listener>()
const timers = new Map<string, number>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function subscribeToasts(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getToasts(): ToastItem[] {
  return toasts
}

export function dismissToast(id: string) {
  const timer = timers.get(id)
  if (timer != null) {
    window.clearTimeout(timer)
    timers.delete(id)
  }
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

export function showToast(
  message: string,
  options: {
    tone?: ToastTone
    actionLabel?: string
    onAction?: () => void
    duration?: number
  } = {},
) {
  const id = uid()
  const duration = options.duration ?? 5000
  toasts = [
    ...toasts.slice(-2),
    {
      id,
      message,
      tone: options.tone ?? "info",
      actionLabel: options.actionLabel,
      onAction: options.onAction,
      duration,
    },
  ]
  emit()
  if (duration > 0) {
    timers.set(
      id,
      window.setTimeout(() => dismissToast(id), duration),
    )
  }
  return id
}

export function showError(message = "Enregistrement impossible. Vérifiez le stockage du navigateur.") {
  return showToast(message, { tone: "error", duration: 6000 })
}
