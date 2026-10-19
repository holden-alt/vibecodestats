import type { Database } from '@/lib/types/database';
import { OTHER_COLOR as VENDOR_OTHER, VENDOR_COLOR, type Vendor } from './colors';

// ── Raw row aliases (generated DB types) ────────────────────────────────────
// `approx` was added to the live table 2026-07-23 (restored-history rows carry
// day totals only); the generated Database types predate it.
export type ModelDailyRow = Database['public']['Tables']['llm_model_daily']['Row'] & {
  approx?: boolean | null;
};
export type ProjectModelDailyRow = Database['public']['Tables']['llm_project_model_daily']['Row'];
export type HourlyRow = Database['public']['Tables']['llm_hourly']['Row'];
export type SessionOutcomeRow = Database['public']['Tables']['session_outcomes']['Row'];
export type ProblemEventRow = Database['public']['Tables']['problem_events']['Row'];
export type SystemHealthRow = Database['public']['Tables']['system_health_daily']['Row'];
export type RepoShipsRow = Database['public']['Tables']['repo_ships_daily']['Row'];

// ── Outcome vocabulary ───────────────────────────────────────────────────────
export type OutcomeKind = 'interactive' | 'automation';
export type Outcome = 'completed' | 'partial' | 'blocked' | 'abandoned' | 'chat';

// The outcomes that count as a judged TASK (chat is conversation, not a task and
// is excluded from completion-rate + friction denominators).
export const TASK_OUTCOMES: Outcome[] = ['completed', 'partial', 'blocked', 'abandoned'];

export const OUTCOME_COLOR: Record<string, string> = {
  completed: 'var(--color-green)',
  partial: 'var(--color-yellow)',
  blocked: 'var(--color-red)',
  abandoned: 'var(--color-dim)',
  chat: 'var(--color-cyan)',
};
export const OUTCOME_LABEL: Record<string, string> = {
  completed: 'done',
  partial: 'partial',
  blocked: 'blocked',
  abandoned: 'abandoned',
  chat: 'chat',
};

// ── Sources ─────────────────────────────────────────────────────────────────
export const SOURCES = ['claude-code', 'codex', 'grok', 'kimi'] as const;
export type Source = (typeof SOURCES)[number];

// Human labels for the terminal UI.
export const SOURCE_LABEL: Record<string, string> = {
  'claude-code': 'claude code',
  codex: 'codex',
  grok: 'grok',
  kimi: 'kimi',
};

// Each source takes its VENDOR anchor: Anthropic warm orange, OpenAI cool blue,
// xAI white/grey, Moonshot violet. See ./colors.ts for the model-level shades.
export const SOURCE_COLOR: Record<string, string> = {
  'claude-code': VENDOR_COLOR.anthropic,
  codex: VENDOR_COLOR.openai,
  grok: VENDOR_COLOR.xai,
  kimi: VENDOR_COLOR.moonshot,
};

export const OTHER_COLOR = VENDOR_OTHER;

// ── Measures ────────────────────────────────────────────────────────────────
// Raw tokens are ~95% cache reads, so they track context length × turns more
// than work done. The mix chart can therefore be read in four measures.
export type Measure = 'tokens' | 'output' | 'turns' | 'minutes';
export const MEASURES: { id: Measure; label: string; hint: string }[] = [
  { id: 'tokens', label: 'tokens', hint: 'all token classes (input, output, cache read/create, reasoning)' },
  { id: 'output', label: 'output', hint: 'generated tokens only (output + reasoning)' },
  { id: 'turns', label: 'turns', hint: 'assistant turns' },
  { id: 'minutes', label: 'time', hint: 'active minutes' },
];

// ── Derived / serializable shapes passed to client components ────────────────

/** Per-model measures for one day. */
export type TrendCell = { tokens: number; output: number; turns: number; minutes: number };

/** One point in the stacked model-mix trend. `models` maps model → that day's measures. */
export type TrendPoint = {
  date: string;
  models: Record<string, TrendCell>;
};

/** Metadata about a model line in the trend (for color + source filtering + ordering). */
export type ModelMeta = {
  model: string;
  source: string;
  vendor: Vendor;
  color: string;
  total: number;
};

/** One row of the model-EFFECTIVENESS table (interactive outcomes + usage). */
export type EffectivenessRow = {
  model: string;
  source: string;
  // usage anchor (still wanted):
  tokens: number;
  cost: number | null;
  hasCost: boolean;
  // interactive outcomes (task sessions only; chat excluded):
  sessions: number;
  completed: number;
  partial: number;
  blocked: number;
  abandoned: number;
  completionRate: number | null; // completed / sessions
  avgFriction: number | null;
};

/** Pre-aggregated hourly cell: tokens for a (date, hour, source). */
export type HourlyAgg = {
  date: string;
  hour: number;
  source: string;
  tokens: number;
};

/** One project row in the project breakdown (token-only + outcome tint). */
export type ProjectRow = {
  project: string;
  tokens: number;
  turns: number;
  // interactive outcome tint:
  completed: number;
  blocked: number;
  // model mix within the project: model → tokens (already ordered desc)
  models: { model: string; source: string; tokens: number }[];
};

/** Today strip: usage + interactive/automation outcome summary for the local day. */
export type TodaySummary = {
  date: string;
  bySource: { source: string; tokens: number; activeMinutes: number }[];
  totalTokens: number;
  totalActiveMinutes: number;
  cost: number | null;
  /** git commits landed today (null when ships are not tracked). */
  commits: number | null;
  // interactive today (task sessions):
  interactiveCompleted: number;
  interactiveBlocked: number;
  interactivePartial: number;
  interactiveTotal: number;
  // automation fleet today:
  automationRuns: number;
  automationCompleted: number;
};

/** One day in the interactive-outcomes trend (calendar-complete, zero-filled). */
export type OutcomeTrendPoint = {
  date: string;
  completed: number;
  partial: number;
  blocked: number;
  abandoned: number;
};

/** One interactive session in the day's session list. */
export type SessionListItem = {
  sessionId: string;
  project: string;
  model: string;
  intent: string;
  outcome: string;
  friction: number;
  summary: string;
};

/** Plans & sessions panel payload. */
export type PlansData = {
  trend: OutcomeTrendPoint[];
  thisRate: number | null; // this-week completion rate
  lastRate: number | null; // last-week completion rate
  thisSessions: number;
  lastSessions: number;
  todaySessions: SessionListItem[];
};

/** One recurring-problem signature, aggregated. */
export type ProblemRow = {
  signature: string;
  occurrences: number;
  firstSeen: string;
  lastSeen: string;
  daysActive: number;
  latestDescription: string;
};

/** One system in the systems board over a window. */
export type SystemRow = {
  system: string;
  checks: number;
  ok: number;
  amber: number;
  red: number;
  uptime: number | null; // ok / checks
  redIncidents: number; // sum(red) over window
  todayState: 'green' | 'amber' | 'red' | 'none';
};

export type WindowKey = '7d' | '30d' | '90d';

// ── Records / odometer (full-history daily_stats) ────────────────────────────

/** Minimal full-history day row from daily_stats (survives transcript cleanup). */
export type HistoryDayRow = {
  date: string;
  tokens_total: number;
  sessions: number | null;
  deep_work_minutes?: number | null;
  ships?: { commits?: number; repos?: number } | null;
};

/** A cumulative milestone that has been crossed, and the day it happened. */
export type Milestone = { value: number; date: string };

/** Tokens per day over a trailing span (complete days only). */
export type Pace = { d7: number; d30: number; lifetime: number };

/** One day of full history: cumulative tokens plus that day's counters. */
export type OdometerPoint = {
  date: string;
  cumulative: number;
  day: number;
  sessions?: number;
  deepWorkMinutes?: number;
  commits?: number | null;
};

/** Records board payload — lifetime bests derived from full history. */
export type RecordsData = {
  lifetimeTokens: number;
  daysTracked: number;
  bestDay: { date: string; tokens: number } | null;
  billionDays: number; // days at >= 1B tokens
  halfBillionDays: number; // days at >= 500M tokens
  currentStreak: number;
  longestStreak: { days: number; end: string } | null;
  bestWeek: { start: string; tokens: number } | null; // best rolling 7-day span
  nextMilestone: number; // next round cumulative target (e.g. 50B)
  odometer: OdometerPoint[];
  firstDate: string | null;
  lifetimeSessions: number;
  lifetimeDeepWorkMinutes: number;
  lifetimeCommits: number | null; // null when no ship data at all
  milestones: Milestone[]; // crossed, ascending
  pace: Pace;
  etaNext: string | null; // date the next milestone lands at the 30d pace
};

// ── Ships (git commits) ──────────────────────────────────────────────────────
export type ShipsWeek = { date: string; commits: number; repos: number };
export type ShipsRepo = { repo: string; commits: number; days: number; last: string };
export type ShipsData = {
  weekly: ShipsWeek[]; // end-labeled buckets, ascending
  repos: ShipsRepo[]; // top repos in the window, desc
  commits: number;
  repoCount: number;
  perDay: number; // commits per active day
};

/** One row of the day-rankings list — an active day and its token total. */
export type RankedDay = {
  date: string;
  tokens: number;
};

// ── Efficiency trends (non-approx llm_model_daily rows only) ─────────────────

/** Per-day per-source efficiency sample. Null metric = not derivable that day. */
export type EfficiencyPoint = {
  date: string;
  source: string;
  cacheRate: number | null; // cache_read / (input + cache_read + cache_create)
  tokensPerTurn: number | null; // all-classes tokens / turns
  toolCallsPerTurn: number | null;
};

// ── Overview: Claude vs. Codex, all-time (full-history llm_model_daily) ──────

/** One calendar day split by tool. Claude = Anthropic models, Codex = OpenAI
 *  models, other = everything else (Grok, Kimi). Zero-filled, so a day with no
 *  usage is a real 0, not a gap. */
export type VendorDay = { date: string; claude: number; codex: number; other: number };

export type Grain = 'day' | 'week' | 'month';

/** A day, Monday-start week, or calendar month of VendorDays, summed. */
export type VendorPoint = {
  /** First day of the bucket ('YYYY-MM-DD'). */
  start: string;
  /** Last day of the bucket that has happened yet. */
  end: string;
  claude: number;
  codex: number;
  other: number;
  total: number;
  /** Codex's share of Claude + Codex tokens, 0..1; null when neither ran. */
  codexShare: number | null;
  /** True for the bucket still in progress (this week / this month). */
  partial: boolean;
};

export type ShareWindow = '7d' | '30d' | '90d' | 'all';

/** "How much more am I using Codex than Claude?" for one window. */
export type Showdown = {
  claude: number;
  codex: number;
  /** Codex's share of Claude + Codex, 0..1; null when neither ran. */
  codexShare: number | null;
  leader: 'claude' | 'codex' | 'even' | null;
  /** Leader's tokens ÷ the other's (≥ 1); null when only one tool ran. */
  ratio: number | null;
};

/** One bar of the model ranking. */
export type ModelRank = {
  model: string;
  label: string;
  vendor: Vendor;
  color: string;
  tokens: number;
  /** Share of all tokens in the window, 0..1. */
  share: number;
};

// ── Detail: all-time views (models, hours, projects, time) ───────────────────

/** One model line in the all-time models chart and its list. */
export type ModelSeries = {
  model: string;
  label: string;
  vendor: Vendor;
  color: string;
  total: number;
  /** First and last day the model ran. */
  first: string;
  last: string;
};

/** Weekly tokens per stacked series (top models + 'other'), all time. */
export type ModelWeeks = {
  weeks: { start: string; partial: boolean; values: Record<string, number> }[];
  /** Stack order, bottom to top: vendor, then the order models arrived. */
  stack: ModelSeries[];
  /** Every model ever used, biggest first — the all-time list. */
  list: ModelSeries[];
};

/** Tokens per hour of the day for one week, per tool. Index 0 is the first
 *  hour of the work day (WORKDAY_START_HOUR), so late nights stay attached to
 *  the evening before instead of wrapping to the top. */
export type ClockWeek = { start: string; claude: number[]; codex: number[]; other: number[] };

/** One week of your time. `total` is deep-work hours (continuous activity,
 *  breaks under 15 minutes keep a stretch going — the Lifetime board's
 *  measure). It is split by which tools were running, in proportion to the
 *  clock hours each combination ran that week. */
export type ActiveWeek = {
  start: string;
  /** Calendar days the bucket covers so far (7 unless it is this week). */
  days: number;
  claudeOnly: number;
  codexOnly: number;
  both: number;
  other: number;
  total: number;
  /** Clock hours with any AI running (scheduled runs included). */
  running: number;
  partial: boolean;
};

/** One project's weekly tokens, split by tool. */
export type ProjectLane = {
  project: string;
  label: string;
  total: number;
  first: string;
  last: string;
  cells: { claude: number; codex: number; other: number }[];
};

export type ProjectLanes = {
  /** Monday of every week, oldest first. */
  weeks: string[];
  lanes: ProjectLane[];
  /** Largest single week of any shown project (dot-size scale). */
  maxCell: number;
  /** Everything not shown as a lane. */
  rest: { count: number; total: number };
};
