import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(join(process.cwd(), 'd1/migrations/0001_initial.sql'), 'utf8');

describe('D1 production schema', () => {
  it('contains every imported application table', () => {
    for (const table of [
      'users',
      'daily_stats',
      'machine_daily_stats',
      'groups',
      'group_members',
      'friendships',
      'signup_events',
      'ingest_events',
      'user_private',
      'dim_anchor',
      'user_dim_baseline',
      'user_intraday_share',
      'llm_model_daily',
      'llm_project_model_daily',
      'llm_hourly',
      'repo_ships_daily',
      'session_outcomes',
      'problem_events',
      'system_health_daily',
    ]) {
      expect(schema).toMatch(new RegExp(`CREATE TABLE ${table} \\(`));
    }
  });

  it('keeps the core idempotency keys', () => {
    expect(schema).toContain('PRIMARY KEY (user_id, date, machine)');
    expect(schema).toContain('PRIMARY KEY (date, source, model)');
    expect(schema).toContain('PRIMARY KEY (date, project, source, model)');
    expect(schema).toContain('PRIMARY KEY (date, hour, source, model)');
    expect(schema).toContain('PRIMARY KEY (date, system)');
  });

  it('owns sessions directly at the edge', () => {
    expect(schema).toContain('CREATE TABLE auth_sessions');
    expect(schema).toContain('token_hash TEXT PRIMARY KEY');
    expect(schema).toContain('expires_at TEXT NOT NULL');
  });
});
