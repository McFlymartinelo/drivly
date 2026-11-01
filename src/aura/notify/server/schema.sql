-- Schéma Aura Notify (SQLite / libSQL).
-- Aucune clé étrangère vers aura_users : le module peut être utilisé sans auth.

CREATE TABLE IF NOT EXISTS aura_push_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aura_push_user
  ON aura_push_subscriptions(user_id);

CREATE TABLE IF NOT EXISTS aura_notification_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  at TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT,
  tag TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  sent_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, key)
);

CREATE INDEX IF NOT EXISTS idx_aura_schedule_due
  ON aura_notification_schedule(sent_at, at);
CREATE INDEX IF NOT EXISTS idx_aura_schedule_user
  ON aura_notification_schedule(user_id, sent_at);
