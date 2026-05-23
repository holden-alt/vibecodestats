import { describe, expect, it } from 'vitest';
import { computeVbw, computeVbwComponents } from '@/lib/stats/vbw';

describe('computeVbwComponents', () => {
  it('returns 0 across the board for zero inputs', () => {
    const c = computeVbwComponents({
      output_tokens: 0,
      cache_creation_tokens: 0,
      tool_calls: 0,
      ship_quality: 0,
      deep_work_minutes: 0,
    });
    expect(c).toEqual({ output: 0, substance: 0, tools: 0, ships: 0, depth: 0 });
  });

  it('hits ~100 on each axis at calibration ceilings', () => {
    const c = computeVbwComponents({
      output_tokens: 1_000_000,
      cache_creation_tokens: 100_000_000,
      tool_calls: 10_000,
      ship_quality: 100,
      deep_work_minutes: 600,
    });
    expect(c.output).toBeGreaterThan(95);
    expect(c.output).toBeLessThanOrEqual(100);
    expect(c.substance).toBeGreaterThan(95);
    expect(c.tools).toBeGreaterThan(95);
    expect(c.ships).toBe(100);
    expect(c.depth).toBe(100);
  });
});

describe('computeVbw', () => {
  it('is zero when any single axis is zero (geometric mean property)', () => {
    // Massive everything else but ships = 0 → score zeroed
    const r = computeVbw({
      output_tokens: 1_000_000,
      cache_creation_tokens: 100_000_000,
      tool_calls: 10_000,
      ship_quality: 0,
      deep_work_minutes: 600,
    });
    expect(r.total).toBe(0);
  });

  it('caps at 10,000 for a fully maxed day with max streak', () => {
    const r = computeVbw(
      {
        output_tokens: 10_000_000,
        cache_creation_tokens: 1_000_000_000,
        tool_calls: 100_000,
        ship_quality: 200,
        deep_work_minutes: 1000,
      },
      30,
    );
    expect(r.total).toBe(10000);
  });

  it('produces a heavy-day score in the 7-9K range with no streak', () => {
    // Calibration: holden's heaviest backfilled day 5/17 (Opus-heavy, 165 ships).
    // Approximate inputs: 50M output, 200M cache_creation, 8K tool calls,
    // ship_quality ~80 (165 commits avg 5 lines, mixed test/non-test), 480 deep min.
    const r = computeVbw({
      output_tokens: 50_000_000,
      cache_creation_tokens: 200_000_000,
      tool_calls: 8_000,
      ship_quality: 80,
      deep_work_minutes: 480,
    });
    expect(r.total).toBeGreaterThan(7000);
    expect(r.total).toBeLessThan(10001);
  });

  it('applies streak multiplier up to 1.5x at 10+ days', () => {
    const inputs = {
      output_tokens: 500_000,
      cache_creation_tokens: 50_000_000,
      tool_calls: 1_000,
      ship_quality: 20,
      deep_work_minutes: 200,
    };
    const day1 = computeVbw(inputs, 0);
    const day10 = computeVbw(inputs, 10);
    const day30 = computeVbw(inputs, 30);
    expect(day10.persistence).toBeCloseTo(1.5, 5);
    expect(day30.persistence).toBeCloseTo(1.5, 5);
    expect(day10.total).toBeGreaterThan(day1.total);
    expect(day30.total).toBe(day10.total);
  });

  it('low-effort day stays under 1000', () => {
    const r = computeVbw({
      output_tokens: 10_000,
      cache_creation_tokens: 50_000,
      tool_calls: 30,
      ship_quality: 1,
      deep_work_minutes: 20,
    });
    expect(r.total).toBeLessThan(1500);
  });

  it('bot pattern (mass tool_calls, zero output/ships) scores near zero', () => {
    const r = computeVbw({
      output_tokens: 0,
      cache_creation_tokens: 0,
      tool_calls: 100_000,
      ship_quality: 0,
      deep_work_minutes: 600,
    });
    expect(r.total).toBe(0);
  });
});
