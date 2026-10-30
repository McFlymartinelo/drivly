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
  useId,
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

const RING = 18
const DRAG_THRESHOLD = 12

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
  const glowId = useId().replace(/:/g, "")
  const reduced = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    [],
  )

  const barRef = useRef<HTMLDivElement>(null)
  const iconRefs = useRef<(HTMLSpanElement | null)[]>([])
  const centersRef = useRef<number[]>([])
  const cyRef = useRef(22)

  const [box, setBox] = useState({ w: 320, h: 64 })
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
    setBox({ w: barBox.width, h: barBox.height })
    const centers: number[] = []
    let cy = 22
    iconRefs.current.forEach((icon) => {
      if (!icon) return
      const r = icon.getBoundingClientRect()
      centers.push(r.left - barBox.left + r.width / 2)
      cy = r.top - barBox.top + r.height / 2
    })
    if (centers.length === tabs.length) centersRef.current = centers
    cyRef.current = cy
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

  const rx = RING * (1 + light.stretch)
  const ry = RING * (1 - light.stretch * 0.25)

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

  return (
    <nav className="relative z-40 bg-transparent px-3 pb-[calc(12px+env(safe-area-inset-bottom))] pt-1">
      <div
        ref={barRef}
        className="relative flex touch-none items-end justify-between overflow-visible rounded-full border border-white/70 bg-white/75 px-1.5 pb-1.5 pt-2 shadow-[0_8px_32px_rgba(0,174,239,0.18)] backdrop-blur-xl select-none"
        onPointerDown={onBarPointerDown}
        onPointerMove={onBarPointerMove}
        onPointerUp={endPointer}
        onPointerCancel={endPointer}
        onKeyDown={onKeyDown}
        role="tablist"
        aria-label="Navigation principale. Touchez un onglet ou faites glisser la lumière."
      >
        <svg
          className="pointer-events-none absolute left-0 top-0 overflow-visible"
          width={box.w}
          height={box.h}
          aria-hidden
        >
          <defs>
            <filter id={`glow-${glowId}`} x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          <ellipse
            cx={light.x}
            cy={cyRef.current}
            rx={rx + 3}
            ry={ry + 3}
            fill="none"
            stroke="#7dd8f7"
            strokeWidth="7"
            opacity="0.28"
            filter={`url(#glow-${glowId})`}
          />
          <ellipse
            cx={light.x}
            cy={cyRef.current}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="#00AEEF"
            strokeWidth="2.2"
            filter={`url(#glow-${glowId})`}
          />
          <ellipse
            cx={light.x}
            cy={cyRef.current}
            rx={rx}
            ry={ry}
            fill="none"
            stroke="#e8f9ff"
            strokeWidth="1"
          />
        </svg>

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
              className="relative z-10 flex min-w-0 flex-1 flex-col items-center gap-0.5 px-1"
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
                  "grid h-8 w-8 place-items-center rounded-full transition-colors",
                  isAdd && "bg-teal text-white shadow-md shadow-teal/40",
                  !isAdd && active && "text-teal",
                  !isAdd && !active && "text-muted",
                )}
              >
                {isAdd && quickAddOpen ? (
                  <X className="h-[18px] w-[18px]" strokeWidth={2.4} />
                ) : (
                  <Icon className="h-5 w-5" strokeWidth={active || isAdd ? 2.4 : 1.8} />
                )}
              </span>
              <span
                className={cn(
                  "max-w-full truncate text-[10px] font-medium",
                  isAdd ? "text-teal" : active ? "text-teal" : "text-muted",
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
