import { useEffect, useRef } from "react"

interface Spring {
  x: number
  v: number
}

const STIFFNESS = 240
const DAMPING = 26

export function stepSpring(
  s: Spring,
  target: number,
  dt: number,
  stiffness = STIFFNESS,
  damping = DAMPING,
): void {
  const accel = -stiffness * (s.x - target) - damping * s.v
  s.v += accel * dt
  s.x += s.v * dt
  if (Math.abs(s.x - target) < 0.15 && Math.abs(s.v) < 8) {
    s.x = target
    s.v = 0
  }
}

export function useRafLoop(enabled: boolean, tick: (dt: number) => void): void {
  const tickRef = useRef(tick)
  tickRef.current = tick

  useEffect(() => {
    if (!enabled) return
    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000)
      last = now
      tickRef.current(dt)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [enabled])
}
