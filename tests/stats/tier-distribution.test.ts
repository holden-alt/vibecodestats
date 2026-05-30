import { describe, it, expect } from 'vitest'
import { tierDistribution, TIER_ORDER, type TierBucket } from '@/lib/stats/tier-distribution'
import { computeTier, type Tier } from '@/lib/stats/tier'

const countFor = (buckets: TierBucket[], tier: Tier) =>
  buckets.find((b) => b.tier === tier)?.count ?? 0

describe('tierDistribution', () => {
  it('returns one bucket per tier in fixed S->handcoder order', () => {
    const buckets = tierDistribution([100, 50, 10])
    expect(buckets.map((b) => b.tier)).toEqual(TIER_ORDER)
    expect(buckets).toHaveLength(6)
  })

  it('counts sum to the cohort size', () => {
    const cohort = Array.from({ length: 100 }, (_, i) => 100 - i)
    const buckets = tierDistribution(cohort)
    const total = buckets.reduce((s, b) => s + b.count, 0)
    expect(total).toBe(cohort.length)
  })

  it('each member is counted in the same tier computeTier assigns it', () => {
    const cohort = Array.from({ length: 100 }, (_, i) => (100 - i) * 1_000_000)
    const expected = new Map<Tier, number>()
    for (const tokens of cohort) {
      const { tier } = computeTier(tokens, cohort)
      expected.set(tier, (expected.get(tier) ?? 0) + 1)
    }
    const buckets = tierDistribution(cohort)
    for (const tier of TIER_ORDER) {
      expect(countFor(buckets, tier)).toBe(expected.get(tier) ?? 0)
    }
  })

  it('puts zero-token players in the handcoder bucket', () => {
    const buckets = tierDistribution([1000, 500, 0, 0, 0])
    expect(countFor(buckets, 'handcoder')).toBe(3)
  })

  it('a 100-row linear cohort fills the S band with the top ~1%', () => {
    // dist = [100, 99, ..., 1]; only the single top value is strictly top 1%.
    const cohort = Array.from({ length: 100 }, (_, i) => 100 - i)
    const buckets = tierDistribution(cohort)
    expect(countFor(buckets, 'S')).toBe(1)
    // bottom 10% (ahead/100 >= 0.90 => value <= 10) are handcoders: values 1..10
    expect(countFor(buckets, 'handcoder')).toBe(10)
  })

  it('handles an empty cohort with all-zero buckets', () => {
    const buckets = tierDistribution([])
    expect(buckets.every((b) => b.count === 0)).toBe(true)
    expect(buckets.map((b) => b.tier)).toEqual(TIER_ORDER)
  })
})
