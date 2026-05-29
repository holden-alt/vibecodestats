import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const sql = readFileSync(
  join(process.cwd(), 'supabase/migrations/20260529000017_user_private.sql'),
  'utf8',
)

describe('user_private migration', () => {
  it('creates user_private keyed to users.id with cascade delete', () => {
    expect(sql).toMatch(/create table if not exists public\.user_private/i)
    expect(sql).toMatch(/references public\.users\(id\) on delete cascade/i)
  })
  it('has email + email_opt_in (default false) columns', () => {
    expect(sql).toMatch(/email text/i)
    expect(sql).toMatch(/email_opt_in boolean not null default false/i)
  })
  it('enables RLS with an OWNER-ONLY select policy (not public read)', () => {
    expect(sql).toMatch(/enable row level security/i)
    expect(sql).toMatch(/auth\.uid\(\)/i)
    expect(sql).not.toMatch(/using \(true\)/i)
  })
})
