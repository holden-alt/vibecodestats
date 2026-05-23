-- Add VBW (vibewatts) tracking columns to per-machine + roll-up tables.
-- All three columns are nullable / default-0 so legacy payloads that don't send
-- them continue to work; the next push from an updated parser fills them in.

ALTER TABLE machine_daily_stats
  ADD COLUMN IF NOT EXISTS tool_calls        INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ship_quality      DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vbw_components    JSONB            NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE daily_stats
  ADD COLUMN IF NOT EXISTS tool_calls     INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ship_quality   DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vbw_total      INTEGER          NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vbw_components JSONB            NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_daily_stats_vbw_total
  ON daily_stats (date, vbw_total DESC);

COMMENT ON COLUMN daily_stats.vbw_total IS
  'Vibewatts (VBW) — composite AI productivity score, 0-10000. See /methodology.';
COMMENT ON COLUMN daily_stats.vbw_components IS
  '{output, substance, tools, ships, depth} dimension sub-scores, each 0-100.';
COMMENT ON COLUMN daily_stats.ship_quality IS
  'Sum of per-commit log10(lines+1) * file_count * non_test_ratio, capped per-commit at 20.';
