import { CheckCircle2, Info, X, XCircle } from "lucide-react"
import { useSyncExternalStore } from "react"
import { cn } from "../../utils/cn"
import {
  dismissToast,
  getToasts,
  subscribeToasts,
  type ToastItem,
} from "../../utils/toast"

export function ToastHost() {
  const toasts = useSyncExternalStore(subscribeToasts, getToasts, getToasts)
  if (toasts.length === 0) return null

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-[92px] z-[120] flex flex-col items-center gap-2 px-4"
      role="status"
      aria-live="polite"
    >
      {toasts.map((toast) => (
        <ToastCard key={toast.id} toast={toast} />
      ))}
    </div>
  )
}

function ToastCard({ toast }: { toast: ToastItem }) {
  const Icon =
    toast.tone === "success" ? CheckCircle2 : toast.tone === "error" ? XCircle : Info

  return (
    <div
      className={cn(
        "pointer-events-auto flex w-full max-w-[398px] items-center gap-3 rounded-xl px-4 py-3 text-sm text-white shadow-lg",
        toast.tone === "error" ? "bg-[#c62828]" : "bg-[#263238]",
      )}
    >
      <Icon className="h-4.5 w-4.5 shrink-0" />
      <span className="min-w-0 flex-1 leading-snug">{toast.message}</span>
      {toast.actionLabel && toast.onAction ? (
        <button
          type="button"
          className="shrink-0 rounded-md px-2 py-1 text-[13px] font-bold uppercase tracking-wide text-teal-muted"
          onClick={() => {
            toast.onAction?.()
            dismissToast(toast.id)
          }}
        >
          {toast.actionLabel}
        </button>
      ) : null}
      <button
        type="button"
        aria-label="Fermer la notification"
        className="shrink-0 text-white/70"
        onClick={() => dismissToast(toast.id)}
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
