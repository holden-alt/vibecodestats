// Canonical Vibewatts (VBW) implementation.
// Used by the ingest endpoint to compute daily roll-up VBW, by the profile
// to display sub-scores, and by /methodology to render the formula.
//
// Inputs are SUMS across all of a user's machines for one day. The 5 dimension
// scores each clamp to [0, 100]; the geometric mean across them is the base,
// then multiplied by streak persistence and a final scale factor.
//
// Calibration target: heaviest legit day ~7-9K, average heavy day ~3-5K,
// trivial day ~300-800, bot pattern ~0. See /methodology for the rationale.

export type VbwInputs = {
  output_tokens: number;        // sum of output_tokens across deduped turns
  cache_creation_tokens: number; // sum of cache_creation_input_tokens
  tool_calls: number;            // count of tool_use content blocks
  ship_quality: number;          // sum over commits of log10(lines+1)*files*non_test_ratio, per-commit cap 20
  deep_work_minutes: number;     // gap-filtered focus time, day total
};

export type VbwComponents = {
  output: number;    // 0-100
  substance: number; // 0-100
  tools: number;     // 0-100
  ships: number;     // 0-100
  depth: number;     // 0-100
};

export type VbwResult = {
  total: number;       // 0-10000 final
  base: number;        // 0-100 geometric mean
  persistence: number; // 1.0-1.5 streak multiplier
  components: VbwComponents;
};

// Tuning constants — adjust during calibration. Documented in /methodology.
const D1_OUTPUT_SCALE = 16.67;     // log10(1e6) * 16.67 ≈ 100
const D2_SUBSTANCE_SCALE = 12.5;   // log10(1e8) * 12.5 = 100
const D3_TOOLS_SCALE = 25;         // log10(1e4) * 25 = 100
const D5_DEPTH_DIVISOR = 6;        // 600 min / 6 = 100

// Streak multiplier deliberately mild: at 1.5x it warped real-data calibration
// (most heavy days saturated at 10K and the leaderboard stopped distinguishing).
// 10 days of consistent activity = 10% bonus, which feels earned without flattening
// the top-end. Below 100% — never compresses or penalizes a no-streak day.
const STREAK_STEP = 0.01;          // each day adds 1%
const STREAK_MAX_BONUS = 0.1;      // capped at 1.1x at day 10+
const FINAL_SCALE = 100;           // turns 0-100 base into 0-10000

const VBW_HARD_CAP = 10000;

function clamp01_100(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n > 100 ? 100 : n;
}

export function computeVbwComponents(inputs: VbwInputs): VbwComponents {
  const output = clamp01_100(Math.log10(inputs.output_tokens + 1) * D1_OUTPUT_SCALE);
  const substance = clamp01_100(Math.log10(inputs.cache_creation_tokens + 1) * D2_SUBSTANCE_SCALE);
  const tools = clamp01_100(Math.log10(inputs.tool_calls + 1) * D3_TOOLS_SCALE);
  const ships = clamp01_100(inputs.ship_quality);
  const depth = clamp01_100(inputs.deep_work_minutes / D5_DEPTH_DIVISOR);
  return { output, substance, tools, ships, depth };
}

export function computeVbw(inputs: VbwInputs, streakDays: number = 0): VbwResult {
  const c = computeVbwComponents(inputs);

  // Geometric mean: nth root of the product. A zero on any axis zeroes the base.
  // That's the point — you can't game one dimension to leaderboard your way up.
  const product = c.output * c.substance * c.tools * c.ships * c.depth;
  const base = product > 0 ? Math.pow(product, 1 / 5) : 0;

  const persistence = 1 + Math.min(STREAK_MAX_BONUS, Math.max(0, streakDays) * STREAK_STEP);

  const total = Math.min(VBW_HARD_CAP, Math.round(base * persistence * FINAL_SCALE));

  return { total, base, persistence, components: c };
}
