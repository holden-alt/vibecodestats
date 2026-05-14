import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';

describe('generated database types', () => {
  const path = resolve(__dirname, '../../lib/types/database.ts');
  it('file exists', () => {
    expect(existsSync(path)).toBe(true);
  });
  it('exports a Database type with users and daily_stats', () => {
    const src = readFileSync(path, 'utf8');
    expect(src).toMatch(/export\s+(type|interface)\s+Database/);
    expect(src).toMatch(/users:/);
    expect(src).toMatch(/daily_stats:/);
  });
  it('includes hourly_tokens on daily_stats and machine_daily_stats', () => {
    const src = readFileSync(path, 'utf8');
    const matches = src.match(/hourly_tokens/g);
    // 2 tables x 3 variants (Row/Insert/Update) = 6 occurrences
    expect(matches?.length).toBe(6);
  });
});
