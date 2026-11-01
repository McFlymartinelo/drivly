import { createWebAuthHandler } from "./web.mjs"

/**
 * Adaptateur `node:http` (sans Express).
 *
 *   const handleAuth = createNodeAuthHandler(auth, { basePath: "/api/auth" })
 *
 *   const server = http.createServer(async (req, res) => {
 *     if (await handleAuth(req, res)) return
 *     // … le reste des routes
 *   })
 *
 * Renvoie `true` si la requête a été traitée (auth), `false` sinon.
 */
export function createNodeAuthHandler(auth, options = {}) {
  const basePath = (options.basePath ?? "/api/auth").replace(/\/+$/, "")
  const maxBody = options.maxBody ?? 1024 * 1024
  const web = createWebAuthHandler(auth, { basePath })

  async function readBody(req) {
    const chunks = []
    let size = 0
    for await (const chunk of req) {
      size += chunk.length
      if (size > maxBody) {
        const error = new Error("Corps de requête trop volumineux.")
        error.status = 413
        throw error
      }
      chunks.push(chunk)
    }
    return Buffer.concat(chunks)
  }

  return async function handleNodeAuth(req, res) {
    const url = new URL(
      req.url ?? "/",
      `http://${req.headers.host ?? "localhost"}`,
    )
    if (!url.pathname.startsWith(basePath)) return false

    let body
    if (req.method && req.method !== "GET" && req.method !== "HEAD") {
      const buffer = await readBody(req)
      if (buffer.length > 0) body = buffer
    }

    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (value === undefined) continue
      if (Array.isArray(value)) {
        for (const item of value) headers.append(key, item)
      } else {
        headers.set(key, String(value))
      }
    }

    const request = new Request(url, {
      method: req.method ?? "GET",
      headers,
      body,
    })

    let response
    try {
      response = await web(request)
    } catch (error) {
      const status = Number(error?.status) || 500
      if (status >= 500) console.error("[aura-auth]", error)
      response = new Response(
        JSON.stringify({
          error: status === 413 ? "Corps de requête trop volumineux." : "Erreur serveur.",
          code: status === 413 ? "payload_too_large" : "server_error",
        }),
        {
          status,
          headers: { "content-type": "application/json; charset=utf-8" },
        },
      )
    }

    res.statusCode = response.status
    for (const [key, value] of response.headers) {
      if (key === "set-cookie") continue
      res.setHeader(key, value)
    }

    const cookies =
      typeof response.headers.getSetCookie === "function"
        ? response.headers.getSetCookie()
        : []
    if (cookies.length) res.setHeader("set-cookie", cookies)

    res.end(Buffer.from(await response.arrayBuffer()))
    return true
  }
}
