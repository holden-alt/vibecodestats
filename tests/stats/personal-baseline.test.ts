import { describe, expect, it } from 'vitest';
import { computeBaseline, personalPercentile, percentileVsYou } from '@/lib/stats/personal-baseline';

describe('personal baseline scoring', () => {
  it('with no history, today equals prior → ~P50', () => {
    // No window, only prior. raw value at the prior median should be ~P50.
    // For output dim, prior m0=6.0 → raw=10^6=1M.
    const baseline = computeBaseline([], 'output');
    expect(baseline.n).toBe(0);
    expect(personalPercentile(1_000_000, baseline)).toBeGreaterThan(45);
    expect(personalPercentile(1_000_000, baseline)).toBeLessThan(55);
  });

  it('after observing 14 typical heavy days, an in-line day is ~P50', () => {
    // Simulate Holden's actual output_tokens over 14 days (rough range).
    const window = [549_428, 951_084, 272_666, 369_227, 1_049_237, 84_696, 1_298_482, 2_117_605, 1_855_259, 1_317_057, 1_862_679, 843_587, 737_169, 194_754];
    const median_val = 815_378; // a value close to the median
    const { p, baseline } = percentileVsYou(median_val, window, 'output');
    expect(baseline.n).toBe(14);
    expect(p).toBeGreaterThan(40);
    expect(p).toBeLessThan(60);
  });

  it('an outlier high day scores P80+ (clipped at ±2.5σ)', () => {
    const window = [549_428, 951_084, 272_666, 369_227, 1_049_237, 84_696, 1_298_482];
    const today = 50_000_000; // way above any observed day
    const { p } = percentileVsYou(today, window, 'output');
    expect(p).toBeGreaterThanOrEqual(80);
  });

  it('a very low day scores P15 or below', () => {
    const window = [1_500_000, 1_800_000, 2_000_000, 2_200_000, 1_700_000, 1_900_000, 1_600_000];
    const today = 5_000; // way below observed days
    const { p } = percentileVsYou(today, window, 'output');
    expect(p).toBeLessThan(20);
  });

  it('zero today → P0', () => {
    const window = [1_500_000, 1_800_000, 2_000_000];
    const { p } = percentileVsYou(0, window, 'output');
    expect(p).toBe(0);
  });

  it('z-score is clipped — extreme inputs don\'t push past ~85 / under ~15', () => {
    const window = [1_000_000];
    // 1 day of history, then an absurd outlier
    const { p } = percentileVsYou(1e12, window, 'output');
    expect(p).toBeLessThanOrEqual(85);
  });
});
