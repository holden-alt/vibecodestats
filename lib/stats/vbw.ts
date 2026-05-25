// Canonical Vibewatts (VBW) implementation — v2.
//
// Used by the ingest endpoint to compute daily roll-up VBW, by the profile UI
// to display sub-scores, and by /methodology to render the formula.
//
// v2 vs v1:
//   - Per-dimension scoring switched from clamped-log-against-absolute-ceiling
//     to a logistic sigmoid centered on a "typical heavy day" anchor.
//     Old: dim = clamp(0, 100, log10(raw+1) * scale).  Saturated near 100
//          for any active day.
//     New: dim = 100 / (1 + exp(-k * (log10(raw+1) - anchor))).  Full 0–100
//          spread across the realistic input range; the top of the curve only
//          arrives at genuinely outsized days.
//   - Aggregation switched from geometric mean (which one-zero-killed) to
//     weighted-additive + diversity multiplier (±10%) + soft-penalty for
//     dimensions below 20. A research-only day with zero commits still scores.
//   - Streak max-bonus reduced from +10% to +5% at day 10.
//
// Anchors are passed in (sourced from public.dim_anchor) so the function stays
// pure and unit-testable. The DEFAULT_ANCHORS below mirror the seed values in
// migration 20260525000015 and are used as the fallback if no anchors are
// supplied (e.g. tests).

export type VbwInputs = {
  output_tokens: number;
  cache_creation_tokens: number;
  tool_calls: number;
  ship_quality: number;
  deep_work_minutes: number;
};

export type VbwComponents = {
  output: number;    // 0-100
  substance: number; // 0-100
  tools: number;     // 0-100
  ships: number;     // 0-100
  depth: number;     // 0-100
};

export type DimKey = keyof VbwComponents;

export type AnchorParams = {
  anchor: number;   // center of the sigmoid, on log10(raw+1) scale
  k: number;        // sigmoid steepness
};

export type AnchorsByDim = Record<DimKey, AnchorParams>;

export type VbwResult = {
  total: number;       // 0-10000 final
  base: number;        // 0-100 weighted-additive base
  persistence: number; // 1.0-1.05 streak multiplier
  diversity: number;   // 0.9-1.1 balance multiplier
  penalty: number;     // 0.94^low_count soft penalty
  components: VbwComponents;
};

// Defaults mirror migration 20260525000015's seed data. Production reads from
// public.dim_anchor at request time and passes them in; this is the fallback.
export const DEFAULT_ANCHORS: AnchorsByDim = {
  output:    { anchor: 6.0, k: 1.2 },
  substance: { anchor: 7.0, k: 1.5 },
  tools:     { anchor: 3.0, k: 1.5 },
  ships:     { anchor: 1.7, k: 1.5 },
  depth:     { anchor: 2.5, k: 1.3 },
};

// Dimension weights — sum to 1.0. Ships gets the most weight because shipped
// code is the most credible work artifact; output/depth tied for second.
const WEIGHTS: Record<DimKey, number> = {
  output:    0.20,
  substance: 0.20,
  tools:     0.15,
  ships:     0.25,
  depth:     0.20,
};

// Soft penalty: each dimension below LOW_THRESHOLD costs PENALTY_PER_LOW% off
// the composite. Replaces the one-zero-kill of the old geometric mean; zeros
// still hurt (a lot) but don't annihilate.
const LOW_THRESHOLD = 20;
const PENALTY_PER_LOW = 0.94;

// Diversity multiplier: clamp(0.5, 1.1, sqrt(gm/am)). Rewards balanced days
// and meaningfully penalizes one-dimensional spamming. The asymmetric range
// (-50% to +10%) is intentional: balance is the default, imbalance is
// punishable, but never to zero (avoid the v1 one-zero-kill).
const DIVERSITY_MIN = 0.5;
const DIVERSITY_MAX = 1.1;

// Streak: each consecutive active day adds STREAK_STEP, capped at STREAK_MAX.
// Day 10+ = max bonus. Smaller than v1 (5% vs 10%) because the rest of the
// formula now distinguishes days better and we don't want streak to dominate.
const STREAK_STEP = 0.005;
const STREAK_MAX_BONUS = 0.05;

const FINAL_SCALE = 100;
const VBW_HARD_CAP = 10000;

function clamp(min: number, max: number, n: number): number {
  if (!Number.isFinite(n)) return min;
  return n < min ? min : n > max ? max : n;
}

// One-axis score: 100 / (1 + exp(-k * (log10(raw+1) - anchor))).
function sigmoidScore(raw: number, params: AnchorParams): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    // Even at raw=0, math gives 100/(1+exp(k*anchor)). That can be a few percent
    // (e.g. output at anchor=6, k=1.2 → ~0.07%). Clamp to 0 so a zero-raw day
    // doesn't carry tiny phantom score.
    return 0;
  }
  const input = Math.log10(raw + 1);
  const z = params.k * (input - params.anchor);
  // 100 / (1 + e^-z)
  return 100 / (1 + Math.exp(-z));
}

export function computeVbwComponents(
  inputs: VbwInputs,
  anchors: AnchorsByDim = DEFAULT_ANCHORS,
): VbwComponents {
  return {
    output:    sigmoidScore(inputs.output_tokens,          anchors.output),
    substance: sigmoidScore(inputs.cache_creation_tokens,  anchors.substance),
    tools:     sigmoidScore(inputs.tool_calls,             anchors.tools),
    ships:     sigmoidScore(inputs.ship_quality,           anchors.ships),
    depth:     sigmoidScore(inputs.deep_work_minutes,      anchors.depth),
  };
}

function diversityMultiplier(scores: number[]): number {
  // gm and am of (score + 1) to avoid log(0) and divide-by-zero
  const shifted = scores.map((s) => s + 1);
  const am = shifted.reduce((a, b) => a + b, 0) / shifted.length;
  const logSum = shifted.reduce((a, b) => a + Math.log(b), 0);
  const gm = Math.exp(logSum / shifted.length);
  const ratio = am > 0 ? gm / am : 1;
  const raw = Math.sqrt(ratio);
  return clamp(DIVERSITY_MIN, DIVERSITY_MAX, raw);
}

function softPenalty(scores: number[]): number {
  const lowCount = scores.filter((s) => s < LOW_THRESHOLD).length;
  return Math.pow(PENALTY_PER_LOW, lowCount);
}

function streakMultiplier(streakDays: number): number {
  const safeDays = Number.isFinite(streakDays) && streakDays > 0 ? streakDays : 0;
  return 1 + Math.min(STREAK_MAX_BONUS, safeDays * STREAK_STEP);
}

export function computeVbw(
  inputs: VbwInputs,
  streakDays: number = 0,
  anchors: AnchorsByDim = DEFAULT_ANCHORS,
): VbwResult {
  const c = computeVbwComponents(inputs, anchors);
  const scores = [c.output, c.substance, c.tools, c.ships, c.depth];

  const base =
    WEIGHTS.output    * c.output    +
    WEIGHTS.substance * c.substance +
    WEIGHTS.tools     * c.tools     +
    WEIGHTS.ships     * c.ships     +
    WEIGHTS.depth     * c.depth;

  const diversity = diversityMultiplier(scores);
  const penalty = softPenalty(scores);
  const persistence = streakMultiplier(streakDays);

  const total = clamp(
    0,
    VBW_HARD_CAP,
    Math.round(base * diversity * penalty * persistence * FINAL_SCALE),
  );

  return { total, base, persistence, diversity, penalty, components: c };
}
