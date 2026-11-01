import { randomBytes, scrypt, timingSafeEqual } from "node:crypto"
import { promisify } from "node:util"

/**
 * Hachage des mots de passe avec scrypt (natif Node).
 *
 * Format stocké : scrypt$N$r$p$salt$hash (base64url).
 * Les paramètres sont relus depuis la chaîne : on peut les augmenter plus tard
 * sans invalider les anciens hashes.
 */

const scryptAsync = promisify(scrypt)

export const SCRYPT = Object.freeze({
  N: 16384,
  r: 8,
  p: 1,
  keyLength: 64,
  maxmem: 64 * 1024 * 1024,
})

function normalize(password) {
  return String(password ?? "").normalize("NFKC")
}

export async function hashPassword(password) {
  const salt = randomBytes(16)
  const key = await scryptAsync(normalize(password), salt, SCRYPT.keyLength, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: SCRYPT.maxmem,
  })
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    key.toString("base64url"),
  ].join("$")
}

export async function verifyPassword(password, stored) {
  try {
    const [algorithm, n, r, p, saltB64, hashB64] = String(stored ?? "").split("$")
    if (algorithm !== "scrypt") return false

    const params = { N: Number(n), r: Number(r), p: Number(p), maxmem: SCRYPT.maxmem }
    if (
      !Number.isInteger(params.N) ||
      !Number.isInteger(params.r) ||
      !Number.isInteger(params.p) ||
      params.N < 1024 ||
      params.N > 1_048_576 ||
      params.r < 1 ||
      params.r > 32 ||
      params.p < 1 ||
      params.p > 16
    ) {
      return false
    }

    const salt = Buffer.from(saltB64, "base64url")
    const expected = Buffer.from(hashB64, "base64url")
    if (salt.length < 8 || expected.length < 16) return false

    const key = await scryptAsync(normalize(password), salt, expected.length, params)
    return key.length === expected.length && timingSafeEqual(key, expected)
  } catch {
    return false
  }
}

/**
 * Hash factice, calculé une seule fois : il garde un temps de réponse proche
 * quand l'email saisi n'existe pas (anti-énumération par timing).
 */
let dummyHashPromise
export function dummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(randomBytes(24).toString("base64url"))
  }
  return dummyHashPromise
}
