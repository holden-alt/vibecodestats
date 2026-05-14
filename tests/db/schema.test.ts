import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('initial schema migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260513000001_initial_schema.sql'),
    'utf8',
  );
  it('creates public.users with required columns', () => {
    expect(sql).toMatch(/create table public\.users/i);
    expect(sql).toMatch(/github_id/);
    expect(sql).toMatch(/github_handle/);
    expect(sql).toMatch(/display_name/);
  });
  it('creates public.daily_stats with composite primary key', () => {
    expect(sql).toMatch(/create table public\.daily_stats/i);
    expect(sql).toMatch(/primary key\s*\(user_id, date\)/i);
    expect(sql).toMatch(/tokens_total/);
    expect(sql).toMatch(/tokens_by_model/);
  });
  it('enables RLS on both tables', () => {
    expect(sql).toMatch(/alter table public\.users enable row level security/i);
    expect(sql).toMatch(/alter table public\.daily_stats enable row level security/i);
  });
});
