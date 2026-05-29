import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260529000016_team_email_signup_events.sql'),
  'utf8',
)

describe('team/email/signup_events migration', () => {
  it('adds team, team_switched_at, email, email_opt_in to users', () => {
    expect(sql).toMatch(/alter table public\.users[\s\S]*add column if not exists team/i)
    expect(sql).toMatch(/team_switched_at/i)
    expect(sql).toMatch(/email_opt_in/i)
  })
  it('constrains team to claude_code | codex', () => {
    expect(sql).toMatch(/claude_code/i)
    expect(sql).toMatch(/codex/i)
  })
  it('creates the signup_events table with RLS', () => {
    expect(sql).toMatch(/create table if not exists public\.signup_events/i)
    expect(sql).toMatch(/enable row level security/i)
  })
})
