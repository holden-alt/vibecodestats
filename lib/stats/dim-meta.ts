// Compose the "vs You" Pxx + intraday-pace + sparkline metadata for each
// VBW dimension. Used by ProfileLive to enrich the HeroBlock display.

import { computeBaseline, personalPercentile, DIM_FIELD } from './personal-baseline';
import { computeHourlyCurve, paceRatio, paceLabel } from './intraday';
import type { DimKey } from './vbw';
import type { DailyStat } from './profile-data';

export type DimMeta = {
  score: number;            // current 0-100 from vbw_components
  pxx: number | null;       // "P64 vs you"
  pace: string | null;      // "1.3× by this hour"
  trend: number[];          // last 14 days of dim scores for sparkline
};

export type DimsMeta = Record<DimKey, DimMeta>;

const DIMS: DimKey[] = ['output', 'substance', 'tools', 'ships', 'depth'];

/**
 * Build per-dimension metadata for today, given the user's full dailyStats array.
 * `today` is the date key of "now" (YYYY-MM-DD). `currentUtcHour` is 0-23.
 */
export function buildDimsMeta(
  dailyStats: DailyStat[],
  today: string,
  currentUtcHour: number,
): DimsMeta {
  const sorted = [...dailyStats].sort((a, b) => (a.date < b.date ? 1 : -1));
  const todayRow = sorted.find((s) => s.date === today);
  const todayComponents = (todayRow?.vbw_components ?? {}) as Partial<Record<DimKey, number>>;

  // Window: last 30 closed days (excluding today)
  const window = sorted.filter((s) => s.date !== today).slice(0, 30);

  // Hourly curve from window's hourly_tokens (token volume as proxy for all dims for v1)
  const hourlyWindow = window
    .map((s) => (s.hourly_tokens ?? {}) as Record<string, number>)
    .filter((h) => Object.keys(h).length > 0);
  const curve = computeHourlyCurve(hourlyWindow);
  const medianTotals = window.map((s) => s.tokens_total ?? 0).filter((v) => v > 0).sort((a, b) => a - b);
  const medianDaily = medianTotals.length > 0 ? (medianTotals[Math.floor(medianTotals.length / 2)] ?? 0) : 0;
  const cumulativeTokensToday = todayRow?.tokens_total ?? 0;
  const todayPaceRatio = paceRatio(cumulativeTokensToday, medianDaily, curve, currentUtcHour);
  // Token-volume pace applies to all dims for v1; later we can compute per-dim pace.
  const sharedPaceLabel = paceLabel(todayPaceRatio);

  const meta: DimsMeta = {} as DimsMeta;
  for (const dim of DIMS) {
    const field = DIM_FIELD[dim];
    const rawToday = (todayRow as unknown as Record<string, number> | undefined)?.[field] ?? 0;
    const rawWindow = window
      .map((s) => (s as unknown as Record<string, number>)[field] ?? 0)
      .filter((v) => v > 0);
    const baseline = computeBaseline(rawWindow, dim);
    const pxx = window.length >= 3 ? personalPercentile(rawToday, baseline) : null;

    const trend = sorted
      .slice(0, 14)
      .reverse()
      .map((s) => {
        const c = (s.vbw_components ?? {}) as Partial<Record<DimKey, number>>;
        return Math.round(c[dim] ?? 0);
      });

    meta[dim] = {
      score: Math.round(todayComponents[dim] ?? 0),
      pxx,
      pace: sharedPaceLabel,
      trend,
    };
  }
  return meta;
}
