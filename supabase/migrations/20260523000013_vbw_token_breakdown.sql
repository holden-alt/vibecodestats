-- Store the two token components we need for VBW computation (output + cache_creation)
-- separately. tokens_total stays as the ccusage 4-field sum for the headline number.

ALTER TABLE machine_daily_stats
  ADD COLUMN IF NOT EXISTS output_tokens         BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_creation_tokens BIGINT NOT NULL DEFAULT 0;

ALTER TABLE daily_stats
  ADD COLUMN IF NOT EXISTS output_tokens         BIGINT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cache_creation_tokens BIGINT NOT NULL DEFAULT 0;
