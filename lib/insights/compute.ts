import {
  MODEL_PALETTE,
  OTHER_COLOR,
  type EfficiencyRow,
  type HourlyAgg,
  type HourlyRow,
  type ModelDailyRow,
  type ModelMeta,
  type ProjectModelDailyRow,
  type ProjectRow,
  type RepoShipsRow,
  type TodaySummary,
  type TrendPoint,
} from './types';

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

// ── Today strip ──────────────────────────────────────────────────────────────
export function buildTodaySummary(
  modelDaily: ModelDailyRow[],
  ships: RepoShipsRow[],
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

  const shipToday = ships.filter((s) => s.date === today);
  const commits = shipToday.reduce((acc, s) => acc + n(s.commits), 0);
  const insertions = shipToday.reduce((acc, s) => acc + n(s.insertions), 0);

  return {
    date: today,
    bySource,
    totalTokens: bySource.reduce((acc, s) => acc + s.tokens, 0),
    totalActiveMinutes: bySource.reduce((acc, s) => acc + s.activeMinutes, 0),
    commits,
    insertions,
    cost: hasCost ? cost : null,
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

// ── Shipped-work attribution (dominant-model heuristic) ───────────────────────
// For each (date, project) pick the (source, model) with the most tokens in
// llm_project_model_daily, then attribute that day-project's commits/insertions
// (from repo_ships_daily joined on repo === project) to that model.
export function attributeShips(
  projectModel: ProjectModelDailyRow[],
  ships: RepoShipsRow[],
  today: string,
  days: number,
): Map<string, { commits: number; insertions: number }> {
  const best = new Map<string, { source: string; model: string; tokens: number }>();
  for (const pm of projectModel) {
    if (!inWindow(pm.date, today, days)) continue;
    const key = pm.date + '|' + pm.project;
    const cur = best.get(key);
    const tok = n(pm.tokens_total);
    if (!cur || tok > cur.tokens) best.set(key, { source: pm.source, model: pm.model, tokens: tok });
  }

  const attr = new Map<string, { commits: number; insertions: number }>();
  for (const s of ships) {
    if (!inWindow(s.date, today, days)) continue;
    const dom = best.get(s.date + '|' + s.repo);
    if (!dom) continue; // no model activity recorded for that day-project → unattributable
    const mk = dom.source + '|' + dom.model;
    const cur = attr.get(mk) ?? { commits: 0, insertions: 0 };
    cur.commits += n(s.commits);
    cur.insertions += n(s.insertions);
    attr.set(mk, cur);
  }
  return attr;
}

// ── Model-efficiency table ────────────────────────────────────────────────────
export function buildEfficiencyRows(
  modelDaily: ModelDailyRow[],
  projectModel: ProjectModelDailyRow[],
  ships: RepoShipsRow[],
  today: string,
  days: number,
): EfficiencyRow[] {
  type Agg = {
    tokens: number;
    turns: number;
    toolCalls: number;
    sessions: number;
    activeMinutes: number;
    cost: number;
    hasCost: boolean;
  };
  const agg = new Map<string, Agg>();
  for (const r of modelDaily) {
    if (!inWindow(r.date, today, days)) continue;
    const key = r.source + '|' + r.model;
    const a =
      agg.get(key) ??
      { tokens: 0, turns: 0, toolCalls: 0, sessions: 0, activeMinutes: 0, cost: 0, hasCost: false };
    a.tokens += totalTokens(r);
    a.turns += n(r.turns);
    a.toolCalls += n(r.tool_calls);
    a.sessions += n(r.sessions);
    a.activeMinutes += n(r.active_minutes);
    if (r.cost_usd != null) {
      a.cost += n(r.cost_usd);
      a.hasCost = true;
    }
    agg.set(key, a);
  }

  const attr = attributeShips(projectModel, ships, today, days);

  const rows: EfficiencyRow[] = [...agg.entries()].map(([key, a]) => {
    const [source = '', model = ''] = key.split('|');
    const shipped = attr.get(key) ?? { commits: 0, insertions: 0 };
    const activeHours = a.activeMinutes / 60;
    const per100M = a.tokens / 100_000_000;
    return {
      source,
      model,
      tokens: a.tokens,
      turns: a.turns,
      toolCalls: a.toolCalls,
      sessions: a.sessions,
      activeMinutes: a.activeMinutes,
      cost: a.hasCost ? a.cost : null,
      hasCost: a.hasCost,
      commits: shipped.commits,
      insertions: shipped.insertions,
      toolCallsPerTurn: a.turns > 0 ? a.toolCalls / a.turns : 0,
      commitsPerActiveHour: activeHours > 0 ? shipped.commits / activeHours : 0,
      insertionsPerActiveHour: activeHours > 0 ? shipped.insertions / activeHours : 0,
      commitsPer100M: per100M > 0 ? shipped.commits / per100M : 0,
      insertionsPer100M: per100M > 0 ? shipped.insertions / per100M : 0,
    };
  });

  return rows.sort((a, b) => b.tokens - a.tokens);
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

// ── Project breakdown ─────────────────────────────────────────────────────────
export function buildProjectRows(
  projectModel: ProjectModelDailyRow[],
  ships: RepoShipsRow[],
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

  const shipsByRepo = new Map<string, { commits: number; insertions: number }>();
  for (const s of ships) {
    if (!inWindow(s.date, today, days)) continue;
    const cur = shipsByRepo.get(s.repo) ?? { commits: 0, insertions: 0 };
    cur.commits += n(s.commits);
    cur.insertions += n(s.insertions);
    shipsByRepo.set(s.repo, cur);
  }

  const rows: ProjectRow[] = [...byProject.entries()].map(([project, acc]) => {
    const shipped = shipsByRepo.get(project) ?? { commits: 0, insertions: 0 };
    const models = [...acc.models.entries()]
      .map(([model, v]) => ({ model, source: v.source, tokens: v.tokens }))
      .sort((a, b) => b.tokens - a.tokens);
    return {
      project,
      tokens: acc.tokens,
      turns: acc.turns,
      commits: shipped.commits,
      insertions: shipped.insertions,
      models,
    };
  });

  return rows.sort((a, b) => b.tokens - a.tokens);
}

// ── Insight callouts (rule-based, sample-size gated) ──────────────────────────
const MIN_ACTIVE_DAYS = 3;

function activeDayCountByModel(
  modelDaily: ModelDailyRow[],
  today: string,
  days: number,
): Map<string, number> {
  const daysByModel = new Map<string, Set<string>>();
  for (const r of modelDaily) {
    if (!inWindow(r.date, today, days)) continue;
    if (totalTokens(r) <= 0) continue;
    const set = daysByModel.get(r.model) ?? new Set<string>();
    set.add(r.date);
    daysByModel.set(r.model, set);
  }
  const out = new Map<string, number>();
  for (const [m, set] of daysByModel) out.set(m, set.size);
  return out;
}

export function buildCallouts(
  modelDaily: ModelDailyRow[],
  projectModel: ProjectModelDailyRow[],
  ships: RepoShipsRow[],
  hourlyAgg: HourlyAgg[],
  today: string,
): string[] {
  const out: string[] = [];

  // (1) Lines-per-Mtok contrast between the two heaviest models (14d).
  {
    const W = 14;
    const eff = buildEfficiencyRows(modelDaily, projectModel, ships, today, W);
    const activeDays = activeDayCountByModel(modelDaily, today, W);
    const linesPerMtok = (r: EfficiencyRow) =>
      r.tokens > 0 ? r.insertions / (r.tokens / 1_000_000) : 0;
    const cands = eff
      .filter((r) => (activeDays.get(r.model) ?? 0) >= MIN_ACTIVE_DAYS && r.insertions > 0)
      .slice(0, 4);
    if (cands.length >= 2) {
      const sorted = [...cands].sort((a, b) => linesPerMtok(b) - linesPerMtok(a));
      const hi = sorted[0]!;
      const lo = sorted[sorted.length - 1]!;
      const rHi = linesPerMtok(hi);
      const rLo = linesPerMtok(lo);
      if (rLo > 0 && rHi / rLo >= 1.2 && hi.model !== lo.model) {
        out.push(
          `${prettyModel(hi.model)} days ship ${(rHi / rLo).toFixed(1)}× more lines per Mtok than ${prettyModel(lo.model)} days (${W}d)`,
        );
      }
    }
  }

  // (2) Peak activity window (best rolling 3-hour block, 30d).
  {
    const W = 30;
    const byHour = new Array(24).fill(0);
    let anyHour = 0;
    for (const r of hourlyAgg) {
      if (!inWindow(r.date, today, W)) continue;
      byHour[r.hour] += r.tokens;
      if (r.tokens > 0) anyHour++;
    }
    const totalHourTokens = byHour.reduce((a: number, b: number) => a + b, 0);
    if (totalHourTokens > 0 && anyHour >= 5) {
      let bestStart = 0;
      let bestSum = -1;
      for (let h = 0; h < 24; h++) {
        const sum = byHour[h] + byHour[(h + 1) % 24] + byHour[(h + 2) % 24];
        if (sum > bestSum) {
          bestSum = sum;
          bestStart = h;
        }
      }
      out.push(`Peak activity window: ${fmtHour(bestStart)}–${fmtHour((bestStart + 3) % 24)} (30d)`);
    }
  }

  // (3) Biggest source week-over-week move.
  {
    const sums = new Map<string, { cur: number; prev: number }>();
    for (const r of modelDaily) {
      const inCur = inWindow(r.date, today, 7);
      const prevEnd = windowStart(today, 7); // day after prev window
      const inPrev = r.date < prevEnd && inWindow(r.date, today, 14);
      if (!inCur && !inPrev) continue;
      const s = sums.get(r.source) ?? { cur: 0, prev: 0 };
      if (inCur) s.cur += totalTokens(r);
      else if (inPrev) s.prev += totalTokens(r);
      sums.set(r.source, s);
    }
    let pick: { source: string; ratio: number } | null = null;
    for (const [source, s] of sums) {
      if (s.prev <= 0) continue;
      if (Math.max(s.cur, s.prev) < 1_000_000) continue;
      const ratio = (s.cur - s.prev) / s.prev;
      if (Math.abs(ratio) < 0.25) continue;
      if (!pick || Math.abs(ratio) > Math.abs(pick.ratio)) pick = { source, ratio };
    }
    if (pick) {
      const dir = pick.ratio >= 0 ? 'up' : 'down';
      out.push(
        `${SOURCE_LABEL_SAFE(pick.source)} usage ${dir} ${Math.abs(Math.round(pick.ratio * 100))}% w/w`,
      );
    }
  }

  // (4) Cache-read dominance (30d).
  {
    const W = 30;
    let cache = 0;
    let total = 0;
    for (const r of modelDaily) {
      if (!inWindow(r.date, today, W)) continue;
      cache += n(r.cache_read_tokens);
      total += totalTokens(r);
    }
    if (total > 0) {
      const share = cache / total;
      if (share >= 0.5) {
        out.push(`Cache reads are ${Math.round(share * 100)}% of all tokens processed (30d)`);
      }
    }
  }

  // (5) Most productive model by lines/active hour (30d).
  {
    const W = 30;
    const eff = buildEfficiencyRows(modelDaily, projectModel, ships, today, W);
    const cands = eff.filter((r) => r.activeMinutes >= 180 && r.insertions > 0);
    const top = [...cands].sort((a, b) => b.insertionsPerActiveHour - a.insertionsPerActiveHour)[0];
    if (top) {
      out.push(
        `${prettyModel(top.model)} ships the most: ${Math.round(top.insertionsPerActiveHour)} lines/active hour (30d)`,
      );
    }
  }

  return out.slice(0, 5);
}

function fmtHour(h: number): string {
  const suffix = h < 12 ? 'AM' : 'PM';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr} ${suffix}`;
}

// local mirror of SOURCE_LABEL to avoid a circular import surprise in tests
function SOURCE_LABEL_SAFE(source: string): string {
  const map: Record<string, string> = {
    'claude-code': 'Claude Code',
    codex: 'Codex',
    grok: 'Grok',
    kimi: 'Kimi',
  };
  return map[source] ?? source;
}
