import {
  MODEL_PALETTE,
  OTHER_COLOR,
  TASK_OUTCOMES,
  type EfficiencyPoint,
  type EffectivenessRow,
  type HistoryDayRow,
  type OdometerPoint,
  type RecordsData,
  type HourlyAgg,
  type HourlyRow,
  type ModelDailyRow,
  type ModelMeta,
  type OutcomeTrendPoint,
  type PlansData,
  type ProblemEventRow,
  type ProblemRow,
  type ProjectModelDailyRow,
  type ProjectRow,
  type RankedDay,
  type SessionListItem,
  type SessionOutcomeRow,
  type SystemHealthRow,
  type SystemRow,
  type TodaySummary,
  type TrendPoint,
} from './types';

const TASK_SET = new Set<string>(TASK_OUTCOMES); // completed/partial/blocked/abandoned

// ── Small numeric helpers ────────────────────────────────────────────────────
const n = (x: unknown): number => {
  const v = Number(x);
  return Number.isFinite(v) ? v : 0;
};

/** Total displayable tokens for one model-day row. */
export function totalTokens(r: {
  input_tokens: number;
  output_tokens: number;
  cache_read_tokens: number;
  cache_create_tokens: number;
  reasoning_tokens: number;
}): number {
  return (
    n(r.input_tokens) +
    n(r.output_tokens) +
    n(r.cache_read_tokens) +
    n(r.cache_create_tokens) +
    n(r.reasoning_tokens)
  );
}

/** Inclusive window start date ('YYYY-MM-DD'): the day (days-1) before `today`. */
export function windowStart(today: string, days: number): string {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d.toISOString().slice(0, 10);
}

/** True if `date` falls in the inclusive [start, today] window. ISO strings sort lexically. */
export function inWindow(date: string, today: string, days: number): boolean {
  const start = windowStart(today, days);
  return date >= start && date <= today;
}

/** Shift a 'YYYY-MM-DD' date by `delta` days. */
export function addDays(date: string, delta: number): string {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}

/** Mon-first day-of-week index (0=Mon .. 6=Sun) for a 'YYYY-MM-DD' date. */
export function dowMonFirst(date: string): number {
  const jsDow = new Date(date + 'T00:00:00Z').getUTCDay(); // 0=Sun..6=Sat
  return (jsDow + 6) % 7;
}

export const DOW_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

/** Friendly model name: 'claude-opus-4-8' → 'Opus 4.8', 'gpt-5.6-sol' → 'GPT 5.6 Sol'. */
export function prettyModel(model: string): string {
  let s = model.replace(/^(claude|anthropic)-/, '');
  s = s.replace(/(\d)-(\d)/g, '$1.$2'); // version dashes → dots: 4-8 → 4.8
  s = s.replace(/-/g, ' ').trim();
  return s
    .split(/\s+/)
    .map((w) => {
      if (/^\d/.test(w)) return w;
      if (w.toLowerCase() === 'gpt') return 'GPT';
      return w.charAt(0).toUpperCase() + w.slice(1);
    })
    .join(' ');
}

/** Humanize a kebab-case problem signature: 'api-socket-closed' → 'Api socket closed'. */
export function humanizeSignature(sig: string): string {
  const s = sig.replace(/[-_]/g, ' ').trim();
  return s.length ? s.charAt(0).toUpperCase() + s.slice(1) : sig;
}

function ordinal(n: number): string {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? 'th');
}

// ── Today strip (usage + interactive/automation outcomes) ─────────────────────
export function buildTodaySummary(
  modelDaily: ModelDailyRow[],
  outcomes: SessionOutcomeRow[],
  today: string,
): TodaySummary {
  const todayRows = modelDaily.filter((r) => r.date === today);
  const bySourceMap = new Map<string, { tokens: number; activeMinutes: number }>();
  let cost = 0;
  let hasCost = false;
  for (const r of todayRows) {
    const cur = bySourceMap.get(r.source) ?? { tokens: 0, activeMinutes: 0 };
    cur.tokens += totalTokens(r);
    cur.activeMinutes += n(r.active_minutes);
    bySourceMap.set(r.source, cur);
    if (r.cost_usd != null) {
      cost += n(r.cost_usd);
      hasCost = true;
    }
  }
  const bySource = [...bySourceMap.entries()]
    .map(([source, v]) => ({ source, ...v }))
    .sort((a, b) => b.tokens - a.tokens);

  let interactiveCompleted = 0;
  let interactiveBlocked = 0;
  let interactivePartial = 0;
  let interactiveTotal = 0;
  let automationRuns = 0;
  let automationCompleted = 0;
  for (const o of outcomes) {
    if (o.date !== today) continue;
    if (o.kind === 'interactive') {
      if (!TASK_SET.has(o.outcome)) continue; // exclude chat
      interactiveTotal++;
      if (o.outcome === 'completed') interactiveCompleted++;
      else if (o.outcome === 'blocked') interactiveBlocked++;
      else if (o.outcome === 'partial') interactivePartial++;
    } else if (o.kind === 'automation') {
      automationRuns++;
      if (o.outcome === 'completed') automationCompleted++;
    }
  }

  return {
    date: today,
    bySource,
    totalTokens: bySource.reduce((acc, s) => acc + s.tokens, 0),
    totalActiveMinutes: bySource.reduce((acc, s) => acc + s.activeMinutes, 0),
    cost: hasCost ? cost : null,
    interactiveCompleted,
    interactiveBlocked,
    interactivePartial,
    interactiveTotal,
    automationRuns,
    automationCompleted,
  };
}

// ── Model-mix trend (stacked by model) ───────────────────────────────────────
export function buildTrend(modelDaily: ModelDailyRow[]): {
  points: TrendPoint[];
  models: ModelMeta[];
} {
  const byDate = new Map<string, Record<string, number>>();
  // model → total tokens, and model → (source → tokens) so we can pick the
  // dominant source for a model name that appears under more than one source.
  const modelTotals = new Map<string, number>();
  const modelSources = new Map<string, Map<string, number>>();

  for (const r of modelDaily) {
    const tok = totalTokens(r);
    const day = byDate.get(r.date) ?? {};
    day[r.model] = (day[r.model] ?? 0) + tok;
    byDate.set(r.date, day);

    modelTotals.set(r.model, (modelTotals.get(r.model) ?? 0) + tok);
    const srcMap = modelSources.get(r.model) ?? new Map<string, number>();
    srcMap.set(r.source, (srcMap.get(r.source) ?? 0) + tok);
    modelSources.set(r.model, srcMap);
  }

  const dominantSource = (model: string): string => {
    const srcMap = modelSources.get(model);
    if (!srcMap) return '';
    let best = '';
    let bestTok = -1;
    for (const [src, tok] of srcMap) {
      if (tok > bestTok) {
        bestTok = tok;
        best = src;
      }
    }
    return best;
  };

  const models: ModelMeta[] = [...modelTotals.entries()]
    .map(([model, total]) => ({ model, source: dominantSource(model), total }))
    .sort((a, b) => b.total - a.total)
    .map((m, i) => ({ ...m, color: MODEL_PALETTE[i % MODEL_PALETTE.length] ?? OTHER_COLOR }));

  const points: TrendPoint[] = [...byDate.entries()]
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([date, models]) => ({ date, models }));

  return { points, models };
}

// ── Records / odometer (full-history daily_stats) ────────────────────────────
const MILESTONES_B = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function buildRecords(history: HistoryDayRow[], today: string): RecordsData {
  const rows = [...history]
    .filter((r) => n(r.tokens_total) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let cumulative = 0;
  const odometer: OdometerPoint[] = rows.map((r) => {
    const day = n(r.tokens_total);
    cumulative += day;
    return { date: r.date, cumulative, day };
  });

  const bestDay = rows.reduce<{ date: string; tokens: number } | null>((best, r) => {
    const t = n(r.tokens_total);
    return !best || t > best.tokens ? { date: r.date, tokens: t } : best;
  }, null);

  // Streaks over CALENDAR days (a zero/missing day breaks the run). The current
  // streak tolerates "today has no row yet" — the day isn't over.
  const active = new Set(rows.map((r) => r.date));
  let longest: { days: number; end: string } | null = null;
  let run = 0;
  if (rows.length) {
    const cur = new Date(rows[0]!.date + 'T00:00:00Z');
    const end = new Date(rows[rows.length - 1]!.date + 'T00:00:00Z');
    while (cur <= end) {
      const d = cur.toISOString().slice(0, 10);
      if (active.has(d)) {
        run++;
        if (!longest || run > longest.days) longest = { days: run, end: d };
      } else {
        run = 0;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  }
  let currentStreak = 0;
  {
    let d = active.has(today) ? today : addDays(today, -1);
    while (active.has(d)) {
      currentStreak++;
      d = addDays(d, -1);
    }
  }

  // Best rolling 7-day span.
  let bestWeek: { start: string; tokens: number } | null = null;
  const byDate = new Map(rows.map((r) => [r.date, n(r.tokens_total)]));
  for (const r of rows) {
    let sum = 0;
    for (let i = 0; i < 7; i++) sum += byDate.get(addDays(r.date, i)) ?? 0;
    if (!bestWeek || sum > bestWeek.tokens) bestWeek = { start: r.date, tokens: sum };
  }

  const nextMilestone =
    (MILESTONES_B.find((m) => m * 1e9 > cumulative) ?? MILESTONES_B[MILESTONES_B.length - 1]!) * 1e9;

  return {
    lifetimeTokens: cumulative,
    daysTracked: rows.length,
    bestDay,
    billionDays: rows.filter((r) => n(r.tokens_total) >= 1e9).length,
    halfBillionDays: rows.filter((r) => n(r.tokens_total) >= 5e8).length,
    currentStreak,
    longestStreak: longest,
    bestWeek,
    nextMilestone,
    odometer,
  };
}

/** Every active day ranked by tokens, biggest first. Ties break to the earlier
 *  date so rank #1 is always the same day buildRecords reports as bestDay. */
export function buildDayRankings(history: HistoryDayRow[]): RankedDay[] {
  return history
    .filter((r) => n(r.tokens_total) > 0)
    .map((r) => ({ date: r.date, tokens: n(r.tokens_total) }))
    .sort((a, b) => b.tokens - a.tokens || (a.date < b.date ? -1 : 1));
}

// ── Efficiency trends (how the tokens behave) ────────────────────────────────
// Derived only from REAL (non-approx) rows — restored history carries day totals
// but no class/turn split, so these series simply start where the detail starts.
export function buildEfficiency(
  modelDaily: ModelDailyRow[],
  today: string,
  days: number,
): EfficiencyPoint[] {
  type Acc = { input: number; read: number; create: number; total: number; turns: number; tools: number };
  const acc = new Map<string, Acc>(); // "date|source"
  for (const r of modelDaily) {
    if (r.approx) continue;
    if (!inWindow(r.date, today, days)) continue;
    const key = r.date + '|' + r.source;
    const a = acc.get(key) ?? { input: 0, read: 0, create: 0, total: 0, turns: 0, tools: 0 };
    a.input += n(r.input_tokens);
    a.read += n(r.cache_read_tokens);
    a.create += n(r.cache_create_tokens);
    a.total += totalTokens(r);
    a.turns += n(r.turns);
    a.tools += n(r.tool_calls);
    acc.set(key, a);
  }
  const out: EfficiencyPoint[] = [];
  for (const [key, a] of acc) {
    const [date, source] = key.split('|') as [string, string];
    const inputAll = a.input + a.read + a.create;
    out.push({
      date,
      source,
      cacheRate: inputAll > 0 ? a.read / inputAll : null,
      tokensPerTurn: a.turns > 0 ? a.total / a.turns : null,
      toolCallsPerTurn: a.turns > 0 ? a.tools / a.turns : null,
    });
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : 1));
}

// ── Model effectiveness (interactive outcomes + usage anchor) ─────────────────
// "Which models work for me": per model over a window, using INTERACTIVE task
// sessions only (chat excluded). Tokens + cost come from llm_model_daily so the
// usage trend stays visible; outcome columns come from session_outcomes.
export function buildModelEffectiveness(
  modelDaily: ModelDailyRow[],
  outcomes: SessionOutcomeRow[],
  today: string,
  days: number,
): EffectivenessRow[] {
  // Usage per model (all sources) from llm_model_daily.
  const usage = new Map<string, { source: string; tokens: number; cost: number; hasCost: boolean }>();
  for (const r of modelDaily) {
    if (!inWindow(r.date, today, days)) continue;
    const u = usage.get(r.model) ?? { source: r.source, tokens: 0, cost: 0, hasCost: false };
    u.tokens += totalTokens(r);
    if (r.cost_usd != null) {
      u.cost += n(r.cost_usd);
      u.hasCost = true;
    }
    usage.set(r.model, u);
  }

  // Interactive task outcomes per model from session_outcomes.
  type OAgg = {
    source: string;
    sessions: number;
    completed: number;
    partial: number;
    blocked: number;
    abandoned: number;
    friction: number;
  };
  const oagg = new Map<string, OAgg>();
  for (const o of outcomes) {
    if (o.kind !== 'interactive') continue;
    if (!inWindow(o.date, today, days)) continue;
    if (!TASK_SET.has(o.outcome)) continue; // exclude chat
    const a =
      oagg.get(o.model) ??
      { source: o.source, sessions: 0, completed: 0, partial: 0, blocked: 0, abandoned: 0, friction: 0 };
    a.sessions++;
    if (o.outcome === 'completed') a.completed++;
    else if (o.outcome === 'partial') a.partial++;
    else if (o.outcome === 'blocked') a.blocked++;
    else if (o.outcome === 'abandoned') a.abandoned++;
    a.friction += n(o.friction);
    oagg.set(o.model, a);
  }

  // Rows: models that have at least one interactive task session.
  const rows: EffectivenessRow[] = [...oagg.entries()].map(([model, a]) => {
    const u = usage.get(model);
    return {
      model,
      source: u?.source ?? a.source,
      tokens: u?.tokens ?? 0,
      cost: u?.hasCost ? u.cost : null,
      hasCost: u?.hasCost ?? false,
      sessions: a.sessions,
      completed: a.completed,
      partial: a.partial,
      blocked: a.blocked,
      abandoned: a.abandoned,
      completionRate: a.sessions > 0 ? a.completed / a.sessions : null,
      avgFriction: a.sessions > 0 ? a.friction / a.sessions : null,
    };
  });

  return rows.sort((x, y) => y.sessions - x.sessions || y.tokens - x.tokens);
}

// ── Hourly heatmap ────────────────────────────────────────────────────────────
/** Collapse llm_hourly over models → one row per (date, hour, source). */
export function buildHourlyAgg(hourly: HourlyRow[]): HourlyAgg[] {
  const map = new Map<string, HourlyAgg>();
  for (const r of hourly) {
    const key = r.date + '|' + r.hour + '|' + r.source;
    const cur = map.get(key) ?? { date: r.date, hour: n(r.hour), source: r.source, tokens: 0 };
    cur.tokens += n(r.tokens);
    map.set(key, cur);
  }
  return [...map.values()];
}

/** 7×24 (Mon-first dow × hour) token-intensity matrix over a window, optional source filter. */
export function buildHeatmapMatrix(
  agg: HourlyAgg[],
  today: string,
  days: number,
  source?: string | null,
): { matrix: number[][]; max: number; total: number } {
  const matrix: number[][] = Array.from({ length: 7 }, () => new Array(24).fill(0));
  let max = 0;
  let total = 0;
  for (const r of agg) {
    if (!inWindow(r.date, today, days)) continue;
    if (source && r.source !== source) continue;
    const dow = dowMonFirst(r.date);
    const h = Math.min(23, Math.max(0, r.hour));
    const rowM = matrix[dow];
    if (!rowM) continue;
    const next = (rowM[h] ?? 0) + r.tokens;
    rowM[h] = next;
    total += r.tokens;
    if (next > max) max = next;
  }
  return { matrix, max, total };
}

// ── Project breakdown (token-only + interactive outcome tint) ─────────────────
export function buildProjectRows(
  projectModel: ProjectModelDailyRow[],
  outcomes: SessionOutcomeRow[],
  today: string,
  days: number,
): ProjectRow[] {
  type Acc = { tokens: number; turns: number; models: Map<string, { source: string; tokens: number }> };
  const byProject = new Map<string, Acc>();
  for (const pm of projectModel) {
    if (!inWindow(pm.date, today, days)) continue;
    const acc = byProject.get(pm.project) ?? { tokens: 0, turns: 0, models: new Map() };
    const tok = n(pm.tokens_total);
    acc.tokens += tok;
    acc.turns += n(pm.turns);
    const m = acc.models.get(pm.model) ?? { source: pm.source, tokens: 0 };
    m.tokens += tok;
    acc.models.set(pm.model, m);
    byProject.set(pm.project, acc);
  }

  // Interactive outcome tint per project.
  const outByProject = new Map<string, { completed: number; blocked: number }>();
  for (const o of outcomes) {
    if (o.kind !== 'interactive') continue;
    if (!inWindow(o.date, today, days)) continue;
    const cur = outByProject.get(o.project) ?? { completed: 0, blocked: 0 };
    if (o.outcome === 'completed') cur.completed++;
    else if (o.outcome === 'blocked') cur.blocked++;
    outByProject.set(o.project, cur);
  }

  const rows: ProjectRow[] = [...byProject.entries()].map(([project, acc]) => {
    const out = outByProject.get(project) ?? { completed: 0, blocked: 0 };
    const models = [...acc.models.entries()]
      .map(([model, v]) => ({ model, source: v.source, tokens: v.tokens }))
      .sort((a, b) => b.tokens - a.tokens);
    return {
      project,
      tokens: acc.tokens,
      turns: acc.turns,
      completed: out.completed,
      blocked: out.blocked,
      models,
    };
  });

  return rows.sort((a, b) => b.tokens - a.tokens);
}

// ── Plans & sessions (interactive outcomes) ───────────────────────────────────
/** Interactive TASK completion rate over an inclusive [start, end] date range. */
function completionInRange(
  outcomes: SessionOutcomeRow[],
  start: string,
  end: string,
): { sessions: number; completed: number; rate: number | null } {
  let sessions = 0;
  let completed = 0;
  for (const o of outcomes) {
    if (o.kind !== 'interactive' || !TASK_SET.has(o.outcome)) continue;
    if (o.date < start || o.date > end) continue;
    sessions++;
    if (o.outcome === 'completed') completed++;
  }
  return { sessions, completed, rate: sessions > 0 ? completed / sessions : null };
}

const OUTCOME_SEVERITY: Record<string, number> = {
  blocked: 0,
  partial: 1,
  abandoned: 2,
  completed: 3,
  chat: 4,
};

export function buildPlansSessions(
  outcomes: SessionOutcomeRow[],
  today: string,
  trendDays = 30,
): PlansData {
  // Trend: calendar-complete, zero-filled interactive TASK counts per day.
  const byDate = new Map<string, { completed: number; partial: number; blocked: number; abandoned: number }>();
  for (const o of outcomes) {
    if (o.kind !== 'interactive' || !TASK_SET.has(o.outcome)) continue;
    if (!inWindow(o.date, today, trendDays)) continue;
    const d = byDate.get(o.date) ?? { completed: 0, partial: 0, blocked: 0, abandoned: 0 };
    if (o.outcome === 'completed') d.completed++;
    else if (o.outcome === 'partial') d.partial++;
    else if (o.outcome === 'blocked') d.blocked++;
    else if (o.outcome === 'abandoned') d.abandoned++;
    byDate.set(o.date, d);
  }
  const trend: OutcomeTrendPoint[] = [];
  const cur = new Date(windowStart(today, trendDays) + 'T00:00:00Z');
  const end = new Date(today + 'T00:00:00Z');
  while (cur <= end) {
    const date = cur.toISOString().slice(0, 10);
    const d = byDate.get(date) ?? { completed: 0, partial: 0, blocked: 0, abandoned: 0 };
    trend.push({ date, ...d });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // Week-over-week completion rate.
  const thisStart = windowStart(today, 7);
  const lastStart = windowStart(today, 14);
  const lastEnd = addDays(thisStart, -1);
  const t = completionInRange(outcomes, thisStart, today);
  const l = completionInRange(outcomes, lastStart, lastEnd);

  // Today's interactive sessions (incl. chat), most-actionable first.
  const todaySessions: SessionListItem[] = outcomes
    .filter((o) => o.date === today && o.kind === 'interactive')
    .map((o) => ({
      sessionId: o.session_id,
      project: o.project,
      model: o.model,
      intent: (o.intent ?? '').trim(),
      outcome: o.outcome,
      friction: n(o.friction),
      summary: (o.summary ?? '').trim(),
    }))
    .sort(
      (a, b) =>
        (OUTCOME_SEVERITY[a.outcome] ?? 9) - (OUTCOME_SEVERITY[b.outcome] ?? 9) ||
        b.friction - a.friction,
    )
    .slice(0, 12);

  return {
    trend,
    thisRate: t.rate,
    lastRate: l.rate,
    thisSessions: t.sessions,
    lastSessions: l.sessions,
    todaySessions,
  };
}

// ── Problems I keep fixing ─────────────────────────────────────────────────────
export function buildProblems(
  events: ProblemEventRow[],
  today: string,
  windowDays = 90,
): ProblemRow[] {
  type Acc = {
    occurrences: number;
    firstSeen: string;
    lastSeen: string;
    days: Set<string>;
    latestDate: string;
    latestDesc: string;
  };
  const bySig = new Map<string, Acc>();
  for (const e of events) {
    if (!inWindow(e.date, today, windowDays)) continue;
    const a =
      bySig.get(e.signature) ??
      { occurrences: 0, firstSeen: e.date, lastSeen: e.date, days: new Set<string>(), latestDate: '', latestDesc: '' };
    a.occurrences++;
    if (e.date < a.firstSeen) a.firstSeen = e.date;
    if (e.date > a.lastSeen) a.lastSeen = e.date;
    a.days.add(e.date);
    if (e.date >= a.latestDate) {
      a.latestDate = e.date;
      a.latestDesc = (e.description ?? '').trim();
    }
    bySig.set(e.signature, a);
  }
  const rows: ProblemRow[] = [...bySig.entries()].map(([signature, a]) => ({
    signature,
    occurrences: a.occurrences,
    firstSeen: a.firstSeen,
    lastSeen: a.lastSeen,
    daysActive: a.days.size,
    latestDescription: a.latestDesc,
  }));
  // Ranked by recent recurrence: most-recently-seen first, then most occurrences.
  return rows
    .sort((x, y) => (x.lastSeen < y.lastSeen ? 1 : x.lastSeen > y.lastSeen ? -1 : 0) || y.occurrences - x.occurrences)
    .slice(0, 12);
}

// ── Systems board ──────────────────────────────────────────────────────────────
function stateOf(red: number, amber: number, checks: number): SystemRow['todayState'] {
  if (checks <= 0) return 'none';
  if (red > 0) return 'red';
  if (amber > 0) return 'amber';
  return 'green';
}
const STATE_SEVERITY: Record<string, number> = { red: 0, amber: 1, green: 2, none: 3 };

export function buildSystemsBoard(
  health: SystemHealthRow[],
  today: string,
  windowDays = 30,
): SystemRow[] {
  type Acc = {
    checks: number;
    ok: number;
    amber: number;
    red: number;
    today: { red: number; amber: number; checks: number } | null;
  };
  const bySys = new Map<string, Acc>();
  for (const h of health) {
    if (!inWindow(h.date, today, windowDays)) continue;
    const a = bySys.get(h.system) ?? { checks: 0, ok: 0, amber: 0, red: 0, today: null };
    a.checks += n(h.checks);
    a.ok += n(h.ok);
    a.amber += n(h.amber);
    a.red += n(h.red);
    if (h.date === today) a.today = { red: n(h.red), amber: n(h.amber), checks: n(h.checks) };
    bySys.set(h.system, a);
  }
  const rows: SystemRow[] = [...bySys.entries()].map(([system, a]) => ({
    system,
    checks: a.checks,
    ok: a.ok,
    amber: a.amber,
    red: a.red,
    uptime: a.checks > 0 ? a.ok / a.checks : null,
    redIncidents: a.red,
    todayState: a.today ? stateOf(a.today.red, a.today.amber, a.today.checks) : 'none',
  }));
  return rows.sort(
    (x, y) =>
      (STATE_SEVERITY[x.todayState] ?? 9) - (STATE_SEVERITY[y.todayState] ?? 9) ||
      (x.uptime ?? 1) - (y.uptime ?? 1) ||
      y.redIncidents - x.redIncidents,
  );
}

// ── Insight callouts (rule-based, sample-size gated) ──────────────────────────
export function buildCallouts(
  modelDaily: ModelDailyRow[],
  outcomes: SessionOutcomeRow[],
  problems: ProblemEventRow[],
  health: SystemHealthRow[],
  today: string,
): string[] {
  const out: string[] = [];

  // (1) A problem that recurred today (2+ times).
  {
    const todayCount = new Map<string, number>();
    for (const e of problems) {
      if (e.date === today) todayCount.set(e.signature, (todayCount.get(e.signature) ?? 0) + 1);
    }
    let sig = '';
    let cnt = 0;
    for (const [s, c] of todayCount) if (c > cnt) { cnt = c; sig = s; }
    if (sig && cnt >= 2) {
      const weekDays = new Set<string>();
      for (const e of problems) {
        if (e.signature === sig && inWindow(e.date, today, 7)) weekDays.add(e.date);
      }
      out.push(`${humanizeSignature(sig)} hit ${cnt}× today (${ordinal(weekDays.size)} day this week)`);
    }
  }

  // (2) A system red today.
  {
    let sys = '';
    let red = 0;
    for (const h of health) {
      if (h.date === today && n(h.red) > red) { red = n(h.red); sys = h.system; }
    }
    if (sys && red > 0) out.push(`${sys}: ${red} red check${red === 1 ? '' : 's'} today`);
  }

  // (3) Interactive completion rate week-over-week.
  {
    const thisStart = windowStart(today, 7);
    const lastStart = windowStart(today, 14);
    const lastEnd = addDays(thisStart, -1);
    const t = completionInRange(outcomes, thisStart, today);
    const l = completionInRange(outcomes, lastStart, lastEnd);
    if (t.sessions >= 3 && l.sessions >= 3 && t.rate != null && l.rate != null) {
      out.push(
        `Interactive completion rate ${Math.round(t.rate * 100)}% this wk vs ${Math.round(l.rate * 100)}% last`,
      );
    }
  }

  // (4) Best model by interactive completion (30d).
  {
    const eff = buildModelEffectiveness(modelDaily, outcomes, today, 30);
    const cands = eff.filter((r) => r.sessions >= 5 && r.completionRate != null);
    const top = [...cands].sort((a, b) => (b.completionRate ?? 0) - (a.completionRate ?? 0))[0];
    if (top && top.completionRate != null) {
      out.push(
        `${prettyModel(top.model)} completes ${Math.round(top.completionRate * 100)}% of interactive sessions (30d)`,
      );
    }
  }

  // (5) Automation reliability today.
  {
    let runs = 0;
    let done = 0;
    for (const o of outcomes) {
      if (o.date === today && o.kind === 'automation') {
        runs++;
        if (o.outcome === 'completed') done++;
      }
    }
    if (runs >= 5) {
      out.push(done === runs ? `All ${runs} automation runs completed today` : `Automations: ${done}/${runs} completed today`);
    }
  }

  return out.slice(0, 5);
}
