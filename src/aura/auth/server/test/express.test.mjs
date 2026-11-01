import assert from "node:assert/strict"
import test from "node:test"
import { createAuthService } from "../index.mjs"
import { createSqliteDb } from "../adapters/sqlite.mjs"
import { createExpressAuthRouter } from "../adapters/express.mjs"

let express = null
try {
  express = (await import("express")).default
} catch {
  express = null
}

test(
  "adaptateur Express : inscription → OTP → cookie → /me",
  { skip: express ? false : "express non installé dans ce projet" },
  async (t) => {
    const db = createSqliteDb({ file: ":memory:" })
    const messages = []
    const auth = createAuthService({
      db,
      mailer: async (message) => messages.push(message),
      config: {
        secret: "aura-express-test-secret-0123456789abcdef",
        echoOtp: true,
        rateLimitMax: 1000,
        rateLimitOtpMax: 1000,
      },
    })

    const app = express()
    app.use("/api/auth", createExpressAuthRouter(auth))

    const server = app.listen(0)
    t.after(() => server.close())
    await new Promise((resolve) => server.once("listening", resolve))
    const base = `http://127.0.0.1:${server.address().port}/api/auth`

    const registered = await fetch(`${base}/register`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "express@example.com",
        password: "motdepasse123",
        displayName: "Express",
      }),
    })
    assert.equal(registered.status, 201)
    const challenge = await registered.json()
    assert.equal(challenge.needsOtp, true)

    const verified = await fetch(`${base}/verify-otp`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        otpToken: challenge.otpToken,
        code: messages.at(-1).code,
      }),
    })
    assert.equal(verified.status, 200)

    const rawCookie = verified.headers.getSetCookie()[0]
    assert.match(rawCookie, /aura_session=/)
    assert.match(rawCookie, /HttpOnly/i)
    const cookie = rawCookie.split(";")[0]

    const me = await fetch(`${base}/me`, { headers: { cookie } })
    assert.equal(me.status, 200)
    const payload = await me.json()
    assert.equal(payload.user.email, "express@example.com")

    const unauthorized = await fetch(`${base}/me`)
    assert.equal(unauthorized.status, 401)
  },
)
