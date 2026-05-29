import { describe, it, expect } from 'vitest'
import { canSwitchTeam, isRecentDefector } from '@/lib/stats/team-switch'

const iso = (d: Date) => d.toISOString()
const daysAgo = (n: number, now: Date) => new Date(now.getTime() - n * 24 * 60 * 60 * 1000)

describe('canSwitchTeam', () => {
  const now = new Date('2026-05-29T12:00:00Z')
  it('allows when never switched (null)', () => {
    expect(canSwitchTeam(null, now)).toBe(true)
  })
  it('blocks when switched less than 30 days ago', () => {
    expect(canSwitchTeam(iso(daysAgo(10, now)), now)).toBe(false)
  })
  it('allows when switched 30+ days ago', () => {
    expect(canSwitchTeam(iso(daysAgo(31, now)), now)).toBe(true)
  })
  it('blocks exactly at 29 days, allows at 30', () => {
    expect(canSwitchTeam(iso(daysAgo(29, now)), now)).toBe(false)
    expect(canSwitchTeam(iso(daysAgo(30, now)), now)).toBe(true)
  })
})

describe('isRecentDefector', () => {
  const now = new Date('2026-05-29T12:00:00Z')
  it('true within the defector window (e.g. 14 days)', () => {
    expect(isRecentDefector(iso(daysAgo(3, now)), now)).toBe(true)
  })
  it('false when never switched', () => {
    expect(isRecentDefector(null, now)).toBe(false)
  })
  it('false once the window has passed', () => {
    expect(isRecentDefector(iso(daysAgo(20, now)), now)).toBe(false)
  })
})
