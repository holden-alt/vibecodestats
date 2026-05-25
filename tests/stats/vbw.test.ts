import { describe, expect, it } from 'vitest';
import { computeVbw, computeVbwComponents, DEFAULT_ANCHORS } from '@/lib/stats/vbw';

describe('computeVbwComponents (sigmoid)', () => {
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

  it('scores 50 at each dimension anchor (sigmoid midpoint)', () => {
    // log10(raw + 1) = anchor → score = 100/(1+e^0) = 50
    // For output anchor=6 → raw such that log10(raw+1)=6 → raw = 999999
    // For substance anchor=7 → raw = 9999999
    // For tools anchor=3 → raw = 999
    // For ships anchor=1.7 → raw such that log10(raw+1)=1.7 → raw ≈ 49.12
    // For depth anchor=2.5 → raw ≈ 315.23
    const c = computeVbwComponents({
      output_tokens: 999_999,
      cache_creation_tokens: 9_999_999,
      tool_calls: 999,
      ship_quality: 49.12,
      deep_work_minutes: 315.23,
    });
    expect(c.output).toBeCloseTo(50, 0);
    expect(c.substance).toBeCloseTo(50, 0);
    expect(c.tools).toBeCloseTo(50, 0);
    expect(c.ships).toBeCloseTo(50, 0);
    expect(c.depth).toBeCloseTo(50, 0);
  });

  it('saturates near 100 only for truly outsized days', () => {
    const c = computeVbwComponents({
      output_tokens: 100_000_000,        // 100× anchor
      cache_creation_tokens: 1_000_000_000,
      tool_calls: 50_000,
      ship_quality: 5_000,                // ship_quality is small-valued; need very high
      deep_work_minutes: 5_000,           // 83 hrs — only an outlier day
    });
    expect(c.output).toBeGreaterThan(90);
    expect(c.substance).toBeGreaterThan(90);
    expect(c.tools).toBeGreaterThan(90);
    expect(c.ships).toBeGreaterThan(90);
    expect(c.depth).toBeGreaterThan(80);  // depth is physically bounded — 5000 min = 83hrs
  });

  it('discriminates between heavy days at different scales (no v1 saturation)', () => {
    const heavy = computeVbwComponents({
      output_tokens: 5_000_000,
      cache_creation_tokens: 50_000_000,
      tool_calls: 5_000,
      ship_quality: 100,
      deep_work_minutes: 480,
    });
    const heavier = computeVbwComponents({
      output_tokens: 50_000_000,
      cache_creation_tokens: 200_000_000,
      tool_calls: 15_000,
      ship_quality: 300,
      deep_work_minutes: 600,
    });
    // v1 would saturate both to 95-100 on output/substance/tools.
    // v2 should keep meaningful spread.
    expect(heavier.output).toBeGreaterThan(heavy.output + 5);
    expect(heavier.substance).toBeGreaterThan(heavy.substance + 5);
    expect(heavier.tools).toBeGreaterThan(heavy.tools + 5);
  });
});

describe('computeVbw (aggregation)', () => {
  it('a research-only day with zero commits still scores meaningfully (no one-zero-kill)', () => {
    // v1 bug: this day = 0 because ships=0 zeroed the geometric mean.
    // v2: weighted-additive + soft penalty + diversity. Should be ~3-5K.
    const r = computeVbw({
      output_tokens: 1_500_000,
      cache_creation_tokens: 12_000_000,
      tool_calls: 1_500,
      ship_quality: 0,
      deep_work_minutes: 500,
    });
    expect(r.total).toBeGreaterThan(2000);
    expect(r.total).toBeLessThan(6000);
    expect(r.components.ships).toBe(0);
  });

  it('caps at 10,000 for an outsized day with max streak', () => {
    // To hit the 10K cap, every dimension has to push 95+. With the new sigmoid
    // anchors, that requires genuinely extreme inputs — by design (Holden:
    // "the only person with a perfect score should be the person who's had the
    // best stats"). v1's frequent 10K caps were artifacts of saturation.
    const r = computeVbw(
      {
        output_tokens: 1_000_000_000,
        cache_creation_tokens: 10_000_000_000,
        tool_calls: 500_000,
        ship_quality: 50_000,
        deep_work_minutes: 50_000,
      },
      30,
    );
    expect(r.total).toBe(10000);
  });

  it('a typical heavy day scores in the 5–8K range with no streak', () => {
    // Approximating Holden's typical heavy day from his 14-day data:
    // 200M tokens, 12M cache_creation, 1.5K tool calls, ship_quality 100, 500 deep min.
    const r = computeVbw({
      output_tokens: 1_500_000,
      cache_creation_tokens: 12_000_000,
      tool_calls: 1_500,
      ship_quality: 100,
      deep_work_minutes: 500,
    });
    expect(r.total).toBeGreaterThan(4000);
    expect(r.total).toBeLessThan(8500);
  });

  it('applies streak multiplier up to 1.05x at 10+ days (gentle)', () => {
    const inputs = {
      output_tokens: 1_000_000,
      cache_creation_tokens: 10_000_000,
      tool_calls: 1_000,
      ship_quality: 50,
      deep_work_minutes: 300,
    };
    const day1 = computeVbw(inputs, 0);
    const day10 = computeVbw(inputs, 10);
    const day30 = computeVbw(inputs, 30);
    expect(day10.persistence).toBeCloseTo(1.05, 5);
    expect(day30.persistence).toBeCloseTo(1.05, 5);
    expect(day10.total).toBeGreaterThan(day1.total);
    expect(day30.total).toBe(day10.total);
  });

  it('low-effort day stays under 1500', () => {
    const r = computeVbw({
      output_tokens: 100_000,
      cache_creation_tokens: 500_000,
      tool_calls: 50,
      ship_quality: 2,
      deep_work_minutes: 30,
    });
    expect(r.total).toBeLessThan(1500);
  });

  it('bot pattern (tool spam, zero output/ships) scores well below a real heavy day', () => {
    const bot = computeVbw({
      output_tokens: 0,
      cache_creation_tokens: 0,
      tool_calls: 100_000,
      ship_quality: 0,
      deep_work_minutes: 600,
    });
    const real = computeVbw({
      output_tokens: 1_500_000,
      cache_creation_tokens: 12_000_000,
      tool_calls: 1_500,
      ship_quality: 100,
      deep_work_minutes: 500,
    });
    // Bot doesn't have to be 0 (we replaced one-zero-kill with soft penalty)
    // but it MUST score well below a real day. Diversity floor + soft penalty
    // multiply to drag it down even though tools=100 and depth>80.
    expect(bot.total).toBeLessThan(real.total / 2);
  });

  it('diversity multiplier rewards balance over extremes', () => {
    // Same total raw work, different distribution.
    const balanced = computeVbw({
      output_tokens: 1_000_000,
      cache_creation_tokens: 10_000_000,
      tool_calls: 1_000,
      ship_quality: 50,
      deep_work_minutes: 300,
    });
    const lopsided = computeVbw({
      output_tokens: 100_000_000,    // saturated
      cache_creation_tokens: 0,
      tool_calls: 0,
      ship_quality: 0,
      deep_work_minutes: 0,
    });
    expect(balanced.diversity).toBeGreaterThan(lopsided.diversity);
    expect(balanced.total).toBeGreaterThan(lopsided.total);
  });

  it('soft penalty kicks in for each dimension below 20', () => {
    // 4 dims at 50, 1 dim below 20
    const oneLow = computeVbw({
      output_tokens: 1_000_000,
      cache_creation_tokens: 10_000_000,
      tool_calls: 1_000,
      ship_quality: 50,
      deep_work_minutes: 15,        // ~16 score (below 20)
    });
    // 4 dims at 50, 2 dims below 20
    const twoLow = computeVbw({
      output_tokens: 1_000_000,
      cache_creation_tokens: 10_000_000,
      tool_calls: 1_000,
      ship_quality: 2,              // ~14 score
      deep_work_minutes: 15,
    });
    expect(oneLow.penalty).toBeCloseTo(0.94, 5);
    expect(twoLow.penalty).toBeCloseTo(0.94 * 0.94, 5);
  });

  it('honors passed-in anchors over defaults', () => {
    const tighter = computeVbw(
      {
        output_tokens: 1_000_000,
        cache_creation_tokens: 10_000_000,
        tool_calls: 1_000,
        ship_quality: 50,
        deep_work_minutes: 300,
      },
      0,
      {
        // Move all anchors down → same inputs score higher
        output:    { anchor: 4.0, k: 1.2 },
        substance: { anchor: 5.0, k: 1.5 },
        tools:     { anchor: 1.5, k: 1.5 },
        ships:     { anchor: 0.5, k: 1.5 },
        depth:     { anchor: 1.5, k: 1.3 },
      },
    );
    const baseline = computeVbw(
      {
        output_tokens: 1_000_000,
        cache_creation_tokens: 10_000_000,
        tool_calls: 1_000,
        ship_quality: 50,
        deep_work_minutes: 300,
      },
      0,
      DEFAULT_ANCHORS,
    );
    expect(tighter.total).toBeGreaterThan(baseline.total);
  });
});
