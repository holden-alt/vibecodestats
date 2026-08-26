import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { DayRankingsPanel } from '@/components/insights/DayRankingsPanel';
import { buildDayRankings } from '@/lib/insights/compute';
import type { HistoryDayRow } from '@/lib/insights/types';

const hist = (date: string, tokens: number): HistoryDayRow => ({ date, tokens_total: tokens, sessions: null });

describe('DayRankingsPanel', () => {
  it('renders ranked days with bars scaled to the best day', () => {
    const days = buildDayRankings([
      hist('2026-08-22', 400_000_000),
      hist('2026-08-24', 1_600_000_000),
      hist('2026-08-25', 800_000_000),
      hist('2026-08-20', 0), // inactive day — excluded by the compute
    ]);
    const { getByTestId, getByText, container } = render(
      <DayRankingsPanel today="2026-08-25" days={days} />,
    );

    // Order: record day first, and zero-token days never appear.
    const rows = Array.from(container.querySelectorAll('[title]')).map((el) =>
      el.getAttribute('title'),
    );
    expect(rows).toHaveLength(3);
    expect(rows[0]).toContain('#1');
    expect(rows[0]).toContain('2026-08-24');
    expect(rows[1]).toContain('#2');
    expect(rows[1]).toContain('2026-08-25');
    expect(rows[1]).toContain('(today)');
    expect(rows[2]).toContain('#3');
    expect(rows[2]).toContain('2026-08-22');

    // Bars taper: best day = full scale, others proportional.
    expect(getByTestId('dayrank-bar-2026-08-24').style.transform).toBe('scaleX(1)');
    expect(getByTestId('dayrank-bar-2026-08-25').style.transform).toBe('scaleX(0.5)');
    expect(getByTestId('dayrank-bar-2026-08-22').style.transform).toBe('scaleX(0.25)');

    // Exact count lives in the row tooltip; compact value renders inline.
    expect(rows[0]).toContain('1,600,000,000 tokens');
    expect(getByText('1.60B')).toBeInTheDocument();
  });

  it('collapses to the top rows and expands to the full list', () => {
    const days = buildDayRankings(
      Array.from({ length: 30 }, (_, i) =>
        hist(`2026-07-${String(i + 1).padStart(2, '0')}`, (30 - i) * 1_000_000),
      ),
    );
    const { container, getByRole } = render(
      <DayRankingsPanel today="2026-08-25" days={days} collapsedCount={20} />,
    );

    expect(container.querySelectorAll('[title]')).toHaveLength(20);

    fireEvent.click(getByRole('button', { name: /show all 30 days/i }));
    expect(container.querySelectorAll('[title]')).toHaveLength(30);

    fireEvent.click(getByRole('button', { name: /show top 20/i }));
    expect(container.querySelectorAll('[title]')).toHaveLength(20);
  });

  it('hides the expander when everything already fits', () => {
    const { queryByRole } = render(
      <DayRankingsPanel today="2026-08-25" days={[{ date: '2026-08-25', tokens: 10 }]} />,
    );
    expect(queryByRole('button')).toBeNull();
  });

  it('renders nothing with no active days', () => {
    const { container } = render(<DayRankingsPanel today="2026-08-25" days={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
