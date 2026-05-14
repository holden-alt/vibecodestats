import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { DayOfWeekChart } from '@/components/charts/DayOfWeekChart';

describe('DayOfWeekChart', () => {
  it('renders 7 bars', () => {
    const { container } = render(<DayOfWeekChart averages={[0, 0, 0, 0, 0, 0, 0]} />);
    expect(container.querySelectorAll('[data-bar]').length).toBe(7);
  });

  it('scales the tallest weekday to 100%', () => {
    const { container } = render(<DayOfWeekChart averages={[100, 0, 0, 0, 200, 0, 0]} />);
    const bars = container.querySelectorAll('[data-bar]');
    expect(bars[0]?.getAttribute('data-pct')).toBe('50');
    expect(bars[4]?.getAttribute('data-pct')).toBe('100');
  });

  it('does not crash on all-zero averages', () => {
    const { container } = render(<DayOfWeekChart averages={[0, 0, 0, 0, 0, 0, 0]} />);
    expect(container.querySelector('[data-bar]')?.getAttribute('data-pct')).toBe('0');
  });
});
