import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Heatmap } from '@/components/Heatmap';

describe('Heatmap', () => {
  it('renders 52 weeks × 7 days = 364 cells', () => {
    const today = new Date('2026-05-13');
    const { container } = render(<Heatmap days={[]} today={today} />);
    const cells = container.querySelectorAll('[data-cell]');
    expect(cells.length).toBe(52 * 7);
  });

  it('applies level based on tokens', () => {
    const today = new Date('2026-05-13');
    const days = [
      { date: '2026-05-13', tokens: 500_000 },
      { date: '2026-05-12', tokens: 200_000 },
      { date: '2026-05-11', tokens: 50_000 },
      { date: '2026-05-10', tokens: 5_000 },
    ];
    const { container } = render(<Heatmap days={days} today={today} />);
    expect(container.querySelector('[data-date="2026-05-13"]')?.getAttribute('data-level')).toBe('4');
    expect(container.querySelector('[data-date="2026-05-12"]')?.getAttribute('data-level')).toBe('3');
    expect(container.querySelector('[data-date="2026-05-11"]')?.getAttribute('data-level')).toBe('2');
    expect(container.querySelector('[data-date="2026-05-10"]')?.getAttribute('data-level')).toBe('1');
  });
});
