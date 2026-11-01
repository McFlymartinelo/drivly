import assert from "node:assert/strict"
import http from "node:http"
import test from "node:test"
import { createAuthService } from "../index.mjs"
import { createSqliteDb } from "../adapters/sqlite.mjs"
import { createNodeAuthHandler } from "../adapters/node.mjs"

const SECRET = "aura-node-test-secret-0123456789-abcdef"

test("adaptateur node:http : inscription avec code, login, /me", async (t) => {
  const db = createSqliteDb({ file: ":memory:" })
  const auth = createAuthService({
    db,
    mailer: async () => {},
    config: {
      secret: SECRET,
      requireOtpOnLogin: false,
      requireEmailVerification: false,
      exposeToken: true,
      allowTokenInProduction: true,
      registrationCode: "server-key-0123456789",
      rateLimitMax: 1000,
      rateLimitOtpMax: 1000,
    },
  })

  const handleAuth = createNodeAuthHandler(auth, { basePath: "/api/auth" })
  const server = http.createServer(async (req, res) => {
    if (await handleAuth(req, res)) return
    res.writeHead(404, { "content-type": "application/json" })
    res.end(JSON.stringify({ error: "not found" }))
  })

  t.after(() => server.close())
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve))
  const base = `http://127.0.0.1:${server.address().port}/api/auth`

  async function post(path, body) {
    const response = await fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }

  const refused = await post("/register", {
    email: "node@example.com",
    password: "motdepasse123",
    code: "mauvais",
  })
  assert.equal(refused.status, 403)
  assert.equal(refused.body.code, "invalid_signup_code")

  const created = await post("/register", {
    email: "node@example.com",
    password: "motdepasse123",
    displayName: "Node",
    code: "server-key-0123456789",
  })
  assert.equal(created.status, 201)
  assert.ok(created.body.token)
  assert.equal(created.body.user.email, "node@example.com")

  const login = await post("/login", {
    identifier: "node@example.com",
    password: "motdepasse123",
  })
  assert.equal(login.status, 200)
  assert.ok(login.body.token)

  const me = await fetch(`${base}/me`, {
    headers: { authorization: `Bearer ${login.body.token}` },
  })
  assert.equal(me.status, 200)
  assert.equal((await me.json()).user.displayName, "Node")

  const anonymous = await fetch(`${base}/me`)
  assert.equal(anonymous.status, 401)

  const outside = await fetch(`http://127.0.0.1:${server.address().port}/autre`)
  assert.equal(outside.status, 404)
})
