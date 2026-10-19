import { modelColor, modelLabel, OTHER_COLOR, VENDOR_ORDER, vendorOf } from './colors';
import {
  TASK_OUTCOMES,
  type ActiveWeek,
  type ClockWeek,
  type Grain,
  type EffectivenessRow,
  type HistoryDayRow,
  type Milestone,
  type OdometerPoint,
  type RecordsData,
  type RepoShipsRow,
  type HourlyRow,
  type ModelDailyRow,
  type ModelRank,
  type ModelSeries,
  type ModelWeeks,
  type ProjectLane,
  type ProjectLanes,
  type OutcomeTrendPoint,
  type PlansData,
  type ProblemEventRow,
  type ProblemRow,
  type ProjectModelDailyRow,
  type RankedDay,
  type ShareWindow,
  type Showdown,
  type SessionListItem,
  type SessionOutcomeRow,
  type SystemHealthRow,
  type SystemRow,
  type TodaySummary,
  type VendorDay,
  type VendorPoint,
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
  ships: RepoShipsRow[] = [],
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

  let commits: number | null = null;
  if (ships.length) {
    commits = 0;
    for (const r of ships) if (r.date === today) commits += n(r.commits);
  }

  return {
    date: today,
    bySource,
    totalTokens: bySource.reduce((acc, s) => acc + s.tokens, 0),
    totalActiveMinutes: bySource.reduce((acc, s) => acc + s.activeMinutes, 0),
    cost: hasCost ? cost : null,
    commits,
    interactiveCompleted,
    interactiveBlocked,
    interactivePartial,
    interactiveTotal,
    automationRuns,
    automationCompleted,
  };
}

// ── Model-mix trend (stacked by model, grouped by vendor) ───────────────────




/** Whole days from `a` to `b` (b - a). */
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86_400_000);
}

export type BucketRow = Record<string, number | string>;


// ── Records / odometer (full-history daily_stats) ────────────────────────────
const MILESTONES_B = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000];

export function buildRecords(history: HistoryDayRow[], today: string): RecordsData {
  const rows = [...history]
    .filter((r) => n(r.tokens_total) > 0)
    .sort((a, b) => (a.date < b.date ? -1 : 1));

  let cumulative = 0;
  let sessions = 0;
  let deepWork = 0;
  let commits = 0;
  let hasShips = false;
  const milestones: Milestone[] = [];
  let nextIdx = 0;
  const odometer: OdometerPoint[] = rows.map((r) => {
    const day = n(r.tokens_total);
    cumulative += day;
    sessions += n(r.sessions);
    deepWork += n(r.deep_work_minutes);
    const c = r.ships && typeof r.ships === 'object' ? r.ships.commits : undefined;
    if (c != null) {
      hasShips = true;
      commits += n(c);
    }
    while (nextIdx < MILESTONES_B.length && cumulative >= MILESTONES_B[nextIdx]! * 1e9) {
      milestones.push({ value: MILESTONES_B[nextIdx]! * 1e9, date: r.date });
      nextIdx++;
    }
    return {
      date: r.date,
      cumulative,
      day,
      sessions: n(r.sessions),
      deepWorkMinutes: n(r.deep_work_minutes),
      commits: c == null ? null : n(c),
    };
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

  // Pace over COMPLETE days (the trailing 7 / 30 ending yesterday); today is
  // still being written. Lifetime pace is per calendar day since the first row.
  const trailing = (days: number): number => {
    let sum = 0;
    for (let i = 1; i <= days; i++) sum += byDate.get(addDays(today, -i)) ?? 0;
    return sum / days;
  };
  const firstDate = rows[0]?.date ?? null;
  const calendarDays = firstDate ? Math.max(1, daysBetween(firstDate, today) + 1) : 1;
  const pace = { d7: trailing(7), d30: trailing(30), lifetime: cumulative / calendarDays };
  // No projection when the pace is effectively zero (a Date can't hold it and
  // the number would be meaningless anyway): cap at ~10 years out.
  const daysToNext = pace.d30 > 0 ? Math.ceil((nextMilestone - cumulative) / pace.d30) : Infinity;
  const etaNext = cumulative < nextMilestone && daysToNext <= 3650 ? addDays(today, daysToNext) : null;

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
    firstDate,
    lifetimeSessions: sessions,
    lifetimeDeepWorkMinutes: deepWork,
    lifetimeCommits: hasShips ? commits : null,
    milestones,
    pace,
    etaNext,
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



// ── Project breakdown (token-only + interactive outcome tint) ─────────────────
const WORKTREE_RE = /^\.(?:codex|claude)\/worktrees\/[^/]+\//;
// A worktree inside a project ('watch-desk/.claude/worktrees/agent-a74b…') is
// that project's work, not a project of its own.
const NESTED_WORKTREE_RE = /\/\.(?:codex|claude)\/worktrees\/[^/]+(?:\/.*)?$/;
const CODEX_SCRATCH_RE = /^Documents\/Codex\/\d{4}-\d{2}-\d{2}\//;
export const CODEX_SCRATCH = 'codex · scratch';

/**
 * Display-side project folding: a Codex/Claude worktree checkout is the same
 * project as its base repo, and Codex's per-conversation scratch folders are
 * one bucket. `known` is the set of non-worktree names in the window, so a
 * worktree suffix like "richardsonapplied-brain/clients/h-and-l" can snap onto
 * "richardsonappliedai/richardsonapplied-brain/clients/h-and-l".
 */
export function canonicalProject(project: string, known?: Iterable<string>): string {
  if (CODEX_SCRATCH_RE.test(project)) return CODEX_SCRATCH;
  const nested = project.replace(NESTED_WORKTREE_RE, '');
  if (nested !== project) return nested;
  if (!WORKTREE_RE.test(project)) return project;
  const stripped = project.replace(WORKTREE_RE, '');
  if (known) {
    let best: string | null = null;
    for (const k of known) {
      if (k === stripped || k.endsWith('/' + stripped)) {
        if (!best || k.length < best.length) best = k;
      }
    }
    if (best) return best;
  }
  return stripped;
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

// ── Overview: Claude vs. Codex, all-time ──────────────────────────────────────
// The station's headline question is "how much am I using each tool". These read
// the FULL llm_model_daily history (restored early days included: they are
// Claude-only day totals under 'approx-history') and split every token by vendor.

/** Full history as calendar days split by tool, zero-filled from the first
 *  recorded day through `today`. */
export function buildVendorDays(rows: ModelDailyRow[], today: string): VendorDay[] {
  const byDate = new Map<string, VendorDay>();
  let first: string | null = null;
  for (const r of rows) {
    if (r.date > today) continue;
    const t = totalTokens(r);
    if (t <= 0) continue;
    if (first === null || r.date < first) first = r.date;
    const day = byDate.get(r.date) ?? { date: r.date, claude: 0, codex: 0, other: 0 };
    const vendor = vendorOf(r.model, r.source);
    if (vendor === 'anthropic') day.claude += t;
    else if (vendor === 'openai') day.codex += t;
    else day.other += t;
    byDate.set(r.date, day);
  }
  if (first === null) return [];
  const out: VendorDay[] = [];
  for (let d = first; d <= today; d = addDays(d, 1)) {
    out.push(byDate.get(d) ?? { date: d, claude: 0, codex: 0, other: 0 });
  }
  return out;
}

function shareOf(claude: number, codex: number): number | null {
  const both = claude + codex;
  return both > 0 ? codex / both : null;
}

/** Bucket start for a day: itself, its Monday, or the 1st of its month. */
function bucketStart(date: string, grain: Grain): string {
  if (grain === 'day') return date;
  if (grain === 'week') return addDays(date, -dowMonFirst(date));
  return date.slice(0, 8) + '01';
}

/** Sum VendorDays into days, Monday-start weeks, or calendar months. The last
 *  bucket is flagged partial when its week/month has not finished yet. */
export function bucketVendorDays(days: VendorDay[], grain: Grain): VendorPoint[] {
  const out: VendorPoint[] = [];
  for (const d of days) {
    const start = bucketStart(d.date, grain);
    let b = out[out.length - 1];
    if (!b || b.start !== start) {
      b = { start, end: d.date, claude: 0, codex: 0, other: 0, total: 0, codexShare: null, partial: false };
      out.push(b);
    }
    b.end = d.date;
    b.claude += d.claude;
    b.codex += d.codex;
    b.other += d.other;
    b.total += d.claude + d.codex + d.other;
  }
  for (const b of out) b.codexShare = shareOf(b.claude, b.codex);
  const last = out[out.length - 1];
  if (last && grain !== 'day') {
    const fullEnd =
      grain === 'week'
        ? addDays(last.start, 6)
        : addDays(addDays(last.start, 32).slice(0, 8) + '01', -1); // last day of month
    last.partial = last.end < fullEnd;
  }
  return out;
}

export const SHARE_WINDOW_DAYS: Record<Exclude<ShareWindow, 'all'>, number> = { '7d': 7, '30d': 30, '90d': 90 };

/** Claude vs. Codex over a trailing window (or all time). */
export function buildShowdown(days: VendorDay[], today: string, window: ShareWindow): Showdown {
  let claude = 0;
  let codex = 0;
  for (const d of days) {
    if (window !== 'all' && !inWindow(d.date, today, SHARE_WINDOW_DAYS[window])) continue;
    claude += d.claude;
    codex += d.codex;
  }
  const codexShare = shareOf(claude, codex);
  let leader: Showdown['leader'] = null;
  let ratio: number | null = null;
  if (claude > 0 && codex > 0) {
    const r = Math.max(claude, codex) / Math.min(claude, codex);
    leader = r < 1.05 ? 'even' : claude > codex ? 'claude' : 'codex';
    ratio = r;
  } else if (claude > 0) leader = 'claude';
  else if (codex > 0) leader = 'codex';
  return { claude, codex, codexShare, leader, ratio };
}

/** Models ranked by tokens over a trailing window (null = all time). Restored
 *  history keeps its honest unattributed label; the tail past `max` folds into
 *  one grey "other models" bar so the ranking never needs a ninth hue. */
export function buildModelRanking(
  rows: ModelDailyRow[],
  today: string,
  days: number | null,
  max = 8,
): ModelRank[] {
  const totals = new Map<string, { source: string; tokens: number }>();
  let all = 0;
  for (const r of rows) {
    if (r.date > today) continue;
    if (days !== null && !inWindow(r.date, today, days)) continue;
    const t = totalTokens(r);
    if (t <= 0) continue;
    const cur = totals.get(r.model) ?? { source: r.source, tokens: 0 };
    cur.tokens += t;
    totals.set(r.model, cur);
    all += t;
  }
  if (all === 0) return [];
  const ranked = [...totals.entries()]
    .map(([model, v]) => ({
      model,
      label: modelLabel(model, prettyModel),
      vendor: vendorOf(model, v.source),
      color: modelColor(model, v.source),
      tokens: v.tokens,
      share: v.tokens / all,
    }))
    .sort((a, b) => b.tokens - a.tokens || (a.model < b.model ? -1 : 1));
  if (ranked.length <= max) return ranked;
  const head = ranked.slice(0, max - 1);
  const tail = ranked.slice(max - 1);
  const tailTokens = tail.reduce((s, m) => s + m.tokens, 0);
  return [
    ...head,
    {
      model: 'other',
      label: `${tail.length} other models`,
      vendor: 'other',
      color: OTHER_COLOR,
      tokens: tailTokens,
      share: tailTokens / all,
    },
  ];
}

// ── Detail: all-time views ────────────────────────────────────────────────────
// Each answers "how has this changed since the first tracked day", so every one
// buckets the full history into Monday-start weeks.

/** Monday of the week containing `date`. */
export function weekStart(date: string): string {
  return addDays(date, -dowMonFirst(date));
}

/** Every Monday from the week of `first` through the week of `today`. */
export function weeksThrough(first: string, today: string): string[] {
  const out: string[] = [];
  for (let w = weekStart(first); w <= today; w = addDays(w, 7)) out.push(w);
  return out;
}

/** Weekly tokens for the biggest models (plus one 'other' series) and the full
 *  all-time list. Stacks bottom-up by vendor, then in the order models arrived,
 *  so the chart reads as a succession of model eras. */
export function buildModelWeeks(rows: ModelDailyRow[], today: string, max = 9): ModelWeeks {
  const meta = new Map<string, { source: string; total: number; first: string; last: string }>();
  const byWeek = new Map<string, Map<string, number>>();
  for (const r of rows) {
    if (r.date > today) continue;
    const t = totalTokens(r);
    if (t <= 0) continue;
    const m = meta.get(r.model) ?? { source: r.source, total: 0, first: r.date, last: r.date };
    m.total += t;
    if (r.date < m.first) m.first = r.date;
    if (r.date > m.last) m.last = r.date;
    meta.set(r.model, m);
    const w = weekStart(r.date);
    const cell = byWeek.get(w) ?? new Map<string, number>();
    cell.set(r.model, (cell.get(r.model) ?? 0) + t);
    byWeek.set(w, cell);
  }
  if (meta.size === 0) return { weeks: [], stack: [], list: [] };

  const series = (model: string): ModelSeries => {
    const m = meta.get(model)!;
    return {
      model,
      label: modelLabel(model, prettyModel),
      vendor: vendorOf(model, m.source),
      color: modelColor(model, m.source),
      total: m.total,
      first: m.first,
      last: m.last,
    };
  };
  const list = [...meta.keys()].map(series).sort((a, b) => b.total - a.total || (a.model < b.model ? -1 : 1));
  const shown = list.length > max ? list.slice(0, max) : list;
  const shownSet = new Set(shown.map((m) => m.model));
  const tail = list.filter((m) => !shownSet.has(m.model));
  const vendorRank = (v: string) => VENDOR_ORDER.indexOf(v as never);
  const stack = [...shown].sort(
    (a, b) => vendorRank(a.vendor) - vendorRank(b.vendor) || (a.first < b.first ? -1 : a.first > b.first ? 1 : 0),
  );
  if (tail.length) {
    stack.push({
      model: 'other',
      label: `${tail.length} other models`,
      vendor: 'other',
      color: OTHER_COLOR,
      total: tail.reduce((sum, m) => sum + m.total, 0),
      first: tail.reduce((d, m) => (m.first < d ? m.first : d), tail[0]!.first),
      last: tail.reduce((d, m) => (m.last > d ? m.last : d), tail[0]!.last),
    });
  }

  const firstDay = list.reduce((d, m) => (m.first < d ? m.first : d), list[0]!.first);
  const weeks = weeksThrough(firstDay, today).map((start) => {
    const cell = byWeek.get(start);
    const values: Record<string, number> = {};
    for (const m of stack) values[m.model] = 0;
    if (cell) {
      for (const [model, t] of cell) {
        const key = shownSet.has(model) ? model : 'other';
        values[key] = (values[key] ?? 0) + t;
      }
    }
    return { start, partial: addDays(start, 6) > today, values };
  });
  return { weeks, stack, list };
}

/** The work-day axis starts here, so a 1 a.m. session sits under the evening
 *  that led to it instead of wrapping back to the top of the chart. */
export const WORKDAY_START_HOUR = 4;

/** Clock hour (0–23) → position on the work-day axis (0–23). */
export function workdayIndex(hour: number): number {
  return (((hour - WORKDAY_START_HOUR) % 24) + 24) % 24;
}

/** Position on the work-day axis (fractional ok) → clock hour (0–24). */
export function clockHourAt(index: number): number {
  return (index + WORKDAY_START_HOUR) % 24;
}

/** Weekly tokens per hour of the day, per tool, all time. */
export function buildWorkClock(hourly: HourlyRow[], today: string): ClockWeek[] {
  let first: string | null = null;
  for (const r of hourly) if (r.date <= today && r.tokens > 0 && (!first || r.date < first)) first = r.date;
  if (!first) return [];
  const weeks = weeksThrough(first, today).map((start) => ({
    start,
    claude: new Array<number>(24).fill(0),
    codex: new Array<number>(24).fill(0),
    other: new Array<number>(24).fill(0),
  }));
  const index = new Map(weeks.map((w, i) => [w.start, i]));
  for (const r of hourly) {
    if (r.date > today || r.tokens <= 0) continue;
    const w = weeks[index.get(weekStart(r.date))!]!;
    const vendor = vendorOf(r.model, r.source);
    const lane = vendor === 'anthropic' ? w.claude : vendor === 'openai' ? w.codex : w.other;
    lane[workdayIndex(r.hour)]! += r.tokens;
  }
  return weeks;
}

/** Token-weighted median position on the work-day axis — the point by which
 *  half of the work was done. Null when nothing ran. */
export function workdayMidpoint(cells: number[]): number | null {
  const total = cells.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const half = total / 2;
  let cum = 0;
  for (let i = 0; i < cells.length; i++) {
    const c = cells[i]!;
    if (c > 0 && cum + c >= half) return i + (half - cum) / c;
    cum += c;
  }
  return cells.length;
}

/** Your time per week: deep-work hours (from daily_stats), split by which
 *  tools were running. The split comes from clock hours in llm_hourly — an hour
 *  where both ran counts as "both" — applied to that week's deep work. Clock
 *  hours alone overstate your time (any scheduled run lights an hour up), so
 *  they set the split, not the height. */
export function buildActiveHours(hourly: HourlyRow[], history: HistoryDayRow[], today: string): ActiveWeek[] {
  const hours = new Map<string, { claude: boolean; codex: boolean; other: boolean }>();
  let first: string | null = null;
  for (const r of hourly) {
    if (r.date > today || r.tokens <= 0) continue;
    if (!first || r.date < first) first = r.date;
    const key = `${r.date}|${r.hour}`;
    const h = hours.get(key) ?? { claude: false, codex: false, other: false };
    const vendor = vendorOf(r.model, r.source);
    if (vendor === 'anthropic') h.claude = true;
    else if (vendor === 'openai') h.codex = true;
    else h.other = true;
    hours.set(key, h);
  }
  for (const d of history) if (d.date <= today && n(d.deep_work_minutes) > 0 && (!first || d.date < first)) first = d.date;
  if (!first) return [];

  const weeks = weeksThrough(first, today).map((start) => {
    const days = Math.min(7, daysBetween(start, today) + 1);
    return { start, days, deep: 0, claudeOnly: 0, codexOnly: 0, both: 0, other: 0, running: 0, partial: days < 7 };
  });
  const index = new Map(weeks.map((w, i) => [w.start, i]));
  for (const [key, h] of hours) {
    const w = weeks[index.get(weekStart(key.slice(0, 10)))!]!;
    if (h.claude && h.codex) w.both++;
    else if (h.claude) w.claudeOnly++;
    else if (h.codex) w.codexOnly++;
    else w.other++;
    w.running++;
  }
  for (const d of history) {
    if (d.date > today) continue;
    const i = index.get(weekStart(d.date));
    if (i !== undefined) weeks[i]!.deep += n(d.deep_work_minutes) / 60;
  }
  return weeks.map((w) => {
    const scale = w.running > 0 ? w.deep / w.running : 0;
    return {
      start: w.start,
      days: w.days,
      // A week with deep work but no hourly detail keeps its height as Claude
      // (the only tool before hourly tracking began).
      claudeOnly: w.running > 0 ? w.claudeOnly * scale : w.deep,
      codexOnly: w.codexOnly * scale,
      both: w.both * scale,
      other: w.other * scale,
      total: w.deep,
      running: w.running,
      partial: w.partial,
    };
  });
}

/** Short lane name: the last path segment, or the last two when that would
 *  collide with another shown project. */
function projectLabels(projects: string[]): Map<string, string> {
  const base = (p: string, n: number) => {
    if (p === '~') return 'home folder';
    return p.split('/').filter(Boolean).slice(-n).join('/') || p;
  };
  const counts = new Map<string, number>();
  for (const p of projects) counts.set(base(p, 1), (counts.get(base(p, 1)) ?? 0) + 1);
  return new Map(projects.map((p) => [p, (counts.get(base(p, 1)) ?? 0) > 1 ? base(p, 2) : base(p, 1)]));
}

/** The biggest projects as weekly lanes, ordered by when each started, so the
 *  chart reads as projects arriving, peaking, and fading. */
export function buildProjectLanes(rows: ProjectModelDailyRow[], today: string, max = 14): ProjectLanes {
  const known = new Set<string>();
  for (const r of rows) if (!WORKTREE_RE.test(r.project) && !NESTED_WORKTREE_RE.test(r.project)) known.add(r.project);
  type Acc = { total: number; first: string; last: string; weeks: Map<string, { claude: number; codex: number; other: number }> };
  const acc = new Map<string, Acc>();
  let firstDay: string | null = null;
  for (const r of rows) {
    const t = n(r.tokens_total);
    if (r.date > today || t <= 0) continue;
    if (!firstDay || r.date < firstDay) firstDay = r.date;
    const project = canonicalProject(r.project, known);
    const a = acc.get(project) ?? { total: 0, first: r.date, last: r.date, weeks: new Map() };
    a.total += t;
    if (r.date < a.first) a.first = r.date;
    if (r.date > a.last) a.last = r.date;
    const w = weekStart(r.date);
    const cell = a.weeks.get(w) ?? { claude: 0, codex: 0, other: 0 };
    const vendor = vendorOf(r.model, r.source);
    if (vendor === 'anthropic') cell.claude += t;
    else if (vendor === 'openai') cell.codex += t;
    else cell.other += t;
    a.weeks.set(w, cell);
    acc.set(project, a);
  }
  if (!firstDay) return { weeks: [], lanes: [], maxCell: 0, rest: { count: 0, total: 0 } };

  const weeks = weeksThrough(firstDay, today);
  const ranked = [...acc.entries()].sort((a, b) => b[1].total - a[1].total || (a[0] < b[0] ? -1 : 1));
  const shown = ranked.slice(0, max);
  const labels = projectLabels(shown.map(([p]) => p));
  let maxCell = 0;
  const lanes: ProjectLane[] = shown
    .map(([project, a]) => {
      const cells = weeks.map((w) => a.weeks.get(w) ?? { claude: 0, codex: 0, other: 0 });
      for (const c of cells) maxCell = Math.max(maxCell, c.claude + c.codex + c.other);
      return { project, label: labels.get(project) ?? project, total: a.total, first: a.first, last: a.last, cells };
    })
    .sort((a, b) => (a.first < b.first ? -1 : a.first > b.first ? 1 : b.total - a.total));
  const restRows = ranked.slice(max);
  return {
    weeks,
    lanes,
    maxCell,
    rest: { count: restRows.length, total: restRows.reduce((sum, [, a]) => sum + a.total, 0) },
  };
}

/** Average deep-work hours per day over a trailing window (null = since the
 *  first tracked day). */
export function deepWorkPerDay(history: HistoryDayRow[], today: string, days: number | null): number {
  let minutes = 0;
  let first: string | null = null;
  for (const d of history) {
    if (d.date > today) continue;
    if (days !== null && !inWindow(d.date, today, days)) continue;
    if (!first || d.date < first) first = d.date;
    minutes += n(d.deep_work_minutes);
  }
  if (!first) return 0;
  return minutes / 60 / (days ?? daysBetween(first, today) + 1);
}
