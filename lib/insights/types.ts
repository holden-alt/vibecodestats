import type { Database } from '@/lib/types/database';

// ── Raw row aliases (generated DB types) ────────────────────────────────────
export type ModelDailyRow = Database['public']['Tables']['llm_model_daily']['Row'];
export type ProjectModelDailyRow = Database['public']['Tables']['llm_project_model_daily']['Row'];
export type HourlyRow = Database['public']['Tables']['llm_hourly']['Row'];
export type SessionOutcomeRow = Database['public']['Tables']['session_outcomes']['Row'];
export type ProblemEventRow = Database['public']['Tables']['problem_events']['Row'];
export type SystemHealthRow = Database['public']['Tables']['system_health_daily']['Row'];

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

// Each source gets one terminal-palette accent. Anything unknown → dim.
export const SOURCE_COLOR: Record<string, string> = {
  'claude-code': 'var(--color-orange)',
  codex: 'var(--color-cyan)',
  grok: 'var(--color-green)',
  kimi: 'var(--color-magenta)',
};

// Model stacking palette (ordered; wraps for >7 models, last = dim "other").
export const MODEL_PALETTE = [
  'var(--color-orange)',
  'var(--color-cyan)',
  'var(--color-green)',
  'var(--color-magenta)',
  'var(--color-yellow)',
  'var(--color-blue)',
  'var(--color-red)',
] as const;

export const OTHER_COLOR = 'var(--color-dim)';

// ── Derived / serializable shapes passed to client components ────────────────

/** One point in the stacked model-mix trend. `models` maps model → total tokens that day. */
export type TrendPoint = {
  date: string;
  models: Record<string, number>;
};

/** Metadata about a model line in the trend (for color + source filtering + ordering). */
export type ModelMeta = {
  model: string;
  source: string;
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
