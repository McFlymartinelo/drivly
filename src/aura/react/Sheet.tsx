import { useEffect, useId, useRef, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { cn } from "./cn"
import { XIcon } from "./icons"

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

export interface SheetProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  description?: ReactNode
  children?: ReactNode
  footer?: ReactNode
  dismissible?: boolean
  className?: string
}

/**
 * Bottom sheet accessible : piège de focus, fermeture Échap, verrouillage
 * du scroll et restitution du focus à la fermeture.
 */
export function Sheet({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  dismissible = true,
  className,
}: SheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descriptionId = useId()
  const onCloseRef = useRef(onClose)
  const restoreRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    onCloseRef.current = onClose
  }, [onClose])

  useEffect(() => {
    if (!open) return
    restoreRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null

    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus()

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && dismissible) {
        event.preventDefault()
        onCloseRef.current()
        return
      }
      if (event.key !== "Tab" || !panel) return
      const nodes = Array.from(
        panel.querySelectorAll<HTMLElement>(FOCUSABLE),
      ).filter((node) => node.offsetParent !== null)
      if (nodes.length === 0) {
        event.preventDefault()
        panel.focus()
        return
      }
      const firstNode = nodes[0]
      const lastNode = nodes[nodes.length - 1]
      if (event.shiftKey && document.activeElement === firstNode) {
        event.preventDefault()
        lastNode.focus()
      } else if (!event.shiftKey && document.activeElement === lastNode) {
        event.preventDefault()
        firstNode.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      document.body.style.overflow = previousOverflow
      restoreRef.current?.focus?.()
    }
  }, [open, dismissible])

  if (!open || typeof document === "undefined") return null

  return createPortal(
    <div className="aura-scrim" onClick={dismissible ? onClose : undefined}>
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={cn("aura-sheet", className)}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="aura-sheet__handle" aria-hidden />
        {title || description ? (
          <div className="aura-sheet__header">
            <div style={{ minWidth: 0, flex: 1 }}>
              {title ? (
                <h2 id={titleId} className="aura-sheet__title">
                  {title}
                </h2>
              ) : null}
              {description ? (
                <p id={descriptionId} className="aura-sheet__desc">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <button
                type="button"
                aria-label="Fermer"
                className="aura-iconbtn"
                onClick={onClose}
              >
                <XIcon />
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="aura-sheet__body">{children}</div>
        {footer ? <div className="aura-sheet__footer">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}
