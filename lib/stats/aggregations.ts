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
// Future aggregations (1.2, 1.3, 1.4) will be appended below this line
// ---------------------------------------------------------------------------
