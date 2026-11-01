/** Cookies httpOnly : sérialisation et lecture, sans dépendance. */

export function readCookie(header, name) {
  if (!header || !name) return null
  for (const part of String(header).split(";")) {
    const index = part.indexOf("=")
    if (index < 0) continue
    const key = part.slice(0, index).trim()
    if (key !== name) continue
    const value = part.slice(index + 1).trim()
    try {
      return decodeURIComponent(value)
    } catch {
      return value
    }
  }
  return null
}

function baseAttributes(options = {}) {
  const attributes = [`Path=${options.path ?? "/"}`, "HttpOnly"]
  if (options.domain) attributes.push(`Domain=${options.domain}`)
  attributes.push(`SameSite=${options.sameSite ?? "Lax"}`)
  if (options.secure) attributes.push("Secure")
  return attributes
}

export function serializeSessionCookie(name, value, options = {}) {
  const attributes = baseAttributes(options)
  attributes.push(`Max-Age=${Math.max(0, Math.floor(options.maxAge ?? 0))}`)
  return `${name}=${encodeURIComponent(value)}; ${attributes.join("; ")}`
}

export function serializeClearCookie(name, options = {}) {
  const attributes = baseAttributes(options)
  attributes.push("Max-Age=0", "Expires=Thu, 01 Jan 1970 00:00:00 GMT")
  return `${name}=; ${attributes.join("; ")}`
}
