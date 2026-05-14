import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TokenTrendChart } from '@/components/charts/TokenTrendChart';

describe('TokenTrendChart', () => {
  it('renders one bar per day', () => {
    const days = Array.from({ length: 30 }, (_, i) => ({
      date: `2026-04-${String(i + 1).padStart(2, '0')}`,
      tokens: i * 1000,
    }));
    const { container } = render(<TokenTrendChart days={days} />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(30);
  });

  it('scales the tallest bar to 100% and others proportionally', () => {
    const days = [
      { date: '2026-05-13', tokens: 100 },
      { date: '2026-05-14', tokens: 200 },
    ];
    const { container } = render(<TokenTrendChart days={days} />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars[0]?.getAttribute('data-pct')).toBe('50');
    expect(bars[1]?.getAttribute('data-pct')).toBe('100');
  });

  it('renders all-zero bars without crashing on empty/zero data', () => {
    const days = [{ date: '2026-05-14', tokens: 0 }];
    const { container } = render(<TokenTrendChart days={days} />);
    expect(container.querySelector('[data-bar]')?.getAttribute('data-pct')).toBe('0');
  });
});
