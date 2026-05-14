import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TimeOfDayHistogram } from '@/components/charts/TimeOfDayHistogram';

describe('TimeOfDayHistogram', () => {
  it('renders 24 bars', () => {
    const { container } = render(<TimeOfDayHistogram hourly={new Array(24).fill(0)} />);
    expect(container.querySelectorAll('[data-hour]').length).toBe(24);
  });

  it('scales the busiest hour to 100%', () => {
    const hourly = new Array(24).fill(0);
    hourly[9] = 100;
    hourly[14] = 200;
    const { container } = render(<TimeOfDayHistogram hourly={hourly} />);
    expect(container.querySelector('[data-hour="9"]')?.getAttribute('data-pct')).toBe('50');
    expect(container.querySelector('[data-hour="14"]')?.getAttribute('data-pct')).toBe('100');
  });

  it('does not crash on all-zero hours', () => {
    const { container } = render(<TimeOfDayHistogram hourly={new Array(24).fill(0)} />);
    expect(container.querySelector('[data-hour="0"]')?.getAttribute('data-pct')).toBe('0');
  });
});
