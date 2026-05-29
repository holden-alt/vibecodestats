import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260529000018_lock_team_columns.sql'),
  'utf8',
)

describe('lock team columns migration', () => {
  it('revokes UPDATE on users from anon and authenticated', () => {
    expect(sql).toMatch(/revoke update on public\.users from anon/i)
    expect(sql).toMatch(/revoke update on public\.users from authenticated/i)
  })
  it('grants UPDATE back only on the two safe self-edit columns', () => {
    expect(sql).toMatch(/grant update \(private_project_names, ingest_token\) on public\.users to authenticated/i)
  })
  it('does NOT grant update on team or team_switched_at to authenticated', () => {
    // the only grant in the file must be the two-column allowlist (no team)
    expect(sql).not.toMatch(/grant update[^\n]*team/i)
  })
})
