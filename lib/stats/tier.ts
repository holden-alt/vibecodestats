// Pure percentile tier system. Tier is computed from all-time tokens vs the
// ACTIVE cohort (users with > 0 all-time tokens). Zero-token users are
// handcoders and are excluded from the cohort percentile.

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'handcoder'

export interface TierResult {
  tier: Tier
  isHandcoder: boolean
  rank: number
  cohortSize: number
  percentile: number      // fraction of cohort STRICTLY ahead of you (0 = #1)
  topPercentLabel: number // ceil(percentile*100), min 1 (1 = "top 1%")
}

const BANDS: { tier: Exclude<Tier, 'handcoder'>; maxPercentile: number }[] = [
  { tier: 'S', maxPercentile: 0.01 },
  { tier: 'A', maxPercentile: 0.10 },
  { tier: 'B', maxPercentile: 0.40 },
  { tier: 'C', maxPercentile: 0.75 },
  { tier: 'D', maxPercentile: 0.90 },
]

export function computeTier(allTimeTokens: number, allUsersAllTime: number[]): TierResult {
  if (!(allTimeTokens > 0)) {
    return { tier: 'handcoder', isHandcoder: true, rank: 0, cohortSize: 0, percentile: 1, topPercentLabel: 100 }
  }
  const cohort = allUsersAllTime.filter((t) => t > 0)
  const cohortSize = cohort.length
  const ahead = cohort.filter((t) => t > allTimeTokens).length
  const rank = ahead + 1
  const percentile = cohortSize > 0 ? ahead / cohortSize : 0
  // Empty cohort yields percentile 0 (sole user = S).
  // No band match means percentile >= 0.90 => bottom 10% of field => handcoder.
  const band = BANDS.find((b) => percentile < b.maxPercentile)
  const tier: Tier = band ? band.tier : 'handcoder' // percentile >= 0.90 => bottom 10% => handcoder
  const isHandcoder = tier === 'handcoder'
  const topPercentLabel = Math.max(1, Math.ceil(percentile * 100))
  return { tier, isHandcoder, rank, cohortSize, percentile, topPercentLabel }
}

export interface TierGap {
  nextTier: Tier | null
  tokensNeeded: number
}

export function gapToNextTier(allTimeTokens: number, allUsersAllTime: number[]): TierGap {
  const current = computeTier(allTimeTokens, allUsersAllTime)
  if (current.tier === 'S') return { nextTier: null, tokensNeeded: 0 }
  // Walk past the nearest competitors one at a time until your tier actually
  // changes. Computing the resulting tier via computeTier guarantees the
  // round-trip invariant (allTimeTokens + tokensNeeded actually lands in nextTier)
  // regardless of cohort size or band collapse.
  const ahead = allUsersAllTime
    .filter((t) => t > allTimeTokens)
    .sort((a, b) => a - b) // nearest competitor first
  for (const competitor of ahead) {
    const needed = competitor - allTimeTokens + 1
    const newTier = computeTier(allTimeTokens + needed, allUsersAllTime).tier
    if (newTier !== current.tier) return { nextTier: newTier, tokensNeeded: needed }
  }
  // No distinct higher tier is achievable in this cohort (e.g. tiny field).
  return { nextTier: null, tokensNeeded: 0 }
}
