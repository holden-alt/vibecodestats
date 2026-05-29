import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { IdentityStrip } from '@/components/dashboard/profile/IdentityStrip';
import type { ProfileUser } from '@/lib/stats/profile-data';
import type { Camp } from '@/lib/stats/team';
import type { Tier, TierGap } from '@/lib/stats/tier';

function makeUser(team: Camp | null): ProfileUser {
  return {
    id: 'u1',
    auth_id: 'auth-1',
    github_handle: 'holden-alt',
    display_name: 'Holden',
    avatar_url: null,
    primary_persona: null,
    secondary_personas: [],
    private_project_names: false,
    team,
  };
}

function renderStrip(opts: { tier: Tier; team: Camp | null; gap: TierGap }) {
  return render(
    <IdentityStrip
      user={makeUser(opts.team)}
      rank={null}
      squadSize={null}
      tier={opts.tier}
      team={opts.team}
      gap={opts.gap}
      streakDays={5}
      nowProject={null}
    />,
  );
}

describe('IdentityStrip: tier badge + team chip + gap line', () => {
  it('S-tier + Team Claude Code: badge is the letter S, chip is TEAM CLAUDE CODE, no gap line', () => {
    const { container } = renderStrip({
      tier: 'S',
      team: 'claude_code',
      gap: { nextTier: null, tokensNeeded: 0 },
    });
    expect(screen.getByText('S')).toBeInTheDocument();
    expect(screen.getByText('TEAM CLAUDE CODE')).toBeInTheDocument();
    // S-tier has no next tier, so no gap line renders.
    expect(container.textContent).not.toMatch(/from [A-Z]/);
  });

  it('S-tier badge carries the foil + tier-reveal-s classes', () => {
    renderStrip({ tier: 'S', team: 'claude_code', gap: { nextTier: null, tokensNeeded: 0 } });
    const badge = screen.getByText('S');
    expect(badge.className).toContain('foil');
    expect(badge.className).toContain('tier-reveal');
    expect(badge.className).toContain('tier-reveal-s');
  });

  it('B-tier + Team Codex: chip is TEAM CODEX and the gap line reads "142.0M from A"', () => {
    renderStrip({
      tier: 'B',
      team: 'codex',
      gap: { nextTier: 'A', tokensNeeded: 142_000_000 },
    });
    expect(screen.getByText('B')).toBeInTheDocument();
    expect(screen.getByText('TEAM CODEX')).toBeInTheDocument();
    expect(screen.getByText(/142\.0M from A/)).toBeInTheDocument();
  });

  it('non-S tier badge has tier-reveal but NOT tier-reveal-s and NOT foil', () => {
    renderStrip({ tier: 'B', team: 'codex', gap: { nextTier: 'A', tokensNeeded: 142_000_000 } });
    const badge = screen.getByText('B');
    expect(badge.className).toContain('tier-reveal');
    expect(badge.className).not.toContain('tier-reveal-s');
    expect(badge.className).not.toContain('foil');
  });

  it('renders NO team chip when team is null', () => {
    renderStrip({ tier: 'C', team: null, gap: { nextTier: 'B', tokensNeeded: 1_000_000 } });
    expect(screen.queryByText('TEAM CLAUDE CODE')).not.toBeInTheDocument();
    expect(screen.queryByText('TEAM CODEX')).not.toBeInTheDocument();
  });

  it('handcoder tier: badge reads HANDCODER and never says "nothing to rank"', () => {
    const { container } = renderStrip({
      tier: 'handcoder',
      team: null,
      gap: { nextTier: 'D', tokensNeeded: 50_000 },
    });
    expect(screen.getByText('HANDCODER')).toBeInTheDocument();
    expect(container.textContent?.toLowerCase()).not.toContain('nothing to rank');
  });
});
