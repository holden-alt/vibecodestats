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
    // dist = [100, 99, 98, ..., 1]. ahead = count of values strictly > me.
    expect(computeTier(100, dist).tier).toBe<Tier>('S')         // ahead 0  → 0.00 < 0.01 → S
    expect(computeTier(95, dist).tier).toBe<Tier>('A')          // ahead 5  → 0.05 < 0.10 → A
    expect(computeTier(70, dist).tier).toBe<Tier>('B')          // ahead 30 → 0.30 < 0.40 → B
    expect(computeTier(40, dist).tier).toBe<Tier>('C')          // ahead 60 → 0.60 < 0.75 → C
    expect(computeTier(20, dist).tier).toBe<Tier>('D')          // ahead 80 → 0.80 < 0.90 → D
    expect(computeTier(10, dist).tier).toBe<Tier>('handcoder')  // ahead 90 → 0.90 >= 0.90 → handcoder (bottom 10%)
    expect(computeTier(5, dist).tier).toBe<Tier>('handcoder')   // ahead 95 → 0.95 >= 0.90 → handcoder
  })

  it('labels an active bottom-10% user handcoder but still ranks them', () => {
    const dist = Array.from({ length: 100 }, (_, i) => 100 - i)
    const r = computeTier(5, dist) // ahead 95 -> 0.95 -> bottom 10%
    expect(r.tier).toBe<Tier>('handcoder')
    expect(r.isHandcoder).toBe(true)
    expect(r.rank).toBe(96)        // 95 ahead + 1
    expect(r.cohortSize).toBe(100) // still ranked within the full active cohort
  })

  it('excludes zero-token (handcoder) users from the ranked cohort', () => {
    const dist = [100, 50, 0, 0, 0]
    const r = computeTier(50, dist)
    expect(r.cohortSize).toBe(2)
    expect(r.rank).toBe(2)
  })

  it('treats a sole user with no cohort as S (top of an empty field)', () => {
    const r = computeTier(500, [])
    expect(r.tier).toBe<Tier>('S')
    expect(r.cohortSize).toBe(0)
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

  it('gives a zero-token handcoder a gap that lands them in a real (non-handcoder) tier', () => {
    const dist = [1000, 500, 100]
    const g = gapToNextTier(0, dist)
    expect(g.nextTier).not.toBeNull()
    expect(g.nextTier).not.toBe<Tier>('handcoder')
    expect(computeTier(0 + g.tokensNeeded, dist).tier).toBe(g.nextTier) // round-trip holds
  })

  it('round-trip invariant: adding tokensNeeded lands you exactly in nextTier (all cohort sizes)', () => {
    const cohorts: number[][] = [
      [100, 50, 10, 1],                                            // n=4 (collapsed bands)
      Array.from({ length: 6 }, (_, i) => (6 - i) * 1_000_000),    // n=6
      Array.from({ length: 100 }, (_, i) => (100 - i) * 1_000_000),// n=100
    ]
    for (const dist of cohorts) {
      for (const me of dist) {
        const g = gapToNextTier(me, dist)
        if (g.nextTier === null) continue
        const landed = computeTier(me + g.tokensNeeded, dist).tier
        expect(landed).toBe(g.nextTier)
      }
    }
  })
})
