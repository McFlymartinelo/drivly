import { useEffect, useState } from "react"

/** Courbes et durées alignées sur les tokens CSS. */
export const duration = {
  fast: 0.12,
  base: 0.2,
  slow: 0.32,
  slower: 0.52,
}

export const easeOut = [0.22, 1, 0.36, 1] as const
export const easeInOut = [0.65, 0, 0.35, 1] as const
export const easeSpring = [0.34, 1.46, 0.64, 1] as const

export const spring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 32,
  mass: 0.9,
}

export const softSpring = {
  type: "spring" as const,
  stiffness: 260,
  damping: 28,
  mass: 1,
}

/** Variants compatibles Motion / Framer Motion. */
export const fadeUp = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -6 },
  transition: { duration: 0.32, ease: easeOut },
}

export const fade = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.24, ease: easeOut },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.96 },
  animate: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.98 },
  transition: spring,
}

export const staggerParent = {
  animate: { transition: { staggerChildren: 0.045, delayChildren: 0.03 } },
}

export const staggerChild = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.34, ease: easeOut } },
}

export const sheet = {
  initial: { y: "100%" },
  animate: { y: 0 },
  exit: { y: "100%" },
  transition: softSpring,
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches)
    media.addEventListener("change", onChange)
    return () => media.removeEventListener("change", onChange)
  }, [])

  return reduced
}

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

/**
 * Change d'écran avec la View Transitions API quand elle existe.
 * Sans support (ou avec reduced motion), la mise à jour est immédiate.
 */
export function withViewTransition(update: () => void): void {
  if (typeof document === "undefined") {
    update()
    return
  }
  const doc = document as ViewTransitionDocument
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!doc.startViewTransition || reduced) {
    update()
    return
  }
  doc.startViewTransition(update)
}
