import { AuthError } from "../errors.mjs"
import {
  readCookie,
  serializeClearCookie,
  serializeSessionCookie,
} from "../cookies.mjs"

/**
 * Adaptateur Web standard (`Request` → `Response`).
 *
 * Fonctionne tel quel dans :
 *   - Next.js App Router : app/api/auth/[...all]/route.ts
 *   - Hono, Bun, Deno, Cloudflare Workers
 *
 *   const handler = createWebAuthHandler(auth)
 *   export const GET = handler
 *   export const POST = handler
 *   export const PATCH = handler
 */
export function createWebAuthHandler(auth, options = {}) {
  const basePath = (options.basePath ?? "/api/auth").replace(/\/+$/, "")
  const config = auth.config

  function cookieOptions(maxAge) {
    return {
      path: config.cookiePath,
      domain: config.cookieDomain,
      sameSite: config.cookieSameSite,
      secure: config.secureCookies,
      maxAge,
    }
  }

  function tokenFrom(request) {
    const header = request.headers.get("authorization")
    if (header?.startsWith("Bearer ")) return header.slice(7).trim()
    return readCookie(request.headers.get("cookie"), config.cookieName)
  }

  function clientIp(request) {
    const forwarded = request.headers.get("x-forwarded-for")
    if (forwarded) return forwarded.split(",")[0].trim()
    return request.headers.get("x-real-ip") ?? "unknown"
  }

  function respond(result) {
    const headers = new Headers({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    })

    if (result.session) {
      headers.append(
        "set-cookie",
        serializeSessionCookie(
          config.cookieName,
          result.session.token,
          cookieOptions(result.session.maxAge),
        ),
      )
    }
    if (result.clearSession) {
      headers.append(
        "set-cookie",
        serializeClearCookie(config.cookieName, cookieOptions(0)),
      )
    }

    return new Response(JSON.stringify(result.body), {
      status: result.status ?? 200,
      headers,
    })
  }

  function fail(error) {
    if (error instanceof AuthError) {
      const headers = new Headers({ "content-type": "application/json; charset=utf-8" })
      if (error.retryAfter) headers.set("retry-after", String(error.retryAfter))
      return new Response(
        JSON.stringify({
          error: error.message,
          code: error.code,
          ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
        }),
        { status: error.status, headers },
      )
    }
    console.error("[aura-auth]", error)
    return new Response(
      JSON.stringify({
        error: "Une erreur est survenue. Réessaie dans un instant.",
        code: "server_error",
      }),
      { status: 500, headers: { "content-type": "application/json" } },
    )
  }

  return async function handle(request) {
    const url = new URL(request.url)
    if (!url.pathname.startsWith(basePath)) {
      return new Response("Not found", { status: 404 })
    }

    const path = url.pathname.slice(basePath.length) || "/"
    const method = request.method.toUpperCase()
    const key = `${method} ${path}`

    try {
      if (method === "POST" || method === "PATCH") {
        const contentType = request.headers.get("content-type") ?? ""
        if (!contentType.includes("application/json")) {
          return new Response(
            JSON.stringify({
              error: "Content-Type application/json requis",
              code: "invalid_content_type",
            }),
            { status: 415, headers: { "content-type": "application/json" } },
          )
        }
      }

      const body =
        method === "POST" || method === "PATCH"
          ? await request.json().catch(() => {
              throw new AuthError(400, "Corps de requête JSON invalide", {
                code: "invalid_json",
              })
            })
          : {}

      const ip = clientIp(request)
      const token = tokenFrom(request)

      switch (key) {
        case "POST /register":
          return respond(await auth.register({ ...body, ip }))
        case "POST /login":
          return respond(await auth.login({ ...body, ip }))
        case "POST /logout":
          return respond(await auth.logout())
        case "POST /send-otp":
          return respond(await auth.sendOtp({ ...body, ip }))
        case "POST /verify-otp":
          return respond(await auth.verifyOtp({ ...body, ip }))
        case "POST /resend-otp":
          return respond(await auth.resendOtp({ ...body, ip }))
        case "POST /forgot-password":
          return respond(await auth.forgotPassword({ ...body, ip }))
        case "POST /reset-password":
          return respond(await auth.resetPassword({ ...body, ip }))
        case "POST /change-password": {
          const user = await auth.requireSession({ token })
          return respond(
            await auth.changePassword({ ...body, userId: user.id, ip }),
          )
        }
        case "GET /me":
          return respond(await auth.me({ token }))
        case "PATCH /me": {
          const user = await auth.requireSession({ token })
          return respond(
            await auth.updateProfile({ token, patch: body, userId: user.id }),
          )
        }
        default:
          return new Response(
            JSON.stringify({ error: "Route inconnue", code: "not_found" }),
            { status: 404, headers: { "content-type": "application/json" } },
          )
      }
    } catch (error) {
      return fail(error)
    }
  }
}
