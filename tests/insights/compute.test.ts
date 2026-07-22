import { describe, it, expect } from 'vitest';
import {
  attributeShips,
  buildCallouts,
  buildEfficiencyRows,
  buildHeatmapMatrix,
  buildHourlyAgg,
  buildProjectRows,
  buildTodaySummary,
  buildTrend,
  dowMonFirst,
  inWindow,
  prettyModel,
  totalTokens,
  windowStart,
} from '@/lib/insights/compute';
import type {
  HourlyRow,
  ModelDailyRow,
  ProjectModelDailyRow,
  RepoShipsRow,
} from '@/lib/insights/types';

const TODAY = '2026-07-21';
const YESTERDAY = '2026-07-20';

function md(partial: Partial<ModelDailyRow> & Pick<ModelDailyRow, 'date' | 'source' | 'model'>): ModelDailyRow {
  return {
    input_tokens: 0,
    output_tokens: 0,
    cache_read_tokens: 0,
    cache_create_tokens: 0,
    reasoning_tokens: 0,
    turns: 0,
    tool_calls: 0,
    sessions: 0,
    active_minutes: 0,
    cost_usd: null,
    ...partial,
  };
}
function pm(
  partial: Partial<ProjectModelDailyRow> & Pick<ProjectModelDailyRow, 'date' | 'project' | 'source' | 'model'>,
): ProjectModelDailyRow {
  return { tokens_total: 0, turns: 0, ...partial };
}
function ship(
  partial: Partial<RepoShipsRow> & Pick<RepoShipsRow, 'date' | 'repo'>,
): RepoShipsRow {
  return { commits: 0, insertions: 0, deletions: 0, files_changed: 0, ...partial };
}
function hr(partial: Partial<HourlyRow> & Pick<HourlyRow, 'date' | 'hour' | 'source' | 'model'>): HourlyRow {
  return { tokens: 0, ...partial };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MODEL_DAILY: ModelDailyRow[] = [
  md({ date: TODAY, source: 'claude-code', model: 'claude-opus-4-8', input_tokens: 1000, output_tokens: 500, cache_read_tokens: 8000, cache_create_tokens: 200, reasoning_tokens: 300, turns: 10, tool_calls: 25, sessions: 2, active_minutes: 120, cost_usd: 5 }),
  md({ date: TODAY, source: 'codex', model: 'gpt-5.6-sol', input_tokens: 2000, output_tokens: 1000, reasoning_tokens: 500, turns: 8, tool_calls: 8, sessions: 1, active_minutes: 60, cost_usd: null }),
  md({ date: YESTERDAY, source: 'claude-code', model: 'claude-opus-4-8', input_tokens: 500, output_tokens: 500, cache_read_tokens: 4000, turns: 5, tool_calls: 10, sessions: 1, active_minutes: 60, cost_usd: 3 }),
];

const PROJECT_MODEL: ProjectModelDailyRow[] = [
  pm({ date: TODAY, project: 'holden-alt/cc-dashboard', source: 'claude-code', model: 'claude-opus-4-8', tokens_total: 9000, turns: 9 }),
  pm({ date: TODAY, project: 'holden-alt/cc-dashboard', source: 'codex', model: 'gpt-5.6-sol', tokens_total: 1000, turns: 1 }),
  pm({ date: TODAY, project: 'unknown', source: 'codex', model: 'gpt-5.6-sol', tokens_total: 3000, turns: 3 }),
  pm({ date: YESTERDAY, project: 'holden-alt/cc-dashboard', source: 'claude-code', model: 'claude-opus-4-8', tokens_total: 5000, turns: 5 }),
];

const SHIPS: RepoShipsRow[] = [
  ship({ date: TODAY, repo: 'holden-alt/cc-dashboard', commits: 3, insertions: 200, deletions: 10, files_changed: 5 }),
  ship({ date: TODAY, repo: 'unknown', commits: 1, insertions: 50 }),
  ship({ date: YESTERDAY, repo: 'holden-alt/cc-dashboard', commits: 2, insertions: 100 }),
];

const HOURLY: HourlyRow[] = [
  hr({ date: TODAY, hour: 14, source: 'claude-code', model: 'claude-opus-4-8', tokens: 5000 }),
  hr({ date: TODAY, hour: 14, source: 'codex', model: 'gpt-5.6-sol', tokens: 1000 }),
  hr({ date: TODAY, hour: 15, source: 'claude-code', model: 'claude-opus-4-8', tokens: 3000 }),
];

// ── Primitives ────────────────────────────────────────────────────────────────
describe('primitives', () => {
  it('totalTokens sums all five token buckets', () => {
    expect(totalTokens(MODEL_DAILY[0]!)).toBe(10000);
    expect(totalTokens(MODEL_DAILY[1]!)).toBe(3500);
  });

  it('windowStart is inclusive of today', () => {
    expect(windowStart('2026-07-21', 7)).toBe('2026-07-15');
    expect(windowStart('2026-07-21', 1)).toBe('2026-07-21');
  });

  it('inWindow bounds correctly', () => {
    expect(inWindow('2026-07-15', '2026-07-21', 7)).toBe(true);
    expect(inWindow('2026-07-14', '2026-07-21', 7)).toBe(false);
    expect(inWindow('2026-07-22', '2026-07-21', 7)).toBe(false);
  });

  it('dowMonFirst is Monday-first', () => {
    // 2026-07-20 is a Monday.
    expect(dowMonFirst('2026-07-20')).toBe(0);
    expect(dowMonFirst('2026-07-21')).toBe(1);
    expect(dowMonFirst('2026-07-26')).toBe(6); // Sunday
  });

  it('prettyModel humanizes vendor model ids', () => {
    expect(prettyModel('claude-opus-4-8')).toBe('Opus 4.8');
    expect(prettyModel('claude-fable-5')).toBe('Fable 5');
    expect(prettyModel('gpt-5.6-sol')).toBe('GPT 5.6 Sol');
    expect(prettyModel('grok-4-fast')).toBe('Grok 4 Fast');
  });
});

// ── Today ─────────────────────────────────────────────────────────────────────
describe('buildTodaySummary', () => {
  const s = buildTodaySummary(MODEL_DAILY, SHIPS, TODAY);
  it('totals tokens + active minutes for today only', () => {
    expect(s.totalTokens).toBe(13500);
    expect(s.totalActiveMinutes).toBe(180);
  });
  it('breaks down by source, tokens-desc', () => {
    expect(s.bySource.map((x) => x.source)).toEqual(['claude-code', 'codex']);
    expect(s.bySource[0]!.tokens).toBe(10000);
  });
  it('sums shipped work for today', () => {
    expect(s.commits).toBe(4); // cc-dashboard 3 + unknown 1
    expect(s.insertions).toBe(250);
  });
  it('reports cost only from sources that have it', () => {
    expect(s.cost).toBe(5);
  });
});

// ── Trend ─────────────────────────────────────────────────────────────────────
describe('buildTrend', () => {
  const { points, models } = buildTrend(MODEL_DAILY);
  it('orders points ascending by date', () => {
    expect(points.map((p) => p.date)).toEqual([YESTERDAY, TODAY]);
  });
  it('ranks models by total tokens and assigns colors', () => {
    expect(models[0]!.model).toBe('claude-opus-4-8'); // 15000
    expect(models[0]!.total).toBe(15000);
    expect(models[0]!.source).toBe('claude-code');
    expect(models[0]!.color).toBeTruthy();
  });
});

// ── Attribution ───────────────────────────────────────────────────────────────
describe('attributeShips (dominant-model heuristic)', () => {
  const attr = attributeShips(PROJECT_MODEL, SHIPS, TODAY, 7);
  it('credits a day-project ships to its dominant model', () => {
    // cc-dashboard today+yesterday dominated by opus → 3+2 commits, 200+100 lines
    expect(attr.get('claude-code|claude-opus-4-8')).toEqual({ commits: 5, insertions: 300 });
    // unknown today dominated by gpt → 1 commit, 50 lines
    expect(attr.get('codex|gpt-5.6-sol')).toEqual({ commits: 1, insertions: 50 });
  });
});

// ── Efficiency ────────────────────────────────────────────────────────────────
describe('buildEfficiencyRows', () => {
  const rows = buildEfficiencyRows(MODEL_DAILY, PROJECT_MODEL, SHIPS, TODAY, 7);
  const opus = rows.find((r) => r.model === 'claude-opus-4-8')!;
  it('aggregates usage per source|model over the window', () => {
    expect(rows[0]!.model).toBe('claude-opus-4-8'); // tokens-desc
    expect(opus.tokens).toBe(15000);
    expect(opus.turns).toBe(15);
    expect(opus.sessions).toBe(3);
    expect(opus.cost).toBe(8);
  });
  it('merges attributed shipped-work and derives rates', () => {
    expect(opus.commits).toBe(5);
    expect(opus.insertions).toBe(300);
    expect(opus.toolCallsPerTurn).toBeCloseTo(35 / 15, 5);
    expect(opus.insertionsPerActiveHour).toBeCloseTo(100, 5); // 300 / 3h
    expect(opus.insertionsPer100M).toBeCloseTo(300 / (15000 / 1e8), 2);
  });
  it('leaves cost null for sources without cost', () => {
    const gpt = rows.find((r) => r.model === 'gpt-5.6-sol')!;
    expect(gpt.cost).toBeNull();
  });
});

// ── Hourly heatmap ────────────────────────────────────────────────────────────
describe('hourly heatmap', () => {
  const agg = buildHourlyAgg(HOURLY);
  it('collapses models into (date, hour, source)', () => {
    expect(agg.length).toBe(3);
  });
  it('sums matrix cells across sources when unfiltered', () => {
    const { matrix, total } = buildHeatmapMatrix(agg, TODAY, 7, null);
    const dow = dowMonFirst(TODAY);
    expect(total).toBe(9000);
    expect(matrix[dow]![14]).toBe(6000);
    expect(matrix[dow]![15]).toBe(3000);
  });
  it('filters by source', () => {
    const { matrix, total } = buildHeatmapMatrix(agg, TODAY, 7, 'claude-code');
    const dow = dowMonFirst(TODAY);
    expect(total).toBe(8000);
    expect(matrix[dow]![14]).toBe(5000);
  });
});

// ── Projects ──────────────────────────────────────────────────────────────────
describe('buildProjectRows', () => {
  const rows = buildProjectRows(PROJECT_MODEL, SHIPS, TODAY, 7);
  it('ranks projects by tokens and joins ships by repo===project', () => {
    expect(rows[0]!.project).toBe('holden-alt/cc-dashboard');
    expect(rows[0]!.tokens).toBe(15000);
    expect(rows[0]!.commits).toBe(5);
    expect(rows[0]!.insertions).toBe(300);
    expect(rows[0]!.models[0]!.model).toBe('claude-opus-4-8');
  });
});

// ── Callouts ──────────────────────────────────────────────────────────────────
describe('buildCallouts', () => {
  const agg = buildHourlyAgg(HOURLY);
  const lines = buildCallouts(MODEL_DAILY, PROJECT_MODEL, SHIPS, agg, TODAY);
  it('emits sample-size-gated, rule-based insights', () => {
    expect(lines.some((l) => /Cache reads are \d+% of all tokens/.test(l))).toBe(true);
    expect(lines.some((l) => /ships the most: \d+ lines\/active hour/.test(l))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(5);
  });
  it('degrades to empty when there is no data', () => {
    expect(buildCallouts([], [], [], [], TODAY)).toEqual([]);
  });
});
