-- Mzllo Platform store schema
-- Additive-only: existing tables are NEVER altered. Schema changes are new
-- CREATE TABLE IF NOT EXISTS / CREATE INDEX IF NOT EXISTS statements only.
-- Applied idempotently on every store open (see src/store/db.ts).

CREATE TABLE IF NOT EXISTS games (
  id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  -- Registry status (AD-2): active | possible_retired | retired
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (state, game_id)
);

-- Official draw results (STO-1). Unique on the full identity tuple so a
-- re-poll of the same draw upserts instead of duplicating.
CREATE TABLE IF NOT EXISTS draws (
  id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  game_id TEXT NOT NULL,
  game_name TEXT NOT NULL,
  draw_date TEXT NOT NULL,          -- YYYY-MM-DD, state-local date
  draw_type TEXT NOT NULL,          -- midday | evening
  numbers TEXT NOT NULL,            -- JSON array of drawn numbers
  bonus TEXT,                       -- JSON array, nullable
  multiplier TEXT,                  -- JSON, nullable
  jackpot INTEGER,                  -- nullable
  prize_tiers TEXT NOT NULL DEFAULT '[]',  -- JSON array of {match, prize}
  source_ref TEXT NOT NULL,
  source_url TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (state, game_id, draw_date, draw_type)
);

CREATE INDEX IF NOT EXISTS idx_draws_lookup
  ON draws (state, game_id, draw_date DESC, draw_type);

-- Premium members (MEM-1/2): pending -> active -> expired.
CREATE TABLE IF NOT EXISTS members (
  id INTEGER PRIMARY KEY,
  telegram_user_id INTEGER NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',   -- pending | active | expired
  payment_ref TEXT,
  expires_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Idempotent publish state per draw per channel (STO-3, AD-5).
-- UNIQUE(draw_id, channel): status 'sent' -> skip; 'failed' -> retry.
CREATE TABLE IF NOT EXISTS publish_log (
  id INTEGER PRIMARY KEY,
  draw_id INTEGER NOT NULL REFERENCES draws(id),
  channel TEXT NOT NULL,                    -- public | private
  status TEXT NOT NULL,                     -- sent | failed
  telegram_message_id TEXT,
  attempts INTEGER NOT NULL DEFAULT 1,
  last_error TEXT,
  last_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (draw_id, channel)
);

CREATE INDEX IF NOT EXISTS idx_publish_log_draw ON publish_log (draw_id);

-- AI assistant query audit log (AD-4, AIA-1): every user query + refusal.
CREATE TABLE IF NOT EXISTS ai_query_log (
  id INTEGER PRIMARY KEY,
  telegram_user_id INTEGER,
  query TEXT NOT NULL,
  intent TEXT,
  refused INTEGER NOT NULL DEFAULT 0,
  answer TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
