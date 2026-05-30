import { describe, it, expect } from 'vitest'
import {
  getTeamScoreboardMaps,
  getTeamScoreboardMapsAllTime,
} from '@/lib/stats/leaderboard-data'
import { campScoreboard } from '@/lib/stats/team'
import type { LeaderboardData } from '@/lib/stats/leaderboard'
import type { DailyStat } from '@/lib/stats/profile-data'

// Minimal DailyStat factory — only the fields these helpers read matter.
function row(date: string, byModel: Record<string, number> | null): DailyStat {
  return {
    user_id: 'x',
    date,
    tokens_total: 0,
    tokens_by_model: byModel,
    sessions: 0,
    deep_work_minutes: 0,
    machines: [],
    projects_touched: {},
    ships: {},
    hourly_tokens: {},
    source_synced_at: null,
  } as unknown as DailyStat
}

function data(statsByUser: Record<string, DailyStat[]>): LeaderboardData {
  return {
    users: [],
    statsByUser,
    groupMemberUserIds: [],
    friendUserIds: [],
    viewerGroups: [],
    allTimeByUser: {},
  }
}

describe('getTeamScoreboardMaps (daily, the scoreboard default)', () => {
  it('pulls only the requested day from each user, null when absent', () => {
    const d = data({
      u1: [row('2026-05-29', { 'claude-opus-4-8': 300 }), row('2026-05-28', { 'gpt-5': 999 })],
      u2: [row('2026-05-29', { 'gpt-5.3-codex': 200 })],
      u3: [row('2026-05-28', { 'claude-haiku-4-5': 50 })], // no row today
    })
    const maps = getTeamScoreboardMaps(d, '2026-05-29')
    expect(maps).toEqual([{ 'claude-opus-4-8': 300 }, { 'gpt-5.3-codex': 200 }, null])

    // The default daily view: today is 60/40 claude/codex and SWINGS by day.
    const sb = campScoreboard(maps)
    expect(sb.claudePct).toBe(60)
    expect(sb.codexPct).toBe(40)
    expect(sb.leader).toBe('claude_code')
  })

  it('produces a different split on a different day (it visibly changes)', () => {
    const d = data({
      u1: [row('2026-05-29', { 'claude-opus-4-8': 300 }), row('2026-05-28', { 'gpt-5': 900 })],
    })
    expect(campScoreboard(getTeamScoreboardMaps(d, '2026-05-29')).leader).toBe('claude_code')
    expect(campScoreboard(getTeamScoreboardMaps(d, '2026-05-28')).leader).toBe('codex')
  })
})

describe('getTeamScoreboardMapsAllTime (the toggle)', () => {
  it('merges every loaded row per user into one per-model total', () => {
    const d = data({
      u1: [
        row('2026-05-29', { 'claude-opus-4-8': 300 }),
        row('2026-05-28', { 'claude-opus-4-8': 200, 'gpt-5': 100 }),
      ],
      u2: [row('2026-05-29', { 'gpt-5.3-codex': 400 })],
    })
    const maps = getTeamScoreboardMapsAllTime(d)
    expect(maps).toEqual([
      { 'claude-opus-4-8': 500, 'gpt-5': 100 },
      { 'gpt-5.3-codex': 400 },
    ])
    // all-time: claude 500, codex 500 -> dead even
    const sb = campScoreboard(maps)
    expect(sb.claudePct).toBe(50)
    expect(sb.codexPct).toBe(50)
  })

  it('returns null for a user with no model data at all', () => {
    const d = data({ u1: [row('2026-05-29', null), row('2026-05-28', {})] })
    expect(getTeamScoreboardMapsAllTime(d)).toEqual([null])
  })
})
