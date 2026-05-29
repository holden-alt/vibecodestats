import { describe, it, expect } from 'vitest'
import { splitTokensByCamp, campScoreboard, type Camp } from '@/lib/stats/team'

describe('splitTokensByCamp', () => {
  it('routes gpt-* model tokens to codex and the rest to claude_code', () => {
    const r = splitTokensByCamp({ 'claude-opus-4-8': 900, 'gpt-5.3-codex': 100 })
    expect(r.codex).toBe(100)
    expect(r.claude).toBe(900)
  })

  it('treats any model id starting with gpt as codex, case-insensitively', () => {
    const r = splitTokensByCamp({ 'GPT-4.1': 50, 'gpt-5': 50, 'claude-haiku-4-5': 100 })
    expect(r.codex).toBe(100)
    expect(r.claude).toBe(100)
  })

  it('returns zeros for an empty/undefined map', () => {
    expect(splitTokensByCamp(undefined).codex).toBe(0)
    expect(splitTokensByCamp({}).claude).toBe(0)
  })
})

describe('campScoreboard', () => {
  it('aggregates camp token totals into swinging percentages', () => {
    const r = campScoreboard([
      { 'claude-opus-4-8': 580 },
      { 'gpt-5.3-codex': 420 },
    ])
    expect(r.claudePct).toBe(58)
    expect(r.codexPct).toBe(42)
    expect(r.leader).toBe<Camp>('claude_code')
  })

  it('ignores null entries in the maps array', () => {
    const r = campScoreboard([null, { 'gpt-4': 100 }])
    expect(r.codex).toBe(100)
    expect(r.claude).toBe(0)
  })

  it('defaults to a 50/50 draw when there are no tokens', () => {
    const r = campScoreboard([])
    expect(r.claudePct).toBe(50)
    expect(r.codexPct).toBe(50)
    expect(r.leader).toBe('claude_code')
  })
})
