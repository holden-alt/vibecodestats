import { describe, it, expect } from 'vitest';
import {
  addDays,
  bucketTrend,
  buildCallouts,
  buildHeatmapMatrix,
  buildHourlyAgg,
  buildModelEffectiveness,
  buildPlansSessions,
  buildProblems,
  buildProjectRows,
  buildShips,
  buildSystemsBoard,
  buildTodaySummary,
  buildTrend,
  canonicalProject,
  CODEX_SCRATCH,
  daysBetween,
  dowMonFirst,
  humanizeSignature,
  inWindow,
  pickSeries,
  prettyModel,
  totalTokens,
  windowStart,
} from '@/lib/insights/compute';
import type {
  HourlyRow,
  ModelDailyRow,
  ProblemEventRow,
  ProjectModelDailyRow,
  RepoShipsRow,
  SessionOutcomeRow,
  SystemHealthRow,
} from '@/lib/insights/types';

const TODAY = '2026-07-23';
const YESTERDAY = '2026-07-22';

// ── Fixture builders ──────────────────────────────────────────────────────────
function md(p: Partial<ModelDailyRow> & Pick<ModelDailyRow, 'date' | 'source' | 'model'>): ModelDailyRow {
  return {
    input_tokens: 0, output_tokens: 0, cache_read_tokens: 0, cache_create_tokens: 0, reasoning_tokens: 0,
    turns: 0, tool_calls: 0, sessions: 0, active_minutes: 0, cost_usd: null, ...p,
  };
}
function pm(
  p: Partial<ProjectModelDailyRow> & Pick<ProjectModelDailyRow, 'date' | 'project' | 'source' | 'model'>,
): ProjectModelDailyRow {
  return { tokens_total: 0, turns: 0, ...p };
}
function so(
  p: Partial<SessionOutcomeRow> &
    Pick<SessionOutcomeRow, 'session_id' | 'date' | 'kind' | 'outcome' | 'model' | 'project'>,
): SessionOutcomeRow {
  return { source: 'claude-code', intent: null, summary: null, friction: 0, friction_notes: [], problems: [], ...p };
}
function pe(p: Partial<ProblemEventRow> & Pick<ProblemEventRow, 'signature' | 'session_id' | 'date'>): ProblemEventRow {
  return { description: null, ...p };
}
function sh(p: Partial<SystemHealthRow> & Pick<SystemHealthRow, 'date' | 'system'>): SystemHealthRow {
  return { checks: 0, ok: 0, amber: 0, red: 0, ...p };
}
function hr(p: Partial<HourlyRow> & Pick<HourlyRow, 'date' | 'hour' | 'source' | 'model'>): HourlyRow {
  return { tokens: 0, ...p };
}

// ── Fixtures ──────────────────────────────────────────────────────────────────
const MODEL_DAILY: ModelDailyRow[] = [
  md({ date: TODAY, source: 'claude-code', model: 'claude-opus-4-8', input_tokens: 1000, output_tokens: 500, cache_read_tokens: 8000, cache_create_tokens: 200, reasoning_tokens: 300, active_minutes: 120, cost_usd: 5 }),
  md({ date: TODAY, source: 'claude-code', model: 'claude-fable-5', input_tokens: 2000, cache_read_tokens: 1000, active_minutes: 30, cost_usd: 4 }),
  md({ date: TODAY, source: 'codex', model: 'gpt-5.6-sol', input_tokens: 2000, output_tokens: 1000, reasoning_tokens: 500, active_minutes: 60, cost_usd: null }),
  md({ date: YESTERDAY, source: 'claude-code', model: 'claude-opus-4-8', input_tokens: 500, output_tokens: 500, cache_read_tokens: 4000, active_minutes: 60, cost_usd: 3 }),
];

const OUTCOMES: SessionOutcomeRow[] = [
  // today — interactive
  so({ session_id: 'i1', date: TODAY, kind: 'interactive', outcome: 'completed', model: 'claude-opus-4-8', project: 'holden-alt/cc-dashboard', friction: 0, intent: 'ship insights station' }),
  so({ session_id: 'i2', date: TODAY, kind: 'interactive', outcome: 'blocked', model: 'claude-opus-4-8', project: 'holden-alt/cc-dashboard', friction: 3, intent: 'fix socket bug' }),
  so({ session_id: 'i3', date: TODAY, kind: 'interactive', outcome: 'completed', model: 'claude-fable-5', project: 'unknown', friction: 1, intent: 'draft copy' }),
  so({ session_id: 'i4', date: TODAY, kind: 'interactive', outcome: 'chat', model: 'claude-opus-4-8', project: 'x', friction: 0, intent: 'brainstorm' }),
  // today — automation (3 runs, 2 completed)
  so({ session_id: 'a1', date: TODAY, kind: 'automation', outcome: 'completed', model: 'claude-opus-4-8', project: 'auto' }),
  so({ session_id: 'a2', date: TODAY, kind: 'automation', outcome: 'completed', model: 'claude-opus-4-8', project: 'auto' }),
  so({ session_id: 'a3', date: TODAY, kind: 'automation', outcome: 'blocked', model: 'claude-opus-4-8', project: 'auto' }),
  // this week (07-20)
  so({ session_id: 'i5', date: '2026-07-20', kind: 'interactive', outcome: 'completed', model: 'claude-opus-4-8', project: 'p', friction: 0 }),
  // last week (07-12..07-16)
  so({ session_id: 'i6', date: '2026-07-14', kind: 'interactive', outcome: 'completed', model: 'claude-opus-4-8', project: 'p', friction: 1 }),
  so({ session_id: 'i7', date: '2026-07-15', kind: 'interactive', outcome: 'blocked', model: 'claude-opus-4-8', project: 'p', friction: 2 }),
  so({ session_id: 'i8', date: '2026-07-12', kind: 'interactive', outcome: 'completed', model: 'claude-opus-4-8', project: 'p', friction: 0 }),
];

const PROJECT_MODEL: ProjectModelDailyRow[] = [
  pm({ date: TODAY, project: 'holden-alt/cc-dashboard', source: 'claude-code', model: 'claude-opus-4-8', tokens_total: 9000, turns: 9 }),
  pm({ date: TODAY, project: 'unknown', source: 'claude-code', model: 'claude-fable-5', tokens_total: 3000, turns: 3 }),
];

const PROBLEMS: ProblemEventRow[] = [
  pe({ signature: 'api-socket-closed', session_id: 'i2', date: TODAY, description: 'socket closed mid session' }),
  pe({ signature: 'api-socket-closed', session_id: 'i2b', date: TODAY, description: 'socket closed again' }),
  pe({ signature: 'api-socket-closed', session_id: 'x9', date: '2026-07-21', description: 'earlier close' }),
  pe({ signature: 'rai-backlog-drain-miss', session_id: 'x10', date: '2026-07-20', description: 'scheduler missed' }),
];

const HEALTH: SystemHealthRow[] = [
  sh({ date: TODAY, system: 'HoldenGR videos', checks: 48, ok: 40, amber: 6, red: 2 }),
  sh({ date: TODAY, system: 'RAI operations core', checks: 48, ok: 48, amber: 0, red: 0 }),
  sh({ date: '2026-07-22', system: 'HoldenGR videos', checks: 48, ok: 46, amber: 2, red: 0 }),
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
  });
  it('windowStart / inWindow bound inclusively', () => {
    expect(windowStart('2026-07-23', 7)).toBe('2026-07-17');
    expect(inWindow('2026-07-17', '2026-07-23', 7)).toBe(true);
    expect(inWindow('2026-07-16', '2026-07-23', 7)).toBe(false);
  });
  it('addDays shifts dates', () => {
    expect(addDays('2026-07-17', -1)).toBe('2026-07-16');
    expect(addDays('2026-07-31', 1)).toBe('2026-08-01');
  });
  it('dowMonFirst is Monday-first', () => {
    expect(dowMonFirst('2026-07-20')).toBe(0); // Monday
    expect(dowMonFirst('2026-07-26')).toBe(6); // Sunday
  });
  it('prettyModel + humanizeSignature humanize ids', () => {
    expect(prettyModel('claude-opus-4-8')).toBe('Opus 4.8');
    expect(humanizeSignature('api-socket-closed')).toBe('Api socket closed');
  });
});

// ── Today ─────────────────────────────────────────────────────────────────────
describe('buildTodaySummary', () => {
  const s = buildTodaySummary(MODEL_DAILY, OUTCOMES, TODAY);
  it('totals usage for today only', () => {
    expect(s.totalTokens).toBe(16500);
    expect(s.totalActiveMinutes).toBe(210);
    expect(s.cost).toBe(9);
  });
  it('counts interactive task outcomes (chat excluded)', () => {
    expect(s.interactiveCompleted).toBe(2);
    expect(s.interactiveBlocked).toBe(1);
    expect(s.interactiveTotal).toBe(3);
  });
  it('counts automation runs separately', () => {
    expect(s.automationRuns).toBe(3);
    expect(s.automationCompleted).toBe(2);
  });
});

// ── Model effectiveness ─────────────────────────────────────────────────────
describe('buildModelEffectiveness', () => {
  const rows = buildModelEffectiveness(MODEL_DAILY, OUTCOMES, TODAY, 30);
  const opus = rows.find((r) => r.model === 'claude-opus-4-8')!;
  it('ranks by interactive sessions and joins usage', () => {
    expect(rows[0]!.model).toBe('claude-opus-4-8');
    expect(opus.sessions).toBe(6);
    expect(opus.completed).toBe(4);
    expect(opus.blocked).toBe(2);
    expect(opus.tokens).toBe(15000); // TODAY + YESTERDAY opus usage
    expect(opus.cost).toBe(8);
  });
  it('computes completion rate + avg friction over task sessions', () => {
    expect(opus.completionRate).toBeCloseTo(4 / 6, 5);
    expect(opus.avgFriction).toBeCloseTo(1, 5);
  });
  it('excludes chat and automation from effectiveness', () => {
    const fable = rows.find((r) => r.model === 'claude-fable-5')!;
    expect(fable.sessions).toBe(1);
    expect(rows.every((r) => r.sessions > 0)).toBe(true);
  });
});

// ── Plans & sessions ──────────────────────────────────────────────────────────
describe('buildPlansSessions', () => {
  const p = buildPlansSessions(OUTCOMES, TODAY, 30);
  it('computes week-over-week completion', () => {
    expect(p.thisSessions).toBe(4); // today 3 tasks + 07-20
    expect(p.thisRate).toBeCloseTo(3 / 4, 5);
    expect(p.lastSessions).toBe(3); // 07-12/14/15
    expect(p.lastRate).toBeCloseTo(2 / 3, 5);
  });
  it('lists today interactive sessions, blocked first', () => {
    expect(p.todaySessions.length).toBe(4); // incl chat
    expect(p.todaySessions[0]!.outcome).toBe('blocked');
  });
  it('trend is calendar-complete (30 days) and zero-filled', () => {
    expect(p.trend.length).toBe(30);
    const todayPoint = p.trend[p.trend.length - 1]!;
    expect(todayPoint.date).toBe(TODAY);
    expect(todayPoint.completed).toBe(2);
    expect(todayPoint.blocked).toBe(1);
  });
});

// ── Problems ──────────────────────────────────────────────────────────────────
describe('buildProblems', () => {
  const rows = buildProblems(PROBLEMS, TODAY, 90);
  it('groups by signature with occurrence + spread', () => {
    expect(rows[0]!.signature).toBe('api-socket-closed'); // most recent
    expect(rows[0]!.occurrences).toBe(3);
    expect(rows[0]!.firstSeen).toBe('2026-07-21');
    expect(rows[0]!.lastSeen).toBe(TODAY);
    expect(rows[0]!.daysActive).toBe(2);
    expect(rows[0]!.latestDescription).toBe('socket closed again');
  });
  it('ranks by recent recurrence', () => {
    expect(rows.map((r) => r.signature)).toEqual(['api-socket-closed', 'rai-backlog-drain-miss']);
  });
});

// ── Systems board ─────────────────────────────────────────────────────────────
describe('buildSystemsBoard', () => {
  const rows = buildSystemsBoard(HEALTH, TODAY, 30);
  it('computes uptime + red incidents + today state, worst first', () => {
    expect(rows[0]!.system).toBe('HoldenGR videos'); // red today → first
    expect(rows[0]!.todayState).toBe('red');
    expect(rows[0]!.redIncidents).toBe(2);
    expect(rows[0]!.uptime).toBeCloseTo(86 / 96, 5);
    const rai = rows.find((r) => r.system === 'RAI operations core')!;
    expect(rai.todayState).toBe('green');
    expect(rai.uptime).toBe(1);
  });
  it('renders with a single day of history', () => {
    const oneDay = buildSystemsBoard([HEALTH[0]!], TODAY, 30);
    expect(oneDay.length).toBe(1);
    expect(oneDay[0]!.uptime).toBeCloseTo(40 / 48, 5);
  });
});

// ── Projects (token-only + outcome tint) ──────────────────────────────────────
describe('buildProjectRows', () => {
  const rows = buildProjectRows(PROJECT_MODEL, OUTCOMES, TODAY, 30);
  it('ranks by tokens and tints with interactive outcomes', () => {
    expect(rows[0]!.project).toBe('holden-alt/cc-dashboard');
    expect(rows[0]!.tokens).toBe(9000);
    expect(rows[0]!.completed).toBe(1);
    expect(rows[0]!.blocked).toBe(1);
    expect(rows[0]!.models[0]!.model).toBe('claude-opus-4-8');
  });
});

// ── Trend + hourly (unchanged) ────────────────────────────────────────────────
describe('trend + hourly', () => {
  it('buildTrend groups by vendor (anthropic first), then by tokens, with fixed colors', () => {
    const { models, points } = buildTrend(MODEL_DAILY);
    expect(models.map((m) => m.model)).toEqual(['claude-opus-4-8', 'claude-fable-5', 'gpt-5.6-sol']);
    expect(models.map((m) => m.vendor)).toEqual(['anthropic', 'anthropic', 'openai']);
    expect(models[0]!.color).toBe('#9c5a1e');
    expect(models[2]!.color).toBe('#4f8ff7');
    // per-day cells carry every measure
    const today = points.find((p) => p.date === TODAY)!;
    expect(today.models['claude-opus-4-8']).toEqual({ tokens: 10000, output: 800, turns: 0, minutes: 120 });
    expect(today.models['gpt-5.6-sol']!.output).toBe(1500); // output + reasoning
  });
  it('pickSeries keeps every vendor visible and returns stack order', () => {
    const m = (model: string, vendor: 'anthropic' | 'openai' | 'xai', total: number) =>
      ({ model, source: vendor, vendor, total, color: '#000' });
    const models = [
      m('a1', 'anthropic', 100), m('a2', 'anthropic', 90), m('o1', 'openai', 80),
      m('a3', 'anthropic', 70), m('x1', 'xai', 5), m('x2', 'xai', 2), m('o2', 'openai', 1),
    ];
    const { top, fold } = pickSeries(models, 3);
    // top-3 by tokens are a1, a2, o1; xAI's biggest is pulled in so the grey band exists
    expect(top.map((t) => t.model)).toEqual(['a1', 'a2', 'o1', 'x1']);
    expect([...fold].sort()).toEqual(['a3', 'o2', 'x2']);
  });
  it('bucketTrend anchors weekly buckets at the END of the window (last bucket is a full week)', () => {
    const { points } = buildTrend(MODEL_DAILY);
    const rows = bucketTrend(points, {
      today: TODAY, days: 91, weekly: true, measure: 'tokens', share: false,
      series: ['claude-opus-4-8', 'gpt-5.6-sol'], fold: new Set(['claude-fable-5']),
    });
    // data starts at YESTERDAY, so one bucket, labeled by its end date = today
    expect(rows).toHaveLength(1);
    expect(rows[0]!.date).toBe(TODAY);
    expect(rows[0]!['claude-opus-4-8']).toBe(15000);
    expect(rows[0]!.__other).toBe(3000);
    expect(rows[0]!.__totalAbs).toBe(15000 + 3500 + 3000);
  });
  it('bucketTrend daily rows are calendar-complete and share mode sums to 100', () => {
    const { points } = buildTrend(MODEL_DAILY);
    const rows = bucketTrend(points, {
      today: TODAY, days: 7, weekly: false, measure: 'minutes', share: true,
      series: ['claude-opus-4-8', 'claude-fable-5', 'gpt-5.6-sol'], fold: new Set(),
    });
    expect(rows).toHaveLength(2); // clamped to the earliest data day
    expect(rows.map((r) => r.date)).toEqual([YESTERDAY, TODAY]);
    const t = rows[1]!;
    const sum = (t['claude-opus-4-8'] as number) + (t['claude-fable-5'] as number) + (t['gpt-5.6-sol'] as number);
    expect(sum).toBeCloseTo(100);
    expect(t.__totalAbs).toBe(210);
  });
  it('bucketTrend labels buckets so that the offset from today is a multiple of 7', () => {
    const pts = [
      { date: '2026-06-01', models: { m: { tokens: 1, output: 0, turns: 0, minutes: 0 } } },
      { date: TODAY, models: { m: { tokens: 1, output: 0, turns: 0, minutes: 0 } } },
    ];
    const rows = bucketTrend(pts, { today: TODAY, days: 91, weekly: true, measure: 'tokens', share: false, series: ['m'], fold: new Set() });
    for (const r of rows) expect(daysBetween(r.date as string, TODAY) % 7).toBe(0);
    expect(rows[rows.length - 1]!.date).toBe(TODAY);
    // 06-01 → 07-23 is 52 days: buckets 0..7 (the window clamps to the first data day)
    expect(rows.length).toBe(8);
  });
  it('hourly heatmap sums by dow×hour', () => {
    const agg = buildHourlyAgg(HOURLY);
    const { matrix, total } = buildHeatmapMatrix(agg, TODAY, 7, null);
    const dow = dowMonFirst(TODAY);
    expect(total).toBe(9000);
    expect(matrix[dow]![14]).toBe(6000);
  });
});

// ── Callouts ──────────────────────────────────────────────────────────────────
describe('buildCallouts', () => {
  const lines = buildCallouts(MODEL_DAILY, OUTCOMES, PROBLEMS, HEALTH, TODAY);
  it('emits outcome/problem/health insights, sample-size gated', () => {
    expect(lines.some((l) => /Api socket closed hit 2× today/.test(l))).toBe(true);
    expect(lines.some((l) => /HoldenGR videos: 2 red checks today/.test(l))).toBe(true);
    expect(lines.some((l) => /completion rate 75% this wk vs 67% last/.test(l))).toBe(true);
    expect(lines.some((l) => /Opus 4\.8 completes 67% of interactive sessions/.test(l))).toBe(true);
    expect(lines.length).toBeLessThanOrEqual(5);
  });
  it('degrades to empty with no data', () => {
    expect(buildCallouts([], [], [], [], TODAY)).toEqual([]);
  });
});

// ── Records + efficiency (added 2026-08-04 with the usage-station build) ──────
import { buildDayRankings, buildEfficiency, buildRecords } from '@/lib/insights/compute';
import type { HistoryDayRow } from '@/lib/insights/types';

const hist = (date: string, tokens: number): HistoryDayRow => ({ date, tokens_total: tokens, sessions: null });

describe('buildRecords', () => {
  const rows = [
    hist('2026-07-18', 200_000_000),
    hist('2026-07-19', 1_200_000_000),
    hist('2026-07-20', 600_000_000),
    // 07-21 missing — breaks the streak
    hist('2026-07-22', 100_000_000),
    hist('2026-07-23', 50_000_000),
  ];
  const r = buildRecords(rows, TODAY);

  it('sums lifetime and counts days', () => {
    expect(r.lifetimeTokens).toBe(2_150_000_000);
    expect(r.daysTracked).toBe(5);
  });
  it('finds best day and billion/half-billion clubs', () => {
    expect(r.bestDay).toEqual({ date: '2026-07-19', tokens: 1_200_000_000 });
    expect(r.billionDays).toBe(1);
    expect(r.halfBillionDays).toBe(2);
  });
  it('computes streaks across the gap', () => {
    expect(r.longestStreak).toEqual({ days: 3, end: '2026-07-20' });
    expect(r.currentStreak).toBe(2); // 22nd + 23rd
  });
  it('tolerates today having no row yet', () => {
    const r2 = buildRecords(rows.slice(0, -1), TODAY); // no row for TODAY
    expect(r2.currentStreak).toBe(1); // yesterday's run still counts
  });
  it('picks the next round milestone above lifetime', () => {
    expect(r.nextMilestone).toBe(5e9);
  });
  it('odometer is cumulative and ascending', () => {
    expect(r.odometer.map((p) => p.cumulative)).toEqual([
      200_000_000, 1_400_000_000, 2_000_000_000, 2_100_000_000, 2_150_000_000,
    ]);
  });
  it('records the day each round milestone was crossed', () => {
    expect(r.milestones).toEqual([
      { value: 1e9, date: '2026-07-19' },
      { value: 2e9, date: '2026-07-20' },
    ]);
    expect(r.firstDate).toBe('2026-07-18');
  });
  it('paces over complete days and projects the next milestone', () => {
    // 7 days ending yesterday: 07-16..07-22 → 200M + 1.2B + 600M + 100M = 2.1B / 7
    expect(r.pace.d7).toBeCloseTo(2_100_000_000 / 7);
    expect(r.pace.d30).toBeCloseTo(2_100_000_000 / 30);
    expect(r.pace.lifetime).toBeCloseTo(2_150_000_000 / 6); // 6 calendar days incl. today
    // remaining 2.85B at 70M/day → 41 days
    expect(r.etaNext).toBe(addDays(TODAY, Math.ceil(2_850_000_000 / (2_100_000_000 / 30))));
  });
  it('sums lifetime sessions, deep work and commits from the day store', () => {
    const rich = buildRecords(
      [
        { date: '2026-07-22', tokens_total: 10, sessions: 3, deep_work_minutes: 90, ships: { commits: 4, repos: 2 } },
        { date: '2026-07-23', tokens_total: 10, sessions: 2, deep_work_minutes: 30, ships: { commits: 1, repos: 1 } },
      ],
      TODAY,
    );
    expect(rich.lifetimeSessions).toBe(5);
    expect(rich.lifetimeDeepWorkMinutes).toBe(120);
    expect(rich.lifetimeCommits).toBe(5);
    expect(rich.odometer[0]!.commits).toBe(4);
    expect(rich.etaNext).toBeNull(); // 10 tokens/day would take centuries — no projection
    expect(r.lifetimeCommits).toBeNull(); // fixture rows carry no ships
  });
});

describe('buildShips', () => {
  const ship = (date: string, repo: string, commits: number): RepoShipsRow => ({
    date, repo, commits, insertions: 0, deletions: 0, files_changed: 0,
  });
  const rows = [
    ship('2026-07-10', 'a/one', 5), // outside 7d, inside 30d
    ship(YESTERDAY, 'a/one', 3),
    ship(YESTERDAY, 'b/two', 1),
    ship(TODAY, 'a/one', 2),
  ];
  it('buckets daily and ranks repos', () => {
    const d = buildShips(rows, TODAY, 7, false);
    expect(d.commits).toBe(6);
    expect(d.repoCount).toBe(2);
    expect(d.perDay).toBe(3); // 6 commits over 2 active days
    expect(d.weekly).toHaveLength(7);
    expect(d.weekly[d.weekly.length - 1]).toEqual({ date: TODAY, commits: 2, repos: 1 });
    expect(d.repos[0]).toEqual({ repo: 'a/one', commits: 5, days: 2, last: TODAY });
  });
  it('buckets weekly with end-anchored labels', () => {
    const d = buildShips(rows, TODAY, 91, true);
    expect(d.commits).toBe(11);
    expect(d.weekly).toHaveLength(13);
    expect(d.weekly[d.weekly.length - 1]!.date).toBe(TODAY);
    expect(d.weekly[d.weekly.length - 1]!.commits).toBe(6);
    const wk = d.weekly.find((w) => w.commits === 5)!;
    expect(daysBetween(wk.date, TODAY) % 7).toBe(0);
  });
});

describe('canonicalProject', () => {
  it('folds worktrees onto their base project when known', () => {
    const known = ['richardsonappliedai/richardsonapplied-brain', 'brain'];
    expect(canonicalProject('.codex/worktrees/b7e3/richardsonapplied-brain', known)).toBe('richardsonappliedai/richardsonapplied-brain');
    expect(canonicalProject('.codex/worktrees/f76d/brain', known)).toBe('brain');
    expect(canonicalProject('.claude/worktrees/x1/unknown-repo', known)).toBe('unknown-repo');
  });
  it('buckets codex scratch folders and leaves real projects alone', () => {
    expect(canonicalProject('Documents/Codex/2026-08-25/referenced-chatgpt-conversation')).toBe(CODEX_SCRATCH);
    expect(canonicalProject('holden-alt/cc-dashboard')).toBe('holden-alt/cc-dashboard');
  });
  it('buildProjectRows merges worktree tokens into the base project', () => {
    const rows = buildProjectRows(
      [
        pm({ date: TODAY, project: 'org/repo', source: 'codex', model: 'gpt-5.6-sol', tokens_total: 100, turns: 1 }),
        pm({ date: TODAY, project: '.codex/worktrees/abcd/repo', source: 'codex', model: 'gpt-5.6-sol', tokens_total: 50, turns: 1 }),
      ],
      [],
      TODAY,
      7,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.project).toBe('org/repo');
    expect(rows[0]!.tokens).toBe(150);
  });
});

describe('buildDayRankings', () => {
  it('ranks active days by tokens descending and drops zero days', () => {
    const ranked = buildDayRankings([
      hist('2026-07-18', 200_000_000),
      hist('2026-07-19', 1_200_000_000),
      hist('2026-07-20', 0), // inactive — excluded
      hist('2026-07-21', 600_000_000),
    ]);
    expect(ranked).toEqual([
      { date: '2026-07-19', tokens: 1_200_000_000 },
      { date: '2026-07-21', tokens: 600_000_000 },
      { date: '2026-07-18', tokens: 200_000_000 },
    ]);
  });

  it('breaks ties toward the earlier date, so rank #1 matches bestDay', () => {
    const rows = [hist('2026-07-18', 500), hist('2026-07-19', 500), hist('2026-07-20', 100)];
    const ranked = buildDayRankings(rows);
    expect(ranked.map((d) => d.date)).toEqual(['2026-07-18', '2026-07-19', '2026-07-20']);
    expect(ranked[0]).toEqual(buildRecords(rows, TODAY).bestDay);
  });
});

describe('buildEfficiency', () => {
  const rowsEff: ModelDailyRow[] = [
    md({ date: YESTERDAY, source: 'claude-code', model: 'claude-fable-5',
         input_tokens: 100, cache_read_tokens: 800, cache_create_tokens: 100,
         output_tokens: 50, turns: 10, tool_calls: 30 }),
    md({ date: YESTERDAY, source: 'claude-code', model: 'claude-haiku-4-5',
         input_tokens: 100, cache_read_tokens: 0, cache_create_tokens: 0,
         output_tokens: 950, turns: 10, tool_calls: 10 }),
    // approx rows carry no class/turn detail and must be excluded
    md({ date: YESTERDAY, source: 'claude-code', model: 'approx-history',
         cache_read_tokens: 5_000_000, approx: true } as Partial<ModelDailyRow> & Pick<ModelDailyRow, 'date' | 'source' | 'model'>),
  ];
  const eff = buildEfficiency(rowsEff, TODAY, 7);

  it('aggregates per date+source, excluding approx rows', () => {
    expect(eff).toHaveLength(1);
    const p = eff[0]!;
    expect(p.source).toBe('claude-code');
    // cache rate = 800 / (200 input + 800 read + 100 create)
    expect(p.cacheRate).toBeCloseTo(800 / 1100);
    // tokens/turn = all-classes total 2100 / 20 turns
    expect(p.tokensPerTurn).toBeCloseTo(2100 / 20);
    expect(p.toolCallsPerTurn).toBeCloseTo(40 / 20);
  });
  it('nulls metrics when turns are zero', () => {
    const noTurns = buildEfficiency(
      [md({ date: YESTERDAY, source: 'grok', model: 'g', input_tokens: 100 })], TODAY, 7);
    expect(noTurns[0]!.tokensPerTurn).toBeNull();
    expect(noTurns[0]!.cacheRate).toBeCloseTo(0);
  });
});
