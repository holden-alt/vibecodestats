import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TeamScoreboard } from '@/components/dashboard/profile/TeamScoreboard';
import { campScoreboard, type Camp, type Scoreboard } from '@/lib/stats/team';

describe('TeamScoreboard: daily default, percentages, sliding divider, toggle', () => {
  const daily: Scoreboard = {
    claude: 600,
    codex: 400,
    claudePct: 60,
    codexPct: 40,
    leader: 'claude_code',
  };
  const week: Scoreboard = {
    claude: 500,
    codex: 500,
    claudePct: 50,
    codexPct: 50,
    leader: 'claude_code',
  };
  const month: Scoreboard = {
    claude: 450,
    codex: 550,
    claudePct: 45,
    codexPct: 55,
    leader: 'codex',
  };
  const all: Scoreboard = {
    claude: 300,
    codex: 700,
    claudePct: 30,
    codexPct: 70,
    leader: 'codex',
  };
  const boards = { daily, week, month, all };

  it('DEFAULTS to the daily view and shows both camp percentage readouts', () => {
    render(<TeamScoreboard boards={boards} />);
    // Daily is the default label + the daily split (60/40), not the all-time split.
    expect(screen.getByText(/Team Scoreboard · Today/i)).toBeInTheDocument();
    expect(screen.getByText('60%')).toBeInTheDocument();
    expect(screen.getByText('40%')).toBeInTheDocument();
  });

  it('places the divider at the live daily split (translateX(60%)) after mount', () => {
    const { container } = render(<TeamScoreboard boards={boards} />);
    const divider = container.querySelector('.scoreboard-divider') as HTMLElement | null;
    expect(divider).not.toBeNull();
    // useEffect ran on mount, moving the divider from the centered 50% start to
    // the live daily 60% split. Reduced-motion snaps to this end state.
    expect(divider?.style.transform).toBe('translateX(60%)');
  });

  it('switches to the all-time split when the all-time toggle is clicked', () => {
    render(<TeamScoreboard boards={boards} />);
    fireEvent.click(screen.getByRole('button', { name: /all-time/i }));
    expect(screen.getByText(/Team Scoreboard · All-time/i)).toBeInTheDocument();
    expect(screen.getByText('30%')).toBeInTheDocument();
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('shows both team labels', () => {
    render(<TeamScoreboard boards={boards} />);
    expect(screen.getByText('TEAM CLAUDE CODE')).toBeInTheDocument();
    expect(screen.getByText('TEAM CODEX')).toBeInTheDocument();
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
