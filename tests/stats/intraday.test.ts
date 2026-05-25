import { describe, expect, it } from 'vitest';
import { computeHourlyCurve, cumulativeShare, paceRatio, projectEod, paceLabel } from '@/lib/stats/intraday';

describe('intraday projection', () => {
  it('empty window returns a uniform curve', () => {
    const curve = computeHourlyCurve([]);
    expect(curve).toHaveLength(24);
    expect(curve[0]).toBeCloseTo(1 / 24, 5);
    expect(curve.reduce((a, b) => a + b, 0)).toBeCloseTo(1.0, 5);
  });

  it('skewed window produces a skewed curve', () => {
    // All activity in hour 20
    const window = [{ '20': 1000 }, { '20': 2000 }, { '20': 500 }];
    const curve = computeHourlyCurve(window);
    expect(curve[20]).toBeCloseTo(1.0, 5);
    expect(curve[10]).toBe(0);
  });

  it('cumulative share monotonically increases', () => {
    const window = [{ '8': 100, '9': 200, '10': 300, '11': 400 }];
    const curve = computeHourlyCurve(window);
    expect(cumulativeShare(curve, 0)).toBe(0);
    expect(cumulativeShare(curve, 9)).toBeLessThan(cumulativeShare(curve, 10));
    expect(cumulativeShare(curve, 24)).toBeCloseTo(1.0, 5);
  });

  it('pace ratio of 1.0 = on pace, >1 = ahead, <1 = behind', () => {
    const window = [
      { '8': 100, '12': 100, '16': 100, '20': 100 },
      { '8': 200, '12': 200, '16': 200, '20': 200 },
    ];
    const curve = computeHourlyCurve(window);
    const median = 800;
    // By hour 20, cumulative share is (100+100+100)/(400)=0.75 → expected_so_far = 600
    // If today_so_far = 600 → ratio 1.0
    const onPace = paceRatio(600, median, curve, 20);
    expect(onPace).toBeCloseTo(1.0, 1);
    const ahead = paceRatio(900, median, curve, 20);
    expect(ahead).toBeGreaterThan(1.4);
    const behind = paceRatio(300, median, curve, 20);
    expect(behind).toBeLessThan(0.6);
  });

  it('projection floor prevents wild over-projection early in the day', () => {
    const window = [{ '20': 1000 }];
    const curve = computeHourlyCurve(window);
    // Cumulative share at hour 1 = 0 normally (all activity in hour 20)
    // With floor 0.25 → expected_so_far = 0.25 * median, ratio bounded
    const ratio = paceRatio(100, 1000, curve, 1);
    expect(ratio).not.toBeNull();
    expect(ratio!).toBeLessThan(1); // 100/250 = 0.4
  });

  it('paceLabel renders to "1.3× by this hour"', () => {
    expect(paceLabel(1.3)).toBe('1.3× by this hour');
    expect(paceLabel(0.7)).toBe('0.7× by this hour');
    expect(paceLabel(null)).toBeNull();
  });

  it('projectEod extrapolates the current cumulative to a full day', () => {
    const curve = Array(24).fill(1 / 24);
    // At noon, 50% of day done → cumulative 100 → projected 200
    const projected = projectEod(100, curve, 12);
    expect(projected).toBeCloseTo(200, 0);
  });
});
