import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';

// ---------------------------------------------------------------------------
// Model classification
// ---------------------------------------------------------------------------

export type ModelClass = 'opus' | 'sonnet' | 'haiku' | 'other';

export function classifyModel(model: string): ModelClass {
  if (model.includes('opus')) return 'opus';
  if (model.includes('sonnet')) return 'sonnet';
  if (model.includes('haiku')) return 'haiku';
  return 'other';
}

// ---------------------------------------------------------------------------
// Model totals
// ---------------------------------------------------------------------------

export type ModelTotals = { opus: number; sonnet: number; haiku: number; other: number };

export function modelTotals(stats: DailyStat[]): ModelTotals {
  const out: ModelTotals = { opus: 0, sonnet: 0, haiku: 0, other: 0 };
  for (const s of stats) {
    const byModel = (s.tokens_by_model ?? {}) as Record<string, number>;
    for (const [model, n] of Object.entries(byModel)) {
      out[classifyModel(model)] += n;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Per-day trend (1.2 last30Days / 2.2 trendForWindow)
// ---------------------------------------------------------------------------

export type TrendDay = {
  date: string;
  tokens: number;
  opus: number;
  sonnet: number;
  haiku: number;
  other: number;
};

const MS_PER_DAY = 86_400_000;

// Window-aware per-day trend. Like last30Days but the length follows the window:
// 'today' = 1 day, 'week' = 7, 'month' = 30, 'quarter' = 90, 'year' = 365,
// 'all' = every day from the earliest stat through today (min 1 day).
export function trendForWindow(stats: DailyStat[], today: string, window: StatsWindow): TrendDay[] {
  const todayMs = Date.parse(today + 'T00:00:00Z');
  let dayCount: number;
  if (window === 'all') {
    if (stats.length === 0) {
      dayCount = 1;
    } else {
      const earliestMs = Math.min(...stats.map((s) => Date.parse(s.date + 'T00:00:00Z')));
      dayCount = Math.max(1, Math.round((todayMs - earliestMs) / MS_PER_DAY) + 1);
    }
  } else {
    dayCount = WINDOW_DAYS[window];
  }
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const out: TrendDay[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    const day: TrendDay = { date: iso, tokens: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
    const found = byDate.get(iso);
    if (found) {
      day.tokens = found.tokens_total;
      const byModel = (found.tokens_by_model ?? {}) as Record<string, number>;
      for (const [model, n] of Object.entries(byModel)) {
        day[classifyModel(model)] += n;
      }
    }
    out.push(day);
  }
  return out;
}

export function last30Days(stats: DailyStat[], today: string): TrendDay[] {
  return trendForWindow(stats, today, 'month');
}

// ---------------------------------------------------------------------------
// Day-of-week averages (1.3)
// ---------------------------------------------------------------------------

// Index 0 = Sunday, matching Date.prototype.getUTCDay().
export function dayOfWeekAverages(stats: DailyStat[]): number[] {
  const sums = new Array<number>(7).fill(0);
  const counts = new Array<number>(7).fill(0);
  for (const s of stats) {
    const dow = new Date(s.date + 'T00:00:00Z').getUTCDay();
    sums[dow]! += s.tokens_total;
    counts[dow]! += 1;
  }
  return sums.map((sum, i) => (counts[i]! > 0 ? Math.round(sum / counts[i]!) : 0));
}

// ---------------------------------------------------------------------------
// Hourly totals (1.4)
// ---------------------------------------------------------------------------

// Index = hour 0..23. Sums hourly_tokens across every stat row.
export function hourlyTotals(stats: DailyStat[]): number[] {
  const out = new Array<number>(24).fill(0);
  for (const s of stats) {
    const hourly = (s.hourly_tokens ?? {}) as Record<string, number>;
    for (const [hour, n] of Object.entries(hourly)) {
      const h = Number(hour);
      if (Number.isInteger(h) && h >= 0 && h < 24) out[h]! += n;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Time windows (Plan 4a)
// ---------------------------------------------------------------------------

export type StatsWindow = 'today' | 'week' | 'month' | 'quarter' | 'year' | 'all';

const WINDOW_DAYS: Record<Exclude<StatsWindow, 'all'>, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

// Filters any date-stamped rows to a trailing window ending at `today` (UTC).
export function filterByWindow<T extends { date: string }>(
  rows: T[],
  today: string,
  window: StatsWindow,
): T[] {
  if (window === 'all') return rows;
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const cutoffMs = todayMs - (WINDOW_DAYS[window] - 1) * MS_PER_DAY;
  return rows.filter((r) => {
    const ms = Date.parse(r.date + 'T00:00:00Z');
    return ms >= cutoffMs && ms <= todayMs;
  });
}

// ---------------------------------------------------------------------------
// Ranked breakdowns (Plan 4a)
// ---------------------------------------------------------------------------

export type RankedItem = { label: string; value: number };

// Sums projects_touched across the given stats, sorted by tokens descending.
export function projectTotals(stats: DailyStat[]): RankedItem[] {
  const totals: Record<string, number> = {};
  for (const s of stats) {
    const projects = (s.projects_touched ?? {}) as Record<string, number>;
    for (const [label, n] of Object.entries(projects)) {
      totals[label] = (totals[label] ?? 0) + n;
    }
  }
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

// Sums per-machine tokens across the given machine_daily_stats rows, sorted descending.
export function machineTotals(machineStats: MachineDailyStat[]): RankedItem[] {
  const totals: Record<string, number> = {};
  for (const m of machineStats) {
    totals[m.machine] = (totals[m.machine] ?? 0) + m.tokens_total;
  }
  return Object.entries(totals)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

// ---------------------------------------------------------------------------
// Streak (Plan 4b-1 — extracted from ProfileLive)
// ---------------------------------------------------------------------------

// Consecutive days with tokens, ending at `today`. If today has no tokens yet,
// the streak still counts from yesterday.
export function computeStreak(stats: DailyStat[], today: string): number {
  const active = new Set(stats.filter((s) => s.tokens_total > 0).map((s) => s.date));
  let streak = 0;
  const cursor = new Date(today + 'T00:00:00Z');
  if (!active.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}

// ---------------------------------------------------------------------------
// Phase 2: Aggregations (rolling avg, week/month/all-time, PBs, milestones)
// ---------------------------------------------------------------------------

export function computeRollingAverage(stats: DailyStat[], anchor: string, days: number): number {
  if (!stats.length) return 0;
  const end = new Date(anchor + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  const startKey = start.toISOString().slice(0, 10);
  const window = stats.filter((s) => s.date >= startKey && s.date <= anchor);
  if (!window.length) return 0;
  const sum = window.reduce((acc, s) => acc + s.tokens_total, 0);
  return Math.round(sum / days);
}

export function computeWeekTotal(stats: DailyStat[], anchor: string): number {
  const end = new Date(anchor + 'T00:00:00Z');
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - 6);
  const startKey = start.toISOString().slice(0, 10);
  return stats
    .filter((s) => s.date >= startKey && s.date <= anchor)
    .reduce((acc, s) => acc + s.tokens_total, 0);
}

export function computeMonthTotal(stats: DailyStat[], anchor: string): number {
  const ym = anchor.slice(0, 7); // YYYY-MM
  return stats
    .filter((s) => s.date.startsWith(ym))
    .reduce((acc, s) => acc + s.tokens_total, 0);
}

export function computeAllTimeTotals(stats: DailyStat[]): {
  tokens: number; daysActive: number; ships: number; sessions: number;
} {
  let tokens = 0, ships = 0, sessions = 0;
  for (const s of stats) {
    tokens += s.tokens_total;
    sessions += s.sessions;
    const sh = (s.ships as { commits?: number } | null)?.commits ?? 0;
    ships += sh;
  }
  return { tokens, daysActive: stats.length, ships, sessions };
}

export function computePersonalBests(stats: DailyStat[]): {
  bestDayTokens: number; bestDayDate: string | null;
  bestShipsCount: number; bestShipsDate: string | null;
  bestSessionsCount: number; bestSessionsDate: string | null;
} {
  let bestDayTokens = 0, bestDayDate: string | null = null;
  let bestShipsCount = 0, bestShipsDate: string | null = null;
  let bestSessionsCount = 0, bestSessionsDate: string | null = null;
  for (const s of stats) {
    if (s.tokens_total > bestDayTokens) { bestDayTokens = s.tokens_total; bestDayDate = s.date; }
    const sh = (s.ships as { commits?: number } | null)?.commits ?? 0;
    if (sh > bestShipsCount) { bestShipsCount = sh; bestShipsDate = s.date; }
    if (s.sessions > bestSessionsCount) { bestSessionsCount = s.sessions; bestSessionsDate = s.date; }
  }
  return { bestDayTokens, bestDayDate, bestShipsCount, bestShipsDate, bestSessionsCount, bestSessionsDate };
}

const MILESTONES = [
  1_000_000, 5_000_000, 10_000_000, 25_000_000, 50_000_000,
  100_000_000, 250_000_000, 500_000_000, 1_000_000_000,
];

export function computeNextMilestone(lifetimeTokens: number): {
  target: number; progress: number; remaining: number;
} {
  const target = MILESTONES.find((m) => m > lifetimeTokens) ?? lifetimeTokens * 2;
  return {
    target,
    progress: Math.min(1, lifetimeTokens / target),
    remaining: Math.max(0, target - lifetimeTokens),
  };
}
