import type { Database } from '@/lib/types/database';

// ── Raw row aliases (generated DB types) ────────────────────────────────────
export type ModelDailyRow = Database['public']['Tables']['llm_model_daily']['Row'];
export type ProjectModelDailyRow = Database['public']['Tables']['llm_project_model_daily']['Row'];
export type HourlyRow = Database['public']['Tables']['llm_hourly']['Row'];
export type RepoShipsRow = Database['public']['Tables']['repo_ships_daily']['Row'];

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

/** One row of the model-efficiency table over a window. */
export type EfficiencyRow = {
  source: string;
  model: string;
  tokens: number;
  turns: number;
  toolCalls: number;
  sessions: number;
  activeMinutes: number;
  cost: number | null;
  hasCost: boolean;
  // Shipped-work attribution (dominant-model heuristic):
  commits: number;
  insertions: number;
  // Derived rates:
  toolCallsPerTurn: number;
  commitsPerActiveHour: number;
  insertionsPerActiveHour: number;
  commitsPer100M: number;
  insertionsPer100M: number;
};

/** Pre-aggregated hourly cell: tokens for a (date, hour, source). */
export type HourlyAgg = {
  date: string;
  hour: number;
  source: string;
  tokens: number;
};

/** One project row in the project breakdown. */
export type ProjectRow = {
  project: string;
  tokens: number;
  turns: number;
  commits: number;
  insertions: number;
  // model mix within the project: model → tokens (already ordered desc)
  models: { model: string; source: string; tokens: number }[];
};

/** Today strip: per-source token + activity summary for the current local day. */
export type TodaySummary = {
  date: string;
  bySource: { source: string; tokens: number; activeMinutes: number }[];
  totalTokens: number;
  totalActiveMinutes: number;
  commits: number;
  insertions: number;
  cost: number | null;
};

export type WindowKey = '7d' | '30d' | '90d';
