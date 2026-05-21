import type { DailyStat } from '@/lib/stats/profile-data';

/**
 * Stable map: real project name -> "project N" label, ranked by total tokens
 * across all dailyStats (highest = project 1). Tie-broken alphabetically.
 */
function buildLabelMap(stats: DailyStat[]): Map<string, string> {
  const totals = new Map<string, number>();
  for (const s of stats) {
    const projects = (s.projects_touched ?? {}) as Record<string, number>;
    for (const [k, v] of Object.entries(projects)) {
      totals.set(k, (totals.get(k) ?? 0) + (Number(v) || 0));
    }
  }
  const sorted = [...totals.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  const map = new Map<string, string>();
  sorted.forEach(([name], i) => map.set(name, `project ${i + 1}`));
  return map;
}

function rewriteProjects(
  projects: Record<string, number> | null | undefined,
  labelMap: Map<string, string>,
): Record<string, number> {
  if (!projects) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(projects)) {
    const label = labelMap.get(k) ?? k;
    out[label] = (out[label] ?? 0) + (Number(v) || 0);
  }
  return out;
}

export function fuzzProjects<S extends { projects_touched: unknown }>(
  stats: S[],
): S[] {
  const labelMap = buildLabelMap(stats as unknown as DailyStat[]);
  return stats.map((s) => ({
    ...s,
    projects_touched: rewriteProjects(
      s.projects_touched as Record<string, number>,
      labelMap,
    ),
  }));
}
