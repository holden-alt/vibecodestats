import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { HeroBlock } from '@/components/dashboard/profile/HeroBlock';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { Tier } from '@/lib/stats/tier';

// jsdom does not implement window.matchMedia. RollingNumber reads
// window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches. We stub it
// to force either the REDUCED branch (matches: true => instant final value) or
// the ANIMATED branch (matches: false => rAF roll, final value still reached).
function stubMatchMedia(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation((query: string) => ({
      matches,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const trendStats: DailyStat[] = [
  {
    user_id: 'u1', date: '2026-05-19', tokens_total: 487231,
    tokens_by_model: { 'claude-opus-4-7': 480000 },
    sessions: 6, deep_work_minutes: 240, machines: ['mbp'],
    projects_touched: { 'cc-dashboard': 320000 },
    ships: { commits: 3, repos: 2 }, hourly_tokens: { '14': 100000 },
    source_synced_at: null,
  },
] as unknown as DailyStat[];

function renderHero(opts: {
  allTimeTokens: number;
  tier: Tier;
  topPercentLabel: number;
  rank: number;
  isHandcoder: boolean;
}) {
  return render(
    <HeroBlock
      allTimeTokens={opts.allTimeTokens}
      tier={opts.tier}
      topPercentLabel={opts.topPercentLabel}
      rank={opts.rank}
      isHandcoder={opts.isHandcoder}
      sessionsToday={6}
      shipsToday={{ commits: 3, repos: 2 }}
      projectsTouchedCount={2}
      trendStats={trendStats}
    />,
  );
}

describe('HeroBlock: all-time hero + tier reveal', () => {
  it('reduced-motion (matches: true): shows the final 4.8B value instantly and the rank line', () => {
    stubMatchMedia(true);
    renderHero({ allTimeTokens: 4_840_000_000, tier: 'S', topPercentLabel: 1, rank: 1, isHandcoder: false });
    // formatCompact(4.84B) => "4.8B" (one decimal, matches the OG card).
    expect(screen.getByText('4.8B')).toBeInTheDocument();
    expect(screen.getByText(/No\. 1 GLOBAL/)).toBeInTheDocument();
    expect(screen.getByText(/TOP 1%/)).toBeInTheDocument();
  });

  it('animated (matches: false): rolls up from 0 on mount and reaches the final 4.8B value', async () => {
    stubMatchMedia(false);
    const { container } = renderHero({ allTimeTokens: 4_840_000_000, tier: 'S', topPercentLabel: 1, rank: 1, isHandcoder: false });
    // animateOnMount: display starts at 0 and rolls up via rAF; data-value
    // carries the raw target immediately, the compact text arrives at the end.
    expect(container.querySelector('[data-value="4840000000"]')).not.toBeNull();
    await waitFor(() => expect(screen.getByText('4.8B')).toBeInTheDocument(), { timeout: 2500 });
  });

  it('S-tier badge carries the foil + tier-reveal-s classes', () => {
    stubMatchMedia(true);
    renderHero({ allTimeTokens: 4_840_000_000, tier: 'S', topPercentLabel: 1, rank: 1, isHandcoder: false });
    const badge = screen.getByText('S');
    expect(badge.className).toContain('foil');
    expect(badge.className).toContain('tier-reveal-s');
  });

  it('zero-token handcoder: shows the "No AI tokens on file" copy and NO rank line', () => {
    stubMatchMedia(true);
    const { container } = renderHero({ allTimeTokens: 0, tier: 'handcoder', topPercentLabel: 100, rank: 0, isHandcoder: true });
    expect(screen.getByText(/No AI tokens on file\. You're a handcoder until proven otherwise\./)).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/GLOBAL/);
    expect(container.textContent?.toLowerCase()).not.toContain('nothing to rank');
  });

  it('active bottom-10% handcoder: number + rank + bottom-10% framing, never "nothing to rank" or a "TOP %" flex', () => {
    stubMatchMedia(true);
    const { container } = renderHero({ allTimeTokens: 12_000_000, tier: 'handcoder', topPercentLabel: 95, rank: 47, isHandcoder: true });
    expect(screen.getByText('12.0M')).toBeInTheDocument();
    expect(screen.getByText(/No\. 47 GLOBAL/)).toBeInTheDocument();
    // bottom-10% framing (matches the OG card), NOT a "TOP 95%" inverted flex
    expect(container.textContent).toContain('bottom 10%, still mostly raw dogging it');
    expect(container.textContent).not.toMatch(/TOP \d/);
    expect(container.textContent?.toLowerCase()).not.toContain('nothing to rank');
  });

  it('keeps the ghosted sparkline container (recharts responsive wrapper) rendered', () => {
    stubMatchMedia(true);
    const { container } = renderHero({ allTimeTokens: 4_840_000_000, tier: 'S', topPercentLabel: 1, rank: 1, isHandcoder: false });
    // The ghosted sparkline (KEEP) renders a recharts ResponsiveContainer wrapper.
    expect(container.querySelector('.recharts-responsive-container')).not.toBeNull();
  });
});
