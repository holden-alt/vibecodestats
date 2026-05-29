import { describe, it, expect } from 'vitest'
import { computeTier, gapToNextTier, type Tier } from '@/lib/stats/tier'

// cohort = all-time token totals of every user WITH tokens, any order.
const cohort = (n: number, top: number[]) => {
  const filler = Array.from({ length: Math.max(0, n - top.length) }, () => 1)
  return top.concat(filler)
}

describe('computeTier', () => {
  it('puts a zero-token user in handcoder regardless of cohort', () => {
    const r = computeTier(0, cohort(100, [9e9]))
    expect(r.tier).toBe<Tier>('handcoder')
    expect(r.isHandcoder).toBe(true)
  })

  it('ranks the single highest all-time user as S (top 1%)', () => {
    const dist = cohort(200, [4_840_000_000])
    const r = computeTier(4_840_000_000, dist)
    expect(r.tier).toBe<Tier>('S')
    expect(r.rank).toBe(1)
    expect(r.percentile).toBeCloseTo(0, 5)
  })

  it('assigns bands by fraction of cohort ahead of you', () => {
    const dist = Array.from({ length: 100 }, (_, i) => 100 - i)
    expect(computeTier(100, dist).tier).toBe<Tier>('S')
    expect(computeTier(95, dist).tier).toBe<Tier>('A')
    expect(computeTier(70, dist).tier).toBe<Tier>('B')
    expect(computeTier(40, dist).tier).toBe<Tier>('C')
    expect(computeTier(10, dist).tier).toBe<Tier>('D')
  })

  it('excludes zero-token (handcoder) users from the ranked cohort', () => {
    const dist = [100, 50, 0, 0, 0]
    const r = computeTier(50, dist)
    expect(r.cohortSize).toBe(2)
    expect(r.rank).toBe(2)
  })
})

describe('gapToNextTier', () => {
  it('returns tokens needed to reach the next tier up', () => {
    const dist = Array.from({ length: 100 }, (_, i) => (100 - i) * 1_000_000)
    const g = gapToNextTier(70_000_000, dist)
    expect(g.nextTier).toBe<Tier>('A')
    expect(g.tokensNeeded).toBeGreaterThan(0)
  })

  it('returns null nextTier for an S-tier user (already the ceiling)', () => {
    const dist = Array.from({ length: 100 }, (_, i) => 100 - i)
    expect(gapToNextTier(100, dist).nextTier).toBeNull()
  })
})
