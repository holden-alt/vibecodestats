import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModelAreaChart } from '@/components/charts/ModelAreaChart';
import type { TrendDay } from '@/lib/stats/aggregations';

function day(partial: Partial<TrendDay>): TrendDay {
  return { date: '2026-05-14', tokens: 0, opus: 0, sonnet: 0, haiku: 0, other: 0, ...partial };
}

describe('ModelAreaChart', () => {
  it('renders one column per day', () => {
    const days = Array.from({ length: 30 }, (_, i) =>
      day({ date: `2026-04-${String(i + 1).padStart(2, '0')}` }),
    );
    const { container } = render(<ModelAreaChart days={days} />);
    expect(container.querySelectorAll('[data-col]').length).toBe(30);
  });

  it('stacks model layers proportionally within a day', () => {
    const days = [day({ date: '2026-05-14', tokens: 100, opus: 75, sonnet: 25 })];
    const { container } = render(<ModelAreaChart days={days} />);
    const opus = container.querySelector('[data-layer="opus"]');
    const sonnet = container.querySelector('[data-layer="sonnet"]');
    expect(opus?.getAttribute('data-pct')).toBe('75');
    expect(sonnet?.getAttribute('data-pct')).toBe('25');
  });

  it('renders an empty column for a zero-token day', () => {
    const days = [day({ date: '2026-05-14' })];
    const { container } = render(<ModelAreaChart days={days} />);
    expect(container.querySelector('[data-col]')).toBeTruthy();
    expect(container.querySelectorAll('[data-layer]').length).toBe(0);
  });
});
