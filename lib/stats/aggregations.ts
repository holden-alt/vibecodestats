import type { DailyStat } from '@/lib/stats/profile-data';

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
// 30-day trend (1.2)
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

export function last30Days(stats: DailyStat[], today: string): TrendDay[] {
  const byDate = new Map(stats.map((s) => [s.date, s]));
  const todayMs = Date.parse(today + 'T00:00:00Z');
  const out: TrendDay[] = [];
  for (let i = 29; i >= 0; i--) {
    const iso = new Date(todayMs - i * MS_PER_DAY).toISOString().slice(0, 10);
    const day: TrendDay = { date: iso, tokens: 0, opus: 0, sonnet: 0, haiku: 0, other: 0 };
    const stat = byDate.get(iso);
    if (stat) {
      day.tokens = stat.tokens_total;
      const byModel = (stat.tokens_by_model ?? {}) as Record<string, number>;
      for (const [model, n] of Object.entries(byModel)) {
        day[classifyModel(model)] += n;
      }
    }
    out.push(day);
  }
  return out;
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
// Future aggregations (1.4) will be appended below this line
// ---------------------------------------------------------------------------
