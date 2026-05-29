import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RankList } from '@/components/leaderboard/RankList';
import type { RankedEntry } from '@/lib/stats/leaderboard';

const entries: RankedEntry[] = [
  { userId: 'u2', handle: 'mira-builds', displayName: 'Mira', value: 500, rank: 1, isViewer: false, tier: 'S' },
  { userId: 'u1', handle: 'holden-alt', displayName: 'Holden', value: 300, rank: 2, isViewer: true, tier: 'A' },
  { userId: 'u3', handle: 'devon-ships', displayName: 'Devon', value: 100, rank: 3, isViewer: false, tier: 'B' },
];

describe('RankList', () => {
  it('renders one row per entry, with rank and handle', () => {
    const { container } = render(<RankList entries={entries} />);
    const rows = container.querySelectorAll('[data-rank-row]');
    expect(rows.length).toBe(3);
    expect(rows[0]?.getAttribute('data-rank')).toBe('1');
    expect(rows[0]?.getAttribute('data-handle')).toBe('mira-builds');
  });

  it('marks the viewer row', () => {
    const { container } = render(<RankList entries={entries} />);
    expect(container.querySelector('[data-handle="holden-alt"]')?.getAttribute('data-viewer')).toBe('true');
    expect(container.querySelector('[data-handle="mira-builds"]')?.getAttribute('data-viewer')).toBe('false');
  });

  it('renders an empty state when there are no entries', () => {
    const { container } = render(<RankList entries={[]} />);
    expect(container.querySelector('[data-empty]')).toBeTruthy();
    expect(container.querySelectorAll('[data-rank-row]').length).toBe(0);
  });
});
