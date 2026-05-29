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
  { tier: 'D', maxPercentile: Infinity },
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
  const band = BANDS.find((b) => percentile < b.maxPercentile) ?? BANDS[BANDS.length - 1]
  const topPercentLabel = Math.max(1, Math.ceil(percentile * 100))
  return { tier: band.tier, isHandcoder: false, rank, cohortSize, percentile, topPercentLabel }
}

export interface TierGap {
  nextTier: Tier | null
  tokensNeeded: number
}

export function gapToNextTier(allTimeTokens: number, allUsersAllTime: number[]): TierGap {
  const current = computeTier(allTimeTokens, allUsersAllTime)
  if (current.tier === 'S') return { nextTier: null, tokensNeeded: 0 }
  const order: Tier[] = ['handcoder', 'D', 'C', 'B', 'A', 'S']
  const nextTier = order[order.indexOf(current.tier) + 1] ?? null
  if (!nextTier) return { nextTier: null, tokensNeeded: 0 }
  const cohort = allUsersAllTime.filter((t) => t > 0).sort((a, b) => b - a)
  const cohortSize = cohort.length
  const nextBand = BANDS.find((b) => b.tier === nextTier)!
  const cutoffIndex = Math.max(0, Math.ceil(nextBand.maxPercentile * cohortSize) - 1)
  const threshold = cohort[Math.min(cutoffIndex, cohortSize - 1)] ?? 0
  return { nextTier, tokensNeeded: Math.max(0, threshold - allTimeTokens + 1) }
}
