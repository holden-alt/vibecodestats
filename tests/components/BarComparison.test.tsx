import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { BarComparison } from '@/components/leaderboard/BarComparison';
import type { RankedEntry } from '@/lib/stats/leaderboard';

const entries: RankedEntry[] = [
  { userId: 'u2', handle: 'mira-builds', displayName: 'Mira', value: 400, rank: 1, isViewer: false },
  { userId: 'u1', handle: 'holden-alt', displayName: 'Holden', value: 100, rank: 2, isViewer: true },
];

describe('BarComparison', () => {
  it('renders one bar per entry', () => {
    const { container } = render(<BarComparison entries={entries} />);
    expect(container.querySelectorAll('[data-bar-row]').length).toBe(2);
  });

  it('scales the largest entry to 100% and others proportionally', () => {
    const { container } = render(<BarComparison entries={entries} />);
    expect(container.querySelector('[data-handle="mira-builds"] [data-bar]')?.getAttribute('data-pct')).toBe('100');
    expect(container.querySelector('[data-handle="holden-alt"] [data-bar]')?.getAttribute('data-pct')).toBe('25');
  });

  it('marks the viewer bar', () => {
    const { container } = render(<BarComparison entries={entries} />);
    expect(container.querySelector('[data-handle="holden-alt"]')?.getAttribute('data-viewer')).toBe('true');
  });

  it('renders an empty state when there are no entries', () => {
    const { container } = render(<BarComparison entries={[]} />);
    expect(container.querySelector('[data-empty]')).toBeTruthy();
  });
});
