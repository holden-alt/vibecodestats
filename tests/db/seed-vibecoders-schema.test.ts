import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('seed_vibecoders migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000007_seed_vibecoders.sql'),
    'utf8',
  );

  it('inserts the five demo vibecoders with null auth_id', () => {
    for (const handle of ['mira-builds', 'devon-ships', 'kai-nightowl', 'sam-opus', 'jordan-rapid']) {
      expect(sql).toContain(handle);
    }
    expect(sql).toMatch(/insert into public\.users/i);
  });

  it('generates daily_stats for the seed users', () => {
    expect(sql).toMatch(/insert into public\.daily_stats/i);
    expect(sql).toMatch(/generate_series/i);
  });

  it('creates the default group and adds Holden plus the squad', () => {
    expect(sql).toMatch(/insert into public\.groups/i);
    expect(sql).toMatch(/'default'/);
    expect(sql).toMatch(/insert into public\.group_members/i);
    expect(sql).toMatch(/github_handle = 'holden-alt'/);
  });

  it('creates friendships between Holden and two of the squad', () => {
    expect(sql).toMatch(/insert into public\.friendships/i);
  });
});
