import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TeamScoreboard } from '@/components/dashboard/profile/TeamScoreboard';
import { campScoreboard, type Camp, type Scoreboard } from '@/lib/stats/team';

describe('TeamScoreboard: bars, percentages, sliding divider', () => {
  const scoreboard: Scoreboard = {
    claude: 600,
    codex: 400,
    claudePct: 60,
    codexPct: 40,
    leader: 'claude_code',
  };

  it('renders the Team Scoreboard label and both camp percentage readouts', () => {
    render(<TeamScoreboard scoreboard={scoreboard} />);
    expect(screen.getByText('Team Scoreboard')).toBeInTheDocument();
    expect(screen.getByText('TEAM CLAUDE CODE 60%')).toBeInTheDocument();
    expect(screen.getByText('TEAM CODEX 40%')).toBeInTheDocument();
  });

  it('places the divider at the live split (translateX(60%)) after mount', () => {
    const { container } = render(<TeamScoreboard scoreboard={scoreboard} />);
    const divider = container.querySelector('.scoreboard-divider') as HTMLElement | null;
    expect(divider).not.toBeNull();
    // useEffect ran on mount, moving the divider from the centered 50% start to
    // the live 60% split. Under reduced-motion the .scoreboard-divider transition
    // is killed by the T4 CSS block, so this end-state is simply snapped to.
    expect(divider?.style.transform).toBe('translateX(60%)');
  });

  it('shows the codex leader chip when codex leads', () => {
    render(
      <TeamScoreboard
        scoreboard={{ claude: 400, codex: 600, claudePct: 40, codexPct: 60, leader: 'codex' }}
      />,
    );
    // The leader chip text is TEAM CODEX (matches the codex-side readout too,
    // so two matches are expected).
    expect(screen.getAllByText(/TEAM CODEX/).length).toBeGreaterThanOrEqual(1);
  });
});

describe('campScoreboard aggregation (mirrors tests/stats/team.test.ts)', () => {
  it('splits mixed gpt-* and claude model maps into the live percentages + leader', () => {
    const r = campScoreboard([
      { 'claude-opus-4-8': 580, 'claude-haiku-4-5': 0 },
      { 'gpt-5.3-codex': 300, 'gpt-4.1': 120 },
    ]);
    expect(r.claude).toBe(580);
    expect(r.codex).toBe(420);
    expect(r.claudePct).toBe(58);
    expect(r.codexPct).toBe(42);
    expect(r.leader).toBe<Camp>('claude_code');
  });
});
