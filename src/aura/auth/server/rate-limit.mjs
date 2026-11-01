import { AuthError } from "./errors.mjs"

/**
 * Rate limiter mémoire, fenêtre glissante par clé (IP).
 *
 * Limite assumée : une seule instance Node. Derrière un load balancer ou en
 * serverless, chaque instance a son propre compteur — pour un déploiement
 * multi-instance, fournir un limiteur partagé (Redis) est nécessaire.
 */
export function createRateLimiter({ windowMs, max } = {}) {
  const hits = new Map()
  let lastSweep = Date.now()

  function sweep(now) {
    if (now - lastSweep < windowMs) return
    lastSweep = now
    for (const [key, timestamps] of hits) {
      const recent = timestamps.filter((time) => now - time < windowMs)
      if (recent.length) hits.set(key, recent)
      else hits.delete(key)
    }
  }

  function check(key = "unknown") {
    const now = Date.now()
    sweep(now)

    const recent = (hits.get(key) ?? []).filter((time) => now - time < windowMs)
    if (recent.length >= max) {
      const retryAfter = Math.max(
        1,
        Math.ceil((recent[0] + windowMs - now) / 1000),
      )
      throw new AuthError(
        429,
        `Trop de tentatives, réessaie dans ${retryAfter}s`,
        { code: "rate_limited", retryAfter },
      )
    }

    recent.push(now)
    hits.set(key, recent)
  }

  function reset() {
    hits.clear()
  }

  return { check, reset }
}
