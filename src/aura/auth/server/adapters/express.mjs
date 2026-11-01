import express from "express"
import { AuthError } from "../errors.mjs"
import { readCookie } from "../cookies.mjs"

/**
 * Adaptateur Express.
 *
 *   app.use("/api/auth", createExpressAuthRouter(auth, { cors: "https://app.fr" }))
 *
 * `express` reste une dépendance de l'application hôte, pas du kit.
 */
export function createExpressAuthRouter(auth, options = {}) {
  const { cors, jsonLimit = "16kb" } = options
  const config = auth.config
  const router = express.Router()

  if (cors) {
    const origin = typeof cors === "string" ? cors : cors.origin
    if (!origin || origin === "*") {
      throw new Error(
        "createExpressAuthRouter : cors doit préciser une origine (les cookies httpOnly interdisent '*').",
      )
    }
    router.use((req, res, next) => {
      res.setHeader("Access-Control-Allow-Origin", origin)
      res.setHeader("Vary", "Origin")
      res.setHeader("Access-Control-Allow-Credentials", "true")
      res.setHeader("Access-Control-Allow-Headers", "content-type, authorization")
      res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
      if (req.method === "OPTIONS") return res.sendStatus(204)
      next()
    })
  }

  router.use(express.json({ limit: jsonLimit }))

  function tokenFrom(req) {
    const header = req.headers.authorization
    if (typeof header === "string" && header.startsWith("Bearer ")) {
      return header.slice(7).trim()
    }
    return readCookie(req.headers.cookie, config.cookieName)
  }

  function cookieOptions(maxAge) {
    return {
      httpOnly: true,
      secure: config.secureCookies,
      sameSite: config.cookieSameSite,
      path: config.cookiePath,
      domain: config.cookieDomain,
      maxAge: maxAge * 1000,
    }
  }

  function send(res, result) {
    if (result.session) {
      res.cookie(
        config.cookieName,
        result.session.token,
        cookieOptions(result.session.maxAge),
      )
    }
    if (result.clearSession) {
      res.clearCookie(config.cookieName, {
        httpOnly: true,
        secure: config.secureCookies,
        sameSite: config.cookieSameSite,
        path: config.cookiePath,
        domain: config.cookieDomain,
      })
    }
    return res.status(result.status ?? 200).json(result.body)
  }

  function fail(res, error) {
    if (error instanceof AuthError) {
      if (error.retryAfter) {
        res.setHeader("Retry-After", String(error.retryAfter))
      }
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...(error.retryAfter ? { retryAfter: error.retryAfter } : {}),
      })
    }
    console.error("[aura-auth]", error)
    return res.status(500).json({
      error: "Une erreur est survenue. Réessaie dans un instant.",
      code: "server_error",
    })
  }

  function route(handler) {
    return async (req, res) => {
      try {
        const result = await handler(req)
        return send(res, result)
      } catch (error) {
        return fail(res, error)
      }
    }
  }

  async function requireUser(req) {
    return auth.requireSession({ token: tokenFrom(req) })
  }

  router.post(
    "/register",
    route((req) => auth.register({ ...req.body, ip: req.ip })),
  )
  router.post(
    "/login",
    route((req) => auth.login({ ...req.body, ip: req.ip })),
  )
  router.post("/logout", route(() => auth.logout()))
  router.post(
    "/send-otp",
    route((req) => auth.sendOtp({ ...req.body, ip: req.ip })),
  )
  router.post(
    "/verify-otp",
    route((req) => auth.verifyOtp({ ...req.body, ip: req.ip })),
  )
  router.post(
    "/resend-otp",
    route((req) => auth.resendOtp({ ...req.body, ip: req.ip })),
  )
  router.post(
    "/forgot-password",
    route((req) => auth.forgotPassword({ ...req.body, ip: req.ip })),
  )
  router.post(
    "/reset-password",
    route((req) => auth.resetPassword({ ...req.body, ip: req.ip })),
  )
  router.post(
    "/change-password",
    route(async (req) => {
      const user = await requireUser(req)
      return auth.changePassword({
        ...req.body,
        userId: user.id,
        ip: req.ip,
      })
    }),
  )
  router.get(
    "/me",
    route((req) => auth.me({ token: tokenFrom(req) })),
  )
  router.patch(
    "/me",
    route((req) => auth.updateProfile({ token: tokenFrom(req), patch: req.body })),
  )

  // JSON malformé : erreur claire plutôt qu'un 500 de body-parser.
  router.use((error, req, res, next) => {
    if (error?.type === "entity.parse.failed") {
      return res.status(400).json({
        error: "Corps de requête JSON invalide",
        code: "invalid_json",
      })
    }
    return next(error)
  })

  return router
}
