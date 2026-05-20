import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BentoTile } from '@/components/dashboard/BentoTile';

describe('BentoTile', () => {
  it('renders label, children, and sub', () => {
    render(
      <BentoTile label="tokens today" sub="across 4 projects">
        <span>2,418,302</span>
      </BentoTile>,
    );
    expect(screen.getByText('tokens today')).toBeInTheDocument();
    expect(screen.getByText('2,418,302')).toBeInTheDocument();
    expect(screen.getByText('across 4 projects')).toBeInTheDocument();
  });

  it('renders as an anchor when href is provided', () => {
    render(
      <BentoTile label="rank" href="/leaderboard">
        <span>#3</span>
      </BentoTile>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/leaderboard');
  });

  it('applies column/row span via inline grid styles', () => {
    const { container } = render(
      <BentoTile label="trends" colSpan={4} rowSpan={2}>
        <span>chart</span>
      </BentoTile>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.gridColumn).toBe('span 4');
    expect(el.style.gridRow).toBe('span 2');
  });
});
