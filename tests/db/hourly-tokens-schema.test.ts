import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('hourly_tokens migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000004_hourly_tokens.sql'),
    'utf8',
  );

  it('adds hourly_tokens to daily_stats', () => {
    expect(sql).toMatch(/alter table public\.daily_stats\s+add column hourly_tokens jsonb/i);
  });

  it('adds hourly_tokens to machine_daily_stats', () => {
    expect(sql).toMatch(/alter table public\.machine_daily_stats\s+add column hourly_tokens jsonb/i);
  });

  it('defaults hourly_tokens to an empty object and is not null', () => {
    const matches = sql.match(/hourly_tokens jsonb not null default '\{\}'::jsonb/gi);
    expect(matches?.length).toBe(2);
  });
});
