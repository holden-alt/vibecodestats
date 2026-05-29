'use client';

import { useEffect, useState } from 'react';
import type { Scoreboard } from '@/lib/stats/team';

type Props = {
  scoreboard: Scoreboard;
};

// Live daily Team Claude Code vs Team Codex scoreboard (Phase 5 T3).
// The divider slides from center to the live split on load (SPEC line 105) via a
// single one-shot `transform` transition (.scoreboard-divider, defined in
// globals.css). Under prefers-reduced-motion the T4 kill block disables that
// transition, so setting the live split on mount just snaps it there statically.
export function TeamScoreboard({ scoreboard }: Props) {
  const { claudePct, codexPct, leader } = scoreboard;

  // Start centered (50%), then move to the live split after mount so the
  // one-shot transform transition animates. Reduced-motion users get the same
  // end position, instantly (transition killed by the T4 CSS block).
  const [dividerPct, setDividerPct] = useState(50);
  useEffect(() => {
    setDividerPct(claudePct);
  }, [claudePct]);

  return (
    <div
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: 3,
        padding: '16px 20px',
        background: 'transparent',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 10,
          flexWrap: 'wrap',
          gap: 6,
        }}
      >
        <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Team Scoreboard
        </div>
        <span style={leaderChip(leader)}>
          {leader === 'codex' ? 'TEAM CODEX' : 'TEAM CLAUDE CODE'}
        </span>
      </div>

      {/* Two-part horizontal bar: claude (warm) on the left, codex (cyan) on the
          right, with a one-shot sliding divider at the live split. */}
      <div
        style={{
          position: 'relative',
          height: 14,
          borderRadius: 2,
          overflow: 'hidden',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-2)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(90deg, var(--team-cc-color) 0%, var(--team-cc-color) 50%, var(--team-cx-color) 50%, var(--team-cx-color) 100%)',
          }}
        />
        {/* The divider element is the full bar width with a 2px left border as
            the visible marker line; CSS translateX(%) resolves against the
            element's own (bar-width) box, so translateX(60%) lands the marker
            at the 60% mark. Its left edge clips out at the bar's overflow:hidden. */}
        <div
          className="scoreboard-divider"
          style={{
            position: 'absolute',
            top: -1,
            bottom: -1,
            left: 0,
            width: '100%',
            borderLeft: '2px solid var(--color-text)',
            boxShadow: '0 0 0 1px var(--color-bg)',
            pointerEvents: 'none',
            transform: `translateX(${dividerPct}%)`,
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: '0.65rem',
          fontFamily: 'ui-monospace, monospace',
          letterSpacing: '0.04em',
        }}
      >
        <span style={{ color: 'var(--team-cc-color)' }}>TEAM CLAUDE CODE {claudePct}%</span>
        <span style={{ color: 'var(--team-cx-color)' }}>TEAM CODEX {codexPct}%</span>
      </div>
    </div>
  );
}

function leaderChip(leader: Scoreboard['leader']): React.CSSProperties {
  const color = leader === 'codex' ? 'var(--team-cx-color)' : 'var(--team-cc-color)';
  return {
    fontSize: '0.65rem',
    padding: '2px 6px',
    borderRadius: 2,
    background: color,
    color: 'var(--color-bg)',
    fontFamily: 'ui-monospace, monospace',
  };
}
