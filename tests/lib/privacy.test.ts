import { describe, it, expect } from 'vitest';
import { fuzzProjects } from '@/lib/stats/privacy';

// Minimal DailyStat shape for testing — only fields fuzzProjects cares about.
function makeStat(projects_touched: Record<string, number>) {
  return {
    user_id: 'u1',
    date: '2026-05-01',
    tokens_total: 0,
    tokens_by_model: {},
    sessions: 0,
    deep_work_minutes: 0,
    machines: [],
    projects_touched,
    ships: {},
    hourly_tokens: {},
    source_synced_at: null,
  };
}

describe('fuzzProjects', () => {
  it('ranks projects by total tokens descending (highest = project 1)', () => {
    const stats = [
      makeStat({ alpha: 100, beta: 300, gamma: 200 }),
    ];
    const fuzzed = fuzzProjects(stats);
    const keys = Object.keys(fuzzed[0]!.projects_touched as Record<string, number>);
    // beta (300) -> project 1, gamma (200) -> project 2, alpha (100) -> project 3
    expect(fuzzed[0]!.projects_touched).toEqual({
      'project 1': 300,
      'project 2': 200,
      'project 3': 100,
    });
    expect(keys).toHaveLength(3);
  });

  it('breaks ties alphabetically (a < b)', () => {
    const stats = [
      makeStat({ beta: 500, alpha: 500 }),
    ];
    const fuzzed = fuzzProjects(stats);
    // alpha and beta are tied at 500 — alpha comes first alphabetically -> project 1
    expect(fuzzed[0]!.projects_touched).toEqual({
      'project 1': 500,
      'project 2': 500,
    });
  });

  it('accumulates totals across multiple stat rows for ranking', () => {
    const stats = [
      makeStat({ alpha: 100 }),
      makeStat({ beta: 300 }),
      makeStat({ alpha: 50 }),
    ];
    const fuzzed = fuzzProjects(stats);
    // alpha total = 150, beta total = 300 -> beta = project 1, alpha = project 2
    const projects0 = fuzzed[0]!.projects_touched as Record<string, number>;
    const projects1 = fuzzed[1]!.projects_touched as Record<string, number>;
    const projects2 = fuzzed[2]!.projects_touched as Record<string, number>;
    expect(projects0['project 2']).toBe(100);
    expect(projects1['project 1']).toBe(300);
    expect(projects2['project 2']).toBe(50);
  });

  it('preserves token totals across all stats after fuzzing', () => {
    const stats = [
      makeStat({ alpha: 100, beta: 300 }),
      makeStat({ gamma: 50, alpha: 200 }),
    ];
    const originalTotal = stats.reduce((sum, s) => {
      return sum + Object.values(s.projects_touched).reduce((a, b) => a + b, 0);
    }, 0);
    const fuzzed = fuzzProjects(stats);
    const fuzzedTotal = fuzzed.reduce((sum, s) => {
      return sum + Object.values(s.projects_touched as Record<string, number>).reduce((a, b) => a + b, 0);
    }, 0);
    expect(fuzzedTotal).toBe(originalTotal);
  });

  it('real project names never appear in fuzzed output', () => {
    const stats = [
      makeStat({ 'my-secret-project': 500, 'another-repo': 100 }),
    ];
    const fuzzed = fuzzProjects(stats);
    const keys = Object.keys(fuzzed[0]!.projects_touched as Record<string, number>);
    expect(keys).not.toContain('my-secret-project');
    expect(keys).not.toContain('another-repo');
    for (const key of keys) {
      expect(key).toMatch(/^project \d+$/);
    }
  });

  it('handles empty projects_touched gracefully', () => {
    const stats = [makeStat({})];
    const fuzzed = fuzzProjects(stats);
    expect(fuzzed[0]!.projects_touched).toEqual({});
  });

  it('assigns the same label to a project consistently across rows', () => {
    const stats = [
      makeStat({ alpha: 200 }),
      makeStat({ alpha: 150 }),
    ];
    const fuzzed = fuzzProjects(stats);
    // alpha is the only project -> always project 1
    expect(fuzzed[0]!.projects_touched).toEqual({ 'project 1': 200 });
    expect(fuzzed[1]!.projects_touched).toEqual({ 'project 1': 150 });
  });
});
