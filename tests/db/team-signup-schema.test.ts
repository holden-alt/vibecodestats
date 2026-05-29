import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260529000016_team_and_signup_lockdown.sql'),
  'utf8',
)

describe('team + signup_events lockdown migration', () => {
  it('adds team + team_switched_at to users', () => {
    expect(sql).toMatch(/alter table public\.users[\s\S]*add column if not exists team/i)
    expect(sql).toMatch(/team_switched_at/i)
  })
  it('constrains team to claude_code | codex', () => {
    expect(sql).toMatch(/claude_code/i)
    expect(sql).toMatch(/codex/i)
  })
  it('does NOT add contact-PII (email) columns — deferred to Phase 3 private storage', () => {
    expect(sql).not.toMatch(/email/i)
  })
  it('locks down signup_events: RLS enabled, NO public read policy', () => {
    expect(sql).toMatch(/create table if not exists public\.signup_events/i)
    expect(sql).toMatch(/enable row level security/i)
    // no permissive policy left on the table
    expect(sql).not.toMatch(/create policy[\s\S]*signup_events/i)
    expect(sql).toMatch(/revoke select on public\.signup_events from anon/i)
  })
})
