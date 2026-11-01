-- Schéma Aura Auth (SQLite / libSQL).
-- Préfixe `aura_` pour cohabiter avec les tables de l'application.
-- Les emails et pseudos sont stockés en minuscules ; les requêtes ajoutent
-- COLLATE NOCASE en ceinture et bretelles.

CREATE TABLE IF NOT EXISTS aura_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  username TEXT UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  is_admin INTEGER NOT NULL DEFAULT 0,
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS aura_email_otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER REFERENCES aura_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  purpose TEXT NOT NULL,
  code_hash TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_aura_otps_user
  ON aura_email_otps(user_id, purpose);
CREATE INDEX IF NOT EXISTS idx_aura_otps_email
  ON aura_email_otps(email, purpose);
CREATE INDEX IF NOT EXISTS idx_aura_otps_expiry
  ON aura_email_otps(expires_at);
