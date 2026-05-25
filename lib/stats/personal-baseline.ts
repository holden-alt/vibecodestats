// Personal baseline scoring — the "vs You" Pxx that shows under each dimension.
//
// Robust z-score (median + MAD) → clipped → logistic CDF → percentile-like 0–100.
// Empirical-Bayes shrinkage with weakly-informative priors handles small-N.
//
// Used as a DISPLAY metric only — does NOT feed into the absolute VBW score
// (the leaderboard stays competitive). See lib/stats/vbw.ts for the score.

import type { DimKey } from './vbw';

// Map dim → raw-input field on daily_stats
export const DIM_FIELD: Record<DimKey, string> = {
  output:    'output_tokens',
  substance: 'cache_creation_tokens',
  tools:     'tool_calls',
  ships:     'ship_quality',
  depth:     'deep_work_minutes',
};

// Weakly-informative priors per dim, on log10(raw + 1) scale. These mirror the
// dim_anchor seed values so a brand-new user starts at "P50 means typical-heavy-day."
const PRIORS: Record<DimKey, { m0: number; s0: number }> = {
  output:    { m0: 6.0, s0: 0.6 },
  substance: { m0: 7.0, s0: 0.6 },
  tools:     { m0: 3.0, s0: 0.6 },
  ships:     { m0: 1.7, s0: 0.6 },
  depth:     { m0: 2.5, s0: 0.5 },
};

const SHRINKAGE_PSEUDO_DAYS = 10;
const MAD_SCALE = 1.4826;
const Z_CLIP = 2.5;
const LOGISTIC_K = 0.7;

export type Baseline = {
  m_hat: number;    // robust center (shrunk)
  s_hat: number;    // robust scale (shrunk)
  n: number;        // raw observations in window
};

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? (sorted[mid] ?? 0) : (((sorted[mid - 1] ?? 0) + (sorted[mid] ?? 0)) / 2);
}

function mad(xs: number[], m: number): number {
  if (xs.length === 0) return 0;
  return median(xs.map((x) => Math.abs(x - m)));
}

/**
 * Compute personal baseline for one dimension over a window of raw daily values.
 * Returns shrunk (m_hat, s_hat) and the input count n.
 */
export function computeBaseline(rawValues: number[], dim: DimKey): Baseline {
  // Filter zeros — a day with no activity in this dim shouldn't drag the median down.
  // (Otherwise a single high day looks like a constant outlier.)
  const active = rawValues.filter((v) => v > 0);
  const n = active.length;
  const transformed = active.map((v) => Math.log10(v + 1));

  const { m0, s0 } = PRIORS[dim];

  if (n === 0) {
    return { m_hat: m0, s_hat: s0, n: 0 };
  }

  const m_obs = median(transformed);
  const mad_obs = mad(transformed, m_obs);
  const s_obs = Math.max(MAD_SCALE * mad_obs, 0.05); // small floor to avoid /0

  // EB shrinkage: blend observed with prior, weighted by sample size.
  const m_hat = (n * m_obs + SHRINKAGE_PSEUDO_DAYS * m0) / (n + SHRINKAGE_PSEUDO_DAYS);
  const s_hat = Math.sqrt(
    (n * s_obs * s_obs + SHRINKAGE_PSEUDO_DAYS * s0 * s0) / (n + SHRINKAGE_PSEUDO_DAYS),
  );

  return { m_hat, s_hat, n };
}

/**
 * Compute "P64 vs you" for today's raw value given a precomputed baseline.
 * Returns an integer 0–100.
 */
export function personalPercentile(rawToday: number, baseline: Baseline): number {
  if (!Number.isFinite(rawToday) || rawToday <= 0) return 0;
  const y = Math.log10(rawToday + 1);
  const z = Math.max(-Z_CLIP, Math.min(Z_CLIP, (y - baseline.m_hat) / baseline.s_hat));
  const p = 100 / (1 + Math.exp(-LOGISTIC_K * z));
  return Math.round(p);
}

/**
 * Convenience: compute baseline and percentile in one step.
 * Use when you have the raw window already loaded.
 */
export function percentileVsYou(
  rawToday: number,
  rawWindow: number[],
  dim: DimKey,
): { p: number; baseline: Baseline } {
  const baseline = computeBaseline(rawWindow, dim);
  return { p: personalPercentile(rawToday, baseline), baseline };
}
