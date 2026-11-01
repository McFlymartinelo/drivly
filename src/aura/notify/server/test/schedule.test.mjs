import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import test from "node:test"
import { createSqliteDb } from "../../../auth/server/adapters/sqlite.mjs"
import { createPushService, NotifyError } from "../index.mjs"

const SCHEMA = readFileSync(new URL("../schema.sql", import.meta.url), "utf8")

function setup() {
  const db = createSqliteDb({ file: ":memory:", schema: SCHEMA })
  const sent = []
  const sender = {
    async send(subscription, payload) {
      if (subscription.endpoint.includes("gone")) {
        const error = new Error("Gone")
        error.statusCode = 410
        throw error
      }
      sent.push({ subscription, payload })
    },
  }
  const push = createPushService({
    db,
    sender,
    vapidPublicKey: "BPublicKey",
    appName: "Test",
  })
  return { db, push, sent }
}

const subscription = {
  endpoint: "https://push.example.com/abc",
  keys: { p256dh: "p256dh-value", auth: "auth-value" },
}

test("abonnement : upsert et suppression", async () => {
  const { push, db } = setup()

  await push.subscribe(1, subscription)
  await push.subscribe(1, { ...subscription, keys: { p256dh: "new", auth: "new" } })

  const rows = await push.subscriptions(1)
  assert.equal(rows.length, 1)
  assert.equal(rows[0].p256dh, "new")

  await push.unsubscribe(1, subscription.endpoint)
  assert.equal((await push.subscriptions(1)).length, 0)
  assert.equal((await db.get("SELECT COUNT(*) AS n FROM aura_push_subscriptions")).n, 0)
})

test("calendrier : remplacement, déduplication et envoi", async () => {
  const { push, sent } = setup()
  await push.subscribe(1, subscription)

  const past = new Date(Date.now() - 60_000).toISOString()
  const future = new Date(Date.now() + 86_400_000).toISOString()

  await push.syncSchedule(1, [
    { key: "reminder:1", at: past, title: "Contrôle technique", body: "Dans 3 jours", url: "/rappels" },
    { key: "fuel:1", at: future, title: "Plein à prévoir", body: "Dans 4 jours", url: "/" },
  ])

  const scheduled = await push.scheduleFor(1)
  assert.equal(scheduled.length, 2)

  const result = await push.sendDue()
  assert.equal(result.due, 1)
  assert.equal(result.sent, 1)
  assert.equal(sent.length, 1)
  assert.equal(sent[0].payload.title, "Contrôle technique")

  // Le même key ne doit pas être renvoyé.
  await push.syncSchedule(1, [
    { key: "reminder:1", at: past, title: "Contrôle technique", body: "Dans 3 jours" },
  ])
  const second = await push.sendDue()
  assert.equal(second.due, 0)
  assert.equal(sent.length, 1)
})

test("push : abonnement expiré supprimé après un 410", async () => {
  const { push } = setup()
  await push.subscribe(1, { ...subscription, endpoint: "https://push.example.com/gone" })

  const result = await push.sendToUser(1, { title: "Test", body: "Test" })
  assert.equal(result.sent, 0)
  assert.equal(result.failed, 1)
  assert.equal((await push.subscriptions(1)).length, 0)
})

test("calendrier : validation", async () => {
  const { push } = setup()

  await assert.rejects(
    () => push.syncSchedule(1, [{ key: "", at: new Date().toISOString(), title: "x", body: "y" }]),
    (error) => error instanceof NotifyError && error.status === 400,
  )

  await assert.rejects(
    () => push.syncSchedule(1, [{ key: "a", at: "pas une date", title: "x", body: "y" }]),
    (error) => error instanceof NotifyError,
  )
})
