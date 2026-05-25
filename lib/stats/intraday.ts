// Intraday projection — the "1.3× by this hour" callout.
//
// Solves the "it's 12:30am and Output is already 80" puzzle by anchoring the
// live-day cumulative against the user's historical curve of "fraction of
// daily tokens contributed by UTC hour H." If today is already at 130% of the
// fraction you typically have by this hour, you're outpacing your norm.
//
// Used as a DISPLAY metric only. The stored VBW is unchanged.

const PROJECTION_FLOOR = 0.25;  // never project more than 4× from very early in the day

export type HourlyCurve = number[]; // length 24, each entry = avg share of daily total in that UTC hour, sums to 1.0

/**
 * Compute average hourly share curve from a window of `hourly_tokens` daily
 * objects. Each object is `{ "0": 12345, "1": 8902, ... }` (UTC hour → tokens).
 * Returns a 24-length array summing to ~1.0 (or uniform if no data).
 */
export function computeHourlyCurve(window: Record<string, number>[]): HourlyCurve {
  const totals = Array(24).fill(0) as number[];
  let grand = 0;
  for (const day of window) {
    for (let h = 0; h < 24; h++) {
      const v = day[String(h)] ?? 0;
      if (Number.isFinite(v) && v > 0) {
        totals[h] = (totals[h] ?? 0) + v;
        grand += v;
      }
    }
  }
  if (grand === 0) {
    // No history → uniform curve (each hour gets 1/24 share)
    return Array(24).fill(1 / 24);
  }
  return totals.map((t) => t / grand);
}

/**
 * Cumulative expected share by UTC hour H (the fraction of a "typical day"
 * that should be done by the END of hour H-1, i.e. before hour H starts).
 */
export function cumulativeShare(curve: HourlyCurve, hourUTC: number): number {
  let acc = 0;
  for (let h = 0; h < hourUTC; h++) {
    acc += curve[h] ?? 0;
  }
  return acc;
}

/**
 * Pace ratio: (today_so_far / today_expected_so_far). 1.0 means on pace,
 * 1.3 means 30% ahead of typical, 0.7 means 30% behind.
 */
export function paceRatio(
  cumulativeToday: number,
  windowMedianDailyTotal: number,
  curve: HourlyCurve,
  hourUTC: number,
): number | null {
  if (windowMedianDailyTotal <= 0) return null;
  const expectedShare = Math.max(PROJECTION_FLOOR, cumulativeShare(curve, hourUTC));
  const expectedSoFar = windowMedianDailyTotal * expectedShare;
  if (expectedSoFar <= 0) return null;
  return cumulativeToday / expectedSoFar;
}

/**
 * Project end-of-day total from current cumulative + expected share remaining.
 */
export function projectEod(
  cumulativeToday: number,
  curve: HourlyCurve,
  hourUTC: number,
): number {
  const completedShare = Math.max(PROJECTION_FLOOR, cumulativeShare(curve, hourUTC));
  return cumulativeToday / completedShare;
}

/**
 * Render the pace as a human label: "1.3× by this hour" / "0.7× by this hour".
 * Returns null if no pace can be computed (no history yet).
 */
export function paceLabel(ratio: number | null): string | null {
  if (ratio == null || !Number.isFinite(ratio)) return null;
  if (ratio < 0.05) return '<0.1× by this hour';
  return `${ratio.toFixed(1)}× by this hour`;
}
