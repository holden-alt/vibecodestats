PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE,
  github_handle TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT,
  avatar_url TEXT,
  primary_persona TEXT,
  secondary_personas TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  auth_id TEXT UNIQUE,
  ingest_token TEXT NOT NULL UNIQUE,
  private_project_names INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  team TEXT CHECK (team IS NULL OR team IN ('claude_code', 'codex')),
  team_switched_at TEXT
);
CREATE INDEX users_github_handle_idx ON users(github_handle COLLATE NOCASE);

CREATE TABLE daily_stats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  tokens_by_model TEXT NOT NULL DEFAULT '{}',
  sessions INTEGER NOT NULL DEFAULT 0,
  deep_work_minutes INTEGER NOT NULL DEFAULT 0,
  machines TEXT NOT NULL DEFAULT '[]',
  projects_touched TEXT NOT NULL DEFAULT '{}',
  ships TEXT NOT NULL DEFAULT '{}',
  source_synced_at TEXT,
  hourly_tokens TEXT NOT NULL DEFAULT '{}',
  tool_calls INTEGER NOT NULL DEFAULT 0,
  ship_quality REAL NOT NULL DEFAULT 0,
  vbw_total INTEGER NOT NULL DEFAULT 0,
  vbw_components TEXT NOT NULL DEFAULT '{}',
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
CREATE INDEX daily_stats_user_date_idx ON daily_stats(user_id, date DESC);
CREATE INDEX daily_stats_vbw_total_idx ON daily_stats(date, vbw_total DESC);

CREATE TABLE machine_daily_stats (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  machine TEXT NOT NULL,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  tokens_by_model TEXT NOT NULL DEFAULT '{}',
  sessions INTEGER NOT NULL DEFAULT 0,
  deep_work_minutes INTEGER NOT NULL DEFAULT 0,
  projects_touched TEXT NOT NULL DEFAULT '{}',
  ships TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  hourly_tokens TEXT NOT NULL DEFAULT '{}',
  tool_calls INTEGER NOT NULL DEFAULT 0,
  ship_quality REAL NOT NULL DEFAULT 0,
  vbw_components TEXT NOT NULL DEFAULT '{}',
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date, machine)
);
CREATE INDEX machine_daily_stats_user_date_idx ON machine_daily_stats(user_id, date DESC);

CREATE TABLE groups (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  color TEXT NOT NULL DEFAULT 'cyan',
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE group_members (
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  joined_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (group_id, user_id)
);
CREATE INDEX group_members_user_idx ON group_members(user_id);

CREATE TABLE friendships (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, friend_id)
);
CREATE INDEX friendships_friend_idx ON friendships(friend_id);

CREATE TABLE signup_events (
  id TEXT PRIMARY KEY,
  created_at TEXT DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  event_type TEXT NOT NULL,
  auth_user_id TEXT,
  user_id TEXT,
  github_handle TEXT,
  user_agent TEXT,
  referer TEXT,
  error_message TEXT,
  is_new_user INTEGER,
  metadata TEXT DEFAULT '{}'
);
CREATE INDEX signup_events_created_at_idx ON signup_events(created_at DESC);
CREATE INDEX signup_events_event_type_idx ON signup_events(event_type);
CREATE INDEX signup_events_user_id_idx ON signup_events(user_id);

CREATE TABLE ingest_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  user_id TEXT,
  github_handle TEXT,
  machine TEXT,
  outcome TEXT NOT NULL,
  detail TEXT,
  user_agent TEXT,
  payload_date TEXT,
  tokens_total INTEGER
);
CREATE INDEX ingest_events_created_idx ON ingest_events(created_at DESC);
CREATE INDEX ingest_events_outcome_idx ON ingest_events(outcome, created_at DESC);
CREATE INDEX ingest_events_user_idx ON ingest_events(user_id, created_at DESC);

CREATE TABLE user_private (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  email TEXT,
  email_opt_in INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE dim_anchor (
  dim TEXT PRIMARY KEY,
  anchor REAL NOT NULL,
  k REAL NOT NULL,
  notes TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE user_dim_baseline (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dim TEXT NOT NULL,
  m_hat REAL NOT NULL,
  s_hat REAL NOT NULL,
  n INTEGER NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, dim)
);

CREATE TABLE user_intraday_share (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  dim TEXT NOT NULL,
  hour INTEGER NOT NULL,
  share REAL NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (user_id, dim, hour)
);

CREATE TABLE llm_model_daily (
  date TEXT NOT NULL,
  source TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL DEFAULT 0,
  output_tokens INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_create_tokens INTEGER NOT NULL DEFAULT 0,
  reasoning_tokens INTEGER NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL DEFAULT 0,
  tool_calls INTEGER NOT NULL DEFAULT 0,
  sessions INTEGER NOT NULL DEFAULT 0,
  active_minutes INTEGER NOT NULL DEFAULT 0,
  cost_usd REAL,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approx INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, source, model)
);

CREATE TABLE llm_project_model_daily (
  date TEXT NOT NULL,
  project TEXT NOT NULL,
  source TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_total INTEGER NOT NULL DEFAULT 0,
  turns INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approx INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, project, source, model)
);

CREATE TABLE llm_hourly (
  date TEXT NOT NULL,
  hour INTEGER NOT NULL,
  source TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  approx INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (date, hour, source, model)
);

CREATE TABLE repo_ships_daily (
  date TEXT NOT NULL,
  repo TEXT NOT NULL,
  commits INTEGER NOT NULL DEFAULT 0,
  insertions INTEGER NOT NULL DEFAULT 0,
  deletions INTEGER NOT NULL DEFAULT 0,
  files_changed INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (date, repo)
);

CREATE TABLE session_outcomes (
  session_id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'claude-code',
  project TEXT,
  model TEXT,
  kind TEXT NOT NULL DEFAULT 'interactive',
  intent TEXT,
  outcome TEXT,
  summary TEXT,
  friction INTEGER NOT NULL DEFAULT 0,
  friction_notes TEXT,
  problems TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE problem_events (
  signature TEXT NOT NULL,
  session_id TEXT NOT NULL,
  date TEXT NOT NULL,
  description TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (signature, session_id)
);

CREATE TABLE system_health_daily (
  date TEXT NOT NULL,
  system TEXT NOT NULL,
  checks INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 0,
  amber INTEGER NOT NULL DEFAULT 0,
  red INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  PRIMARY KEY (date, system)
);

CREATE TABLE auth_sessions (
  token_hash TEXT PRIMARY KEY,
  auth_id TEXT NOT NULL,
  email TEXT,
  user_metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  last_sign_in_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE INDEX auth_sessions_auth_id_idx ON auth_sessions(auth_id);
CREATE INDEX auth_sessions_expires_at_idx ON auth_sessions(expires_at);
