// Tier distribution over a cohort. Runs computeTier for every all-time token
// total in the cohort and counts how many players land in each tier. The result
// is ALWAYS ordered S -> A -> B -> C -> D -> handcoder so the bar chart renders
// in a stable, top-down order regardless of the cohort contents.
//
// Pure: no DB, no React. Feed it Object.values(leaderboardData.allTimeByUser).

import { type Tier, computeTier } from '@/lib/stats/tier'

export interface TierBucket {
  tier: Tier
  count: number
}

// Fixed render order (best tier first). HANDCODER sits last as the floor.
export const TIER_ORDER: Tier[] = ['S', 'A', 'B', 'C', 'D', 'handcoder']

export function tierDistribution(cohortAllTime: number[]): TierBucket[] {
  const counts = new Map<Tier, number>(TIER_ORDER.map((t) => [t, 0]))
  for (const tokens of cohortAllTime) {
    // Each member is tiered against the WHOLE cohort (same cohort rankUsers /
    // the profile use), so the distribution matches every badge on the site.
    const { tier } = computeTier(tokens, cohortAllTime)
    counts.set(tier, (counts.get(tier) ?? 0) + 1)
  }
  return TIER_ORDER.map((tier) => ({ tier, count: counts.get(tier) ?? 0 }))
}
