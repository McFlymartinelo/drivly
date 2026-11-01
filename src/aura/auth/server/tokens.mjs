import { createHmac, timingSafeEqual } from "node:crypto"

/**
 * JWT HS256 minimal, sans dépendance.
 *
 * On n'implémente que ce dont l'auth a besoin : HS256, `exp`, `iat`.
 * Pas de `alg: none`, pas de clé publique, pas de JWE.
 */

const HEADER = Buffer.from(
  JSON.stringify({ alg: "HS256", typ: "JWT" }),
).toString("base64url")

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url")
}

function signature(data, secret) {
  return createHmac("sha256", secret).update(data).digest()
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000)
}

export function signJwt(payload, secret, ttlSeconds) {
  const issuedAt = nowSeconds()
  const body = { ...payload, iat: issuedAt, exp: issuedAt + ttlSeconds }
  const data = `${HEADER}.${encode(body)}`
  return `${data}.${signature(data, secret).toString("base64url")}`
}

export class TokenError extends Error {
  constructor(message) {
    super(message)
    this.name = "TokenError"
  }
}

export function verifyJwt(token, secret) {
  if (typeof token !== "string" || token.length > 4096) {
    throw new TokenError("Token invalide")
  }

  const parts = token.split(".")
  if (parts.length !== 3) throw new TokenError("Token invalide")

  const [header, body, provided] = parts
  const data = `${header}.${body}`
  const expected = signature(data, secret)
  const given = Buffer.from(provided, "base64url")

  if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
    throw new TokenError("Signature invalide")
  }

  let decodedHeader
  let payload
  try {
    decodedHeader = JSON.parse(Buffer.from(header, "base64url").toString("utf8"))
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"))
  } catch {
    throw new TokenError("Token illisible")
  }

  if (decodedHeader?.alg !== "HS256") throw new TokenError("Algorithme refusé")
  if (typeof payload?.exp !== "number" || payload.exp <= nowSeconds()) {
    throw new TokenError("Token expiré")
  }
  if (typeof payload?.iat === "number" && payload.iat > nowSeconds() + 60) {
    throw new TokenError("Token émis dans le futur")
  }

  return payload
}
