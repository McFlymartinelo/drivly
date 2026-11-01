import {
  AlarmClock,
  BarChart3,
  List,
  MoreHorizontal,
  Plus,
  X,
} from "lucide-react"
import {
  useCallback,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { useLocation, useNavigate } from "react-router-dom"
import { cn } from "../../utils/cn"
import { stepSpring, useRafLoop } from "../../hooks/useSpring"

const tabs = [
  { id: "history", to: "/", label: "Historique", icon: List, end: true },
  { id: "reports", to: "/rapports", label: "Rapports", icon: BarChart3, end: false },
  { id: "add", to: null, label: "Ajouter", icon: Plus, end: false },
  { id: "reminders", to: "/rappels", label: "Rappels", icon: AlarmClock, end: false },
  { id: "more", to: "/plus", label: "Plus", icon: MoreHorizontal, end: false },
] as const

const DRAG_THRESHOLD = 12
const PILL_TOP = 6

function tabIndexFromPath(pathname: string, quickAddOpen: boolean): number {
  if (quickAddOpen) return 2
  const idx = tabs.findIndex((tab) => {
    if (!tab.to) return false
    return tab.end ? pathname === tab.to : pathname.startsWith(tab.to)
  })
  return idx === -1 ? 0 : idx
}

export function BottomNav({
  quickAddOpen,
  onToggleQuickAdd,
}: {
  quickAddOpen: boolean
  onToggleQuickAdd: () => void
}) {
  const location = useLocation()
  const navigate = useNavigate()
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  const barRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([])
  const centersRef = useRef<number[]>([])

  const [box, setBox] = useState({ w: 320, h: 65, pad: 1 })
  const [light, setLight] = useState({ x: 40, stretch: 0 })

  const activeIndex = tabIndexFromPath(location.pathname, quickAddOpen)
  const targetIndex = useRef(activeIndex)
  const spring = useRef({ x: 40, v: 0 })
  const pointerStart = useRef<{ x: number; id: number } | null>(null)
  const dragX = useRef<number | null>(null)
  const dragging = useRef(false)
  const ignoreClick = useRef(false)
  const inited = useRef(false)
  const settled = useRef(false)

  const measure = useCallback(() => {
    const bar = barRef.current
    if (!bar) return
    const barBox = bar.getBoundingClientRect()
    setBox({ w: barBox.width, h: barBox.height, pad: bar.clientLeft })
    const centers: number[] = []
    iconRefs.current.forEach((icon) => {
      if (!icon) return
      const r = icon.getBoundingClientRect()
      centers.push(r.left - barBox.left + r.width / 2)
    })
    if (centers.length === tabs.length) centersRef.current = centers
    if (!inited.current && centers.length === tabs.length) {
      const c = centers[activeIndex] ?? centers[0]
      spring.current = { x: c, v: 0 }
      setLight({ x: c, stretch: 0 })
      inited.current = true
    }
  }, [activeIndex])

  useLayoutEffect(() => {
    measure()
    const bar = barRef.current
    if (!bar) return
    const ro = new ResizeObserver(() => measure())
    ro.observe(bar)
    return () => ro.disconnect()
  }, [measure])

  useLayoutEffect(() => {
    if (!dragging.current) {
      targetIndex.current = activeIndex
      settled.current = false
    }
  }, [activeIndex])

  useRafLoop(true, (dt) => {
    const centers = centersRef.current
    if (centers.length !== tabs.length) return
    const cx = dragX.current ?? centers[targetIndex.current] ?? 0
    if (reduced) {
      spring.current = { x: cx, v: 0 }
    } else {
      stepSpring(spring.current, cx, dt, 520, 34)
    }
    const stretch = Math.min(0.28, Math.abs(spring.current.v) / 1400)
    const still =
      !dragging.current &&
      Math.abs(spring.current.v) < 6 &&
      Math.abs(spring.current.x - cx) < 0.4
    if (still && settled.current) return
    settled.current = still
    setLight({ x: spring.current.x, stretch: still ? 0 : stretch })
  })

  function nearestIndex(x: number): number {
    const centers = centersRef.current
    let best = 0
    let dist = Infinity
    centers.forEach((c, i) => {
      const d = Math.abs(c - x)
      if (d < dist) {
        dist = d
        best = i
      }
    })
    return best
  }

  function localX(clientX: number): number {
    const bar = barRef.current
    if (!bar) return 0
    const rect = bar.getBoundingClientRect()
    const min = centersRef.current[0] ?? 0
    const max = centersRef.current[centersRef.current.length - 1] ?? rect.width
    return Math.min(max, Math.max(min, clientX - rect.left))
  }

  function activate(index: number) {
    const tab = tabs[index]
    targetIndex.current = index
    dragX.current = null
    dragging.current = false
    settled.current = false
    if (!tab.to) {
      onToggleQuickAdd()
      return
    }
    if (quickAddOpen) onToggleQuickAdd()
    if (location.pathname !== tab.to) navigate(tab.to)
  }

  function onBarPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) return
    pointerStart.current = { x: event.clientX, id: event.pointerId }
    dragging.current = false
    ignoreClick.current = false
    dragX.current = null
  }

  function onBarPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId) return
    const dx = event.clientX - start.x
    if (!dragging.current && Math.abs(dx) < DRAG_THRESHOLD) return
    if (!dragging.current) {
      dragging.current = true
      ignoreClick.current = true
      settled.current = false
      event.currentTarget.setPointerCapture(event.pointerId)
    }
    dragX.current = localX(event.clientX)
  }

  function endPointer(event: ReactPointerEvent<HTMLDivElement>) {
    const start = pointerStart.current
    if (!start || start.id !== event.pointerId) return
    const wasDragging = dragging.current
    pointerStart.current = null
    dragging.current = false
    dragX.current = null
    if (wasDragging) {
      activate(nearestIndex(localX(event.clientX)))
    }
    try {
      event.currentTarget.releasePointerCapture(event.pointerId)
    } catch {
      /* not captured */
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return
    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]'),
    )
    if (buttons.length === 0) return
    const current = buttons.findIndex((button) => button === document.activeElement)
    const delta = event.key === "ArrowRight" ? 1 : -1
    const next = (current + delta + buttons.length) % buttons.length
    event.preventDefault()
    buttons[next]?.focus()
    activate(next)
  }

  const pillW = Math.max(44, (box.w - 18) / tabs.length - 4)
  const pillH = Math.max(40, box.h - 12)
  const showPill = activeIndex !== 2

  return (
    <nav className="relative z-40 bg-transparent px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-1">
      <div
        ref={barRef}
        className="aura-glass relative flex touch-none items-end justify-between overflow-visible rounded-full px-[7px] pt-1.5 pb-[5px] shadow-lg select-none"
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onKeyDown}
        role="tablist"
        aria-label="Navigation principale. Touchez un onglet ou faites glisser la lumière."
      >
        <div
          aria-hidden
          className="aura-tabbar__pill"
          style={{
            top: PILL_TOP,
            bottom: "auto",
            left: 0,
            width: pillW,
            height: pillH,
            opacity: showPill ? 1 : 0,
            transform: `translateX(${(light.x - pillW / 2 - box.pad).toFixed(2)}px) scaleX(${(
              1 +
              light.stretch * 0.45
            ).toFixed(3)})`,
            transition: "opacity 200ms var(--aura-ease-out)",
          }}
        />

        {tabs.map((tab, i) => {
          const Icon = tab.icon
          const active = i === activeIndex
          const isAdd = tab.id === "add"
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              aria-label={tab.label}
              tabIndex={active ? 0 : -1}
              className={cn(
                "relative z-10 flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1",
                isAdd && "h-12 justify-end",
              )}
              onClick={() => {
                if (ignoreClick.current) {
                  ignoreClick.current = false
                  return
                }
                activate(i)
              }}
            >
              <span
                ref={(el) => {
                  iconRefs.current[i] = el
                }}
                className={cn(
                  "grid place-items-center transition-colors",
                  isAdd
                    ? "absolute left-1/2 top-[-14px] h-10 w-10 -translate-x-1/2 rounded-[13px] bg-[var(--aura-accent-solid)] text-[var(--aura-on-accent)] shadow-[var(--aura-shadow-accent)]"
                    : "h-8 w-8 rounded-full",
                  !isAdd && active && "text-[var(--aura-accent-strong)]",
                  !isAdd && !active && "text-muted",
                )}
              >
                {isAdd && quickAddOpen ? (
                  <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                ) : (
                  <Icon
                    className={isAdd ? "h-[18px] w-[18px]" : "h-5 w-5"}
                    strokeWidth={active || isAdd ? 2.4 : 1.8}
                  />
                )}
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[10px] font-semibold tracking-[-0.01em]",
                  isAdd || active
                    ? "text-[var(--aura-accent-strong)]"
                    : "text-muted",
                )}
              >
                {isAdd ? (quickAddOpen ? "Fermer" : "Ajouter") : tab.label}
              </span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}
