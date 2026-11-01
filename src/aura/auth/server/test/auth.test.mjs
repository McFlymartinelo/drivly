import assert from "node:assert/strict"
import test from "node:test"
import { createAuthService } from "../index.mjs"
import { createSqliteDb } from "../adapters/sqlite.mjs"
import { createWebAuthHandler } from "../adapters/web.mjs"

const SECRET = "aura-test-secret-0123456789-abcdefghijklmnop"

function setup(overrides = {}) {
  const db = createSqliteDb({ file: ":memory:" })
  const messages = []
  const auth = createAuthService({
    db,
    mailer: async (message) => {
      messages.push(message)
    },
    config: {
      secret: SECRET,
      echoOtp: true,
      requireOtpOnLogin: true,
      requireEmailVerification: true,
      rateLimitMax: 1000,
      rateLimitOtpMax: 1000,
      ...overrides,
    },
  })
  return {
    db,
    auth,
    messages,
    lastCode: () => messages.at(-1)?.code,
  }
}

async function registerVerified(auth, lastCode, overrides = {}) {
  const registered = await auth.register({
    email: "alex@example.com",
    password: "motdepasse123",
    displayName: "Alex",
    ip: "test",
    ...overrides,
  })
  assert.equal(registered.body.needsOtp, true)
  return auth.verifyOtp({
    otpToken: registered.body.otpToken,
    code: lastCode(),
    ip: "test",
  })
}

test("inscription : OTP puis session", async () => {
  const { auth, messages, lastCode } = setup()

  const registered = await auth.register({
    email: "Alex@Example.com",
    password: "motdepasse123",
    displayName: "Alex",
    ip: "test",
  })

  assert.equal(registered.status, 201)
  assert.equal(registered.body.needsOtp, true)
  assert.equal(registered.body.emailMasked, "a***@example.com")
  assert.equal(messages.length, 1)
  assert.equal(messages[0].to, "alex@example.com")

  const verified = await auth.verifyOtp({
    otpToken: registered.body.otpToken,
    code: lastCode(),
    ip: "test",
  })

  assert.equal(verified.status, 200)
  assert.equal(verified.body.user.emailVerified, true)
  assert.ok(verified.session.token)

  const me = await auth.me({ token: verified.session.token })
  assert.equal(me.body.user.email, "alex@example.com")
})

test("connexion : mauvais mot de passe refusé sans fuite", async () => {
  const { auth, lastCode } = setup()
  await registerVerified(auth, lastCode)

  await assert.rejects(
    () =>
      auth.login({
        identifier: "alex@example.com",
        password: "mauvais",
        ip: "test",
      }),
    (error) => error.status === 401 && error.code === "invalid_credentials",
  )
})

test("connexion : OTP à chaque connexion", async () => {
  const { auth, lastCode } = setup()
  await registerVerified(auth, lastCode)

  const login = await auth.login({
    identifier: "alex@example.com",
    password: "motdepasse123",
    ip: "test",
  })
  assert.equal(login.body.needsOtp, true)

  const verified = await auth.verifyOtp({
    otpToken: login.body.otpToken,
    code: lastCode(),
    ip: "test",
  })
  assert.ok(verified.session.token)
})

test("OTP : 5 mauvaises saisies invalident le code", async () => {
  const { auth, lastCode } = setup()
  const registered = await auth.register({
    email: "bruteforce@example.com",
    password: "motdepasse123",
    ip: "test",
  })

  for (let attempt = 0; attempt < 4; attempt += 1) {
    await assert.rejects(
      () =>
        auth.verifyOtp({
          otpToken: registered.body.otpToken,
          code: "000000",
          ip: "test",
        }),
      (error) => error.status === 400,
    )
  }

  await assert.rejects(
    () =>
      auth.verifyOtp({
        otpToken: registered.body.otpToken,
        code: "000000",
        ip: "test",
      }),
    (error) => error.code === "otp_attempts",
  )

  await assert.rejects(
    () =>
      auth.verifyOtp({
        otpToken: registered.body.otpToken,
        code: lastCode(),
        ip: "test",
      }),
    (error) => error.code === "otp_missing",
  )
})

test("OTP : renvoi bloqué par le cooldown", async () => {
  const { auth } = setup()
  const registered = await auth.register({
    email: "cooldown@example.com",
    password: "motdepasse123",
    ip: "test",
  })

  await assert.rejects(
    () =>
      auth.resendOtp({
        otpToken: registered.body.otpToken,
        ip: "test",
      }),
    (error) => error.status === 429 && error.retryAfter >= 1,
  )
})

test("mot de passe oublié : OTP reset puis nouveau mot de passe", async () => {
  const { auth, lastCode } = setup()
  await registerVerified(auth, lastCode)

  const forgot = await auth.forgotPassword({
    email: "alex@example.com",
    ip: "test",
  })
  assert.equal(forgot.body.ok, true)

  const reset = await auth.resetPassword({
    email: "alex@example.com",
    code: lastCode(),
    password: "nouveaumotdepasse",
    ip: "test",
  })
  assert.equal(reset.body.ok, true)

  await assert.rejects(
    () =>
      auth.login({
        identifier: "alex@example.com",
        password: "motdepasse123",
        ip: "test",
      }),
    (error) => error.status === 401,
  )

  const login = await auth.login({
    identifier: "alex@example.com",
    password: "nouveaumotdepasse",
    ip: "test",
  })
  assert.equal(login.body.needsOtp, true)
})

test("mot de passe oublié : réponse identique si le compte n'existe pas", async () => {
  const { auth, messages } = setup()
  const result = await auth.forgotPassword({
    email: "inconnu@example.com",
    ip: "test",
  })
  assert.equal(result.status, 200)
  assert.equal(result.body.ok, true)
  assert.equal(messages.length, 0)
})

test("changement de mot de passe : révoque les anciennes sessions", async () => {
  const { auth, lastCode } = setup()
  const session = await registerVerified(auth, lastCode)

  const changed = await auth.changePassword({
    userId: session.body.user.id,
    currentPassword: "motdepasse123",
    newPassword: "encorepluslong",
    ip: "test",
  })
  assert.equal(changed.body.ok, true)
  assert.ok(changed.session.token)

  await assert.rejects(
    () => auth.me({ token: session.session.token }),
    (error) => error.status === 401 && error.code === "session_revoked",
  )

  const me = await auth.me({ token: changed.session.token })
  assert.equal(me.body.user.id, session.body.user.id)
})

test("session : token modifié refusé", async () => {
  const { auth, lastCode } = setup()
  const session = await registerVerified(auth, lastCode)
  const token = session.session.token
  const tampered = `${token.slice(0, -2)}${token.slice(-2) === "aa" ? "bb" : "aa"}`

  await assert.rejects(
    () => auth.me({ token: tampered }),
    (error) => error.status === 401,
  )
})

test("inscription : email déjà utilisé", async () => {
  const { auth, lastCode } = setup()
  await registerVerified(auth, lastCode)

  await assert.rejects(
    () =>
      auth.register({
        email: "ALEX@example.com",
        password: "motdepasse123",
        ip: "test",
      }),
    (error) => error.status === 409 && error.code === "email_taken",
  )
})

test("rate limit : au-delà du plafond", async () => {
  const { auth } = setup({ rateLimitMax: 2 })

  await assert.rejects(
    () => auth.login({ identifier: "a@b.co", password: "x", ip: "1.2.3.4" }),
    (error) => error.status === 401,
  )
  await assert.rejects(
    () => auth.login({ identifier: "a@b.co", password: "x", ip: "1.2.3.4" }),
    (error) => error.status === 401,
  )
  await assert.rejects(
    () => auth.login({ identifier: "a@b.co", password: "x", ip: "1.2.3.4" }),
    (error) => error.status === 429 && error.retryAfter > 0,
  )
})

test("parcours email d'abord : vérifier puis créer le compte", async () => {
  const { auth, lastCode } = setup()

  const sent = await auth.sendOtp({ email: "nouveau@example.com", ip: "test" })
  assert.equal(sent.body.ok, true)

  const verified = await auth.verifyOtp({
    email: "nouveau@example.com",
    code: lastCode(),
    ip: "test",
  })
  assert.equal(verified.body.needsProfile, true)
  assert.ok(verified.body.emailToken)

  const created = await auth.register({
    email: "nouveau@example.com",
    password: "motdepasse123",
    displayName: "Nouveau",
    emailToken: verified.body.emailToken,
    ip: "test",
  })
  assert.equal(created.status, 201)
  assert.ok(created.session.token)
  assert.equal(created.body.user.emailVerified, true)
})

test("configuration : secret trop court refusé", () => {
  assert.throws(
    () => createAuthService({ db: createSqliteDb(), config: { secret: "court" } }),
    /AUTH_SECRET/,
  )
})

test("adaptateur Web : cookie httpOnly et /me", async () => {
  const { auth, lastCode } = setup()
  const handler = createWebAuthHandler(auth)

  const registered = await handler(
    new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        email: "web@example.com",
        password: "motdepasse123",
        displayName: "Web",
      }),
    }),
  )
  assert.equal(registered.status, 201)
  const challenge = await registered.json()

  const verified = await handler(
    new Request("http://localhost/api/auth/verify-otp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ otpToken: challenge.otpToken, code: lastCode() }),
    }),
  )
  assert.equal(verified.status, 200)

  const setCookie = verified.headers.get("set-cookie")
  assert.match(setCookie, /aura_session=/)
  assert.match(setCookie, /HttpOnly/i)
  assert.match(setCookie, /SameSite=Lax/i)

  const cookie = setCookie.split(";")[0]
  const me = await handler(
    new Request("http://localhost/api/auth/me", {
      headers: { cookie },
    }),
  )
  assert.equal(me.status, 200)
  const payload = await me.json()
  assert.equal(payload.user.email, "web@example.com")
})
