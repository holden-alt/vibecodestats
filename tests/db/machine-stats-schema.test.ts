import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('machine_daily_stats migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000002_machine_stats.sql'),
    'utf8',
  );
  it('creates public.machine_daily_stats with a (user_id, date, machine) primary key', () => {
    expect(sql).toMatch(/create table public\.machine_daily_stats/i);
    expect(sql).toMatch(/primary key\s*\(user_id, date, machine\)/i);
  });
  it('enables RLS and a public select policy', () => {
    expect(sql).toMatch(/alter table public\.machine_daily_stats enable row level security/i);
    expect(sql).toMatch(/machine_daily_stats_select_all/);
  });
});
