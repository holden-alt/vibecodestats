import type { DailyStat } from '@/lib/stats/profile-data';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import { type StatsWindow, filterByWindow, computeStreak } from '@/lib/stats/aggregations';

export type HeadToHeadMetric = 'tokens' | 'sessions' | 'deepwork' | 'streak' | 'ships';

export type HeadToHeadRow = {
  metric: HeadToHeadMetric;
  valueA: number;
  valueB: number;
  winner: 'A' | 'B' | 'tie';
  sparkA: number[]; // length 30, oldest -> newest
  sparkB: number[]; // length 30, oldest -> newest
};

const METRIC_ORDER: HeadToHeadMetric[] = ['tokens', 'sessions', 'deepwork', 'streak', 'ships'];
const SPARK_DAYS = 30;
const MS_PER_DAY = 86_400_000;

function cumulativeValue(stats: DailyStat[], metric: Exclude<HeadToHeadMetric, 'streak'>): number {
  switch (metric) {
    case 'tokens':
      return stats.reduce((s, d) => s + d.tokens_total, 0);
    case 'sessions':
      return stats.reduce((s, d) => s + d.sessions, 0);
    case 'deepwork':
      return Math.round(stats.reduce((s, d) => s + d.deep_work_minutes, 0) / 60);
    case 'ships':
      return stats.reduce((s, d) => {
        const ships = (d.ships ?? {}) as { commits?: number };
        return s + Number(ships.commits ?? 0);
      }, 0);
  }
}

function compareValues(a: number, b: number): 'A' | 'B' | 'tie' {
  if (a > b) return 'A';
  if (b > a) return 'B';
  return 'tie';
}

// Builds a per-day series of length SPARK_DAYS ending at today.
// `extract` returns the per-day numeric value for a given DailyStat (or 0 if absent).
function buildDailySpark(
  stats: DailyStat[],
  today: string,
  extract: (s: DailyStat) => number,
): number[] {
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const out: number[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    const found = byDate.get(iso);
    out.push(found ? extract(found) : 0);
  }
  return out;
}

// Builds a per-day series of the running streak count over the last SPARK_DAYS.
function buildStreakSpark(stats: DailyStat[], today: string): number[] {
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const active = new Set(stats.filter((s) => s.tokens_total > 0).map((s) => s.date));
  const out: number[] = [];
  for (let i = SPARK_DAYS - 1; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    // running streak ending at iso: walk backwards while active
    let streak = 0;
    const cursor = new Date(iso + 'T00:00:00Z');
    if (!active.has(iso)) {
      // streak ends at iso → 0 unless yesterday was active. Match computeStreak's "today no tokens
      // yet" relaxation: when iso is the current day, fall back to yesterday; otherwise iso-no-tokens
      // means streak = 0 ending at iso.
      if (iso === today) {
        cursor.setUTCDate(cursor.getUTCDate() - 1);
      } else {
        out.push(0);
        continue;
      }
    }
    while (active.has(cursor.toISOString().slice(0, 10))) {
      streak++;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
    out.push(streak);
  }
  return out;
}

export function computeHeadToHead(
  data: HeadToHeadData,
  window: StatsWindow,
  today: string,
): HeadToHeadRow[] {
  return METRIC_ORDER.map((metric) => {
    let valueA: number;
    let valueB: number;
    let sparkA: number[];
    let sparkB: number[];

    if (metric === 'streak') {
      valueA = computeStreak(data.statsA, today);
      valueB = computeStreak(data.statsB, today);
      sparkA = buildStreakSpark(data.statsA, today);
      sparkB = buildStreakSpark(data.statsB, today);
    } else {
      const filteredA = filterByWindow(data.statsA, today, window);
      const filteredB = filterByWindow(data.statsB, today, window);
      valueA = cumulativeValue(filteredA, metric);
      valueB = cumulativeValue(filteredB, metric);
      sparkA = buildDailySpark(data.statsA, today, (s) =>
        metric === 'tokens' ? s.tokens_total
        : metric === 'sessions' ? s.sessions
        : metric === 'deepwork' ? Math.round(s.deep_work_minutes / 60)
        : Number(((s.ships ?? {}) as { commits?: number }).commits ?? 0),
      );
      sparkB = buildDailySpark(data.statsB, today, (s) =>
        metric === 'tokens' ? s.tokens_total
        : metric === 'sessions' ? s.sessions
        : metric === 'deepwork' ? Math.round(s.deep_work_minutes / 60)
        : Number(((s.ships ?? {}) as { commits?: number }).commits ?? 0),
      );
    }

    return { metric, valueA, valueB, winner: compareValues(valueA, valueB), sparkA, sparkB };
  });
}
