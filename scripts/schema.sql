-- MintAds PostgreSQL Schema
-- Run order: this file first, then seed.sql

-- Pipeline runs (one per ad variant generation request)
CREATE TABLE IF NOT EXISTS runs (
  id                SERIAL PRIMARY KEY,
  ad_id             TEXT UNIQUE NOT NULL,
  experience_id     TEXT NOT NULL,

  -- User inputs (stored for reproducibility)
  persona           TEXT NOT NULL,
  journey_type      TEXT NOT NULL,
  brand             TEXT NOT NULL,
  angle_id          TEXT NOT NULL,
  hook_id           TEXT NOT NULL,
  video_format      TEXT NOT NULL,
  additional_details TEXT,

  -- Pipeline artifacts (JSONB for flexible querying)
  facts             JSONB,
  script            JSONB,
  claim_report      JSONB,

  -- Status tracking
  -- pending → ingesting → scripting → validating → generating → assembling → completed | failed
  status            TEXT NOT NULL DEFAULT 'pending',
  current_stage     TEXT,
  error_message     TEXT,

  -- Cost
  total_cost_usd    NUMERIC(8,4) DEFAULT 0,

  -- Timing
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  completed_at      TIMESTAMPTZ
);

-- Per-stage execution tracking (progress + cost ledger)
CREATE TABLE IF NOT EXISTS stage_logs (
  id              SERIAL PRIMARY KEY,
  run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ad_id           TEXT NOT NULL,

  -- content_ingestion | script_gen | script_validation |
  -- video_gen_scene_1 | video_gen_scene_2 | video_gen_scene_3 |
  -- audio_gen | assembly | export
  stage           TEXT NOT NULL,

  -- pending → in_progress → completed | failed
  status          TEXT NOT NULL DEFAULT 'pending',

  -- Service details
  service         TEXT,   -- 'headout_api' | 'claude' | 'higgsfield' | 'elevenlabs' | 'remotion'
  model           TEXT,   -- 'claude-sonnet-4-6' | 'seedance-2.0' | ...

  -- Cost
  cost_usd        NUMERIC(8,4) DEFAULT 0,

  -- Metadata (flexible per stage)
  params          JSONB,  -- input params: { duration_sec, scene_id, quality, attempt, ... }
  result          JSONB,  -- output info: { file_path, duration_actual, violations, ... }

  -- Timing
  started_at      TIMESTAMPTZ DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,
  duration_ms     INTEGER
);

-- Generated media assets (intermediate + final files)
CREATE TABLE IF NOT EXISTS assets (
  id              SERIAL PRIMARY KEY,
  run_id          INTEGER NOT NULL REFERENCES runs(id) ON DELETE CASCADE,
  ad_id           TEXT NOT NULL,

  asset_type      TEXT NOT NULL,  -- 'video_clip' | 'vo_audio' | 'final_video'
  format          TEXT,           -- '9:16' | '1:1' | '16:9' (for final_video)
  scene_id        INTEGER,        -- 1 | 2 | 3 (for video_clip)
  beat            TEXT,           -- 'hook' | 'body' | 'payoff' (for video_clip)

  file_path       TEXT NOT NULL,
  file_size       INTEGER,
  duration_sec    NUMERIC(6,2),

  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Angle definitions (served to frontend dropdowns)
CREATE TABLE IF NOT EXISTS angles (
  id              TEXT PRIMARY KEY,   -- 'A1', 'A2', ...
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  motivation      TEXT,
  kills_objection TEXT,
  example_line    TEXT,
  sub_format      TEXT,               -- primary UGC sub-format auto-selected by script engine
  journey         TEXT DEFAULT 'both',-- 'pre_trip' | 'in_trip' | 'both'
  brand_lean      TEXT DEFAULT 'either', -- 'headout' | 'non_headout' | 'either'
  sort_order      INTEGER DEFAULT 0
);

-- Hook definitions (served to frontend dropdowns)
CREATE TABLE IF NOT EXISTS hooks (
  id              TEXT PRIMARY KEY,   -- 'problem', 'outcome', ...
  name            TEXT NOT NULL,
  template        TEXT NOT NULL,
  description     TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

-- Persona definitions (served to frontend dropdowns)
CREATE TABLE IF NOT EXISTS personas (
  id              TEXT PRIMARY KEY,   -- 'solo', 'couple', ...
  name            TEXT NOT NULL,
  description     TEXT NOT NULL,
  sort_order      INTEGER DEFAULT 0
);

-- Key-value config store
CREATE TABLE IF NOT EXISTS config (
  key             TEXT PRIMARY KEY,
  value           JSONB NOT NULL
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_runs_status     ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_experience ON runs(experience_id);
CREATE INDEX IF NOT EXISTS idx_runs_created    ON runs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stage_logs_run  ON stage_logs(run_id);
CREATE INDEX IF NOT EXISTS idx_stage_logs_ad   ON stage_logs(ad_id);
CREATE INDEX IF NOT EXISTS idx_assets_run      ON assets(run_id);
CREATE INDEX IF NOT EXISTS idx_assets_ad       ON assets(ad_id);
CREATE INDEX IF NOT EXISTS idx_assets_type     ON assets(asset_type);
