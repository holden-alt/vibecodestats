'use client';

import { useEffect, useState } from 'react';
import { formatCompact } from '@/lib/format';
import type { Scoreboard } from '@/lib/stats/team';

type Mode = 'daily' | 'all';

type Props = {
  // Daily is the DEFAULT view (today's tokens_by_model split across the field),
  // so it visibly changes through the day. All-time is the optional toggle.
  daily: Scoreboard;
  allTime: Scoreboard;
};

// Team Claude Code vs Team Codex scoreboard — Neon Arcade reskin (Task 3).
// DEFAULTS to the DAILY view. A glass panel with the two team headers, a
// two-tone foil-glow split bar, a one-shot sliding divider to the live split,
// and a daily/all-time toggle.
//
// MOTION POLICY: the divider slides to the live split ONCE on mount (and on
// toggle) via a single transform transition. No idle motion. Reduced-motion
// snaps it to the resolved split (the existing .scoreboard-divider kill block).
export function TeamScoreboard({ daily, allTime }: Props) {
  const [mode, setMode] = useState<Mode>('daily'); // daily is the default
  const board = mode === 'daily' ? daily : allTime;
  const { claude, codex, claudePct, codexPct, leader } = board;

  // Start centered, then slide to the live split after mount (and whenever the
  // split changes, e.g. on toggle) via the one-shot .scoreboard-divider
  // transform transition. Reduced-motion snaps to the end state (T4 CSS kill).
  const [dividerPct, setDividerPct] = useState(50);
  useEffect(() => {
    setDividerPct(claudePct);
  }, [claudePct]);

  return (
    <div className="neon-frame" style={{ padding: 'clamp(18px, 4vw, 26px)' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 14,
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 12,
            letterSpacing: '0.24em',
            textTransform: 'uppercase',
            color: 'var(--team-cx)',
            textShadow: '0 0 14px rgba(60,216,255,0.6)',
          }}
        >
          Team Scoreboard · {mode === 'daily' ? 'Today' : 'All-time'}
        </div>
        {/* daily / all-time toggle — daily is the default + primary view */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['daily', 'all'] as Mode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              style={chip(m === mode)}
            >
              {m === 'daily' ? 'today' : 'all-time'}
            </button>
          ))}
        </div>
      </div>

      {/* Team headers */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        <TeamLabel side="claude" leader={leader === 'claude_code'} />
        <TeamLabel side="codex" leader={leader === 'codex'} />
      </div>

      {/* Two-tone split bar with a one-shot sliding divider at the live split */}
      <div
        style={{
          position: 'relative',
          height: 34,
          borderRadius: 999,
          overflow: 'hidden',
          border: '1px solid rgba(60,216,255,0.3)',
          background: 'rgba(60,216,255,0.10)',
          boxShadow: 'inset 0 0 22px rgba(60,216,255,0.16)',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(90deg, var(--team-cc) 0%, var(--team-cc) 50%, var(--team-cx) 50%, var(--team-cx) 100%)',
            boxShadow: '0 0 30px rgba(255,138,60,0.5)',
          }}
        />
        <div
          className="scoreboard-divider"
          style={{
            position: 'absolute',
            top: -1,
            bottom: -1,
            left: 0,
            width: '100%',
            borderLeft: '2px solid var(--neon-txt)',
            boxShadow: '0 0 12px rgba(255,255,255,0.8)',
            pointerEvents: 'none',
            transform: `translateX(${dividerPct}%)`,
          }}
        />
      </div>

      {/* Live numbers */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 12,
          fontFamily: 'var(--font-display)',
          fontWeight: 800,
          fontSize: 20,
        }}
      >
        <span style={{ color: 'var(--team-cc)', textShadow: '0 0 14px rgba(255,138,60,0.6)' }}>
          {claudePct}%
        </span>
        <span style={{ color: 'var(--team-cx)', textShadow: '0 0 14px rgba(60,216,255,0.6)' }}>
          {codexPct}%
        </span>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 4,
          fontFamily: 'var(--font-body)',
          fontSize: '0.75rem',
          color: 'var(--neon-txt-dim)',
        }}
      >
        <span>{formatCompact(claude)} tokens</span>
        <span>{formatCompact(codex)} tokens</span>
      </div>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          color: 'var(--neon-txt-dim)',
          fontSize: '0.82rem',
          marginTop: 10,
          letterSpacing: '0.02em',
        }}
      >
        {mode === 'daily'
          ? 'Today across the field. This swings through the day. Pick a side and tip the balance.'
          : 'Every loaded day combined. Pick a side and tip the balance.'}
      </div>
    </div>
  );
}

function TeamLabel({ side, leader }: { side: 'claude' | 'codex'; leader: boolean }) {
  const color = side === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)';
  const name = side === 'codex' ? 'TEAM CODEX' : 'TEAM CLAUDE CODE';
  const swatch = (
    <span
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        background: color,
        boxShadow: `0 0 14px ${color}`,
        flexShrink: 0,
      }}
    />
  );
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        fontFamily: 'var(--font-display)',
        fontWeight: 700,
        fontSize: 14,
        letterSpacing: '0.04em',
        color,
        textShadow: leader ? `0 0 12px ${color}` : undefined,
        opacity: leader ? 1 : 0.85,
      }}
    >
      {side === 'claude' ? (
        <>
          {swatch}
          {name}
        </>
      ) : (
        <>
          {name}
          {swatch}
        </>
      )}
    </div>
  );
}

function chip(active: boolean): React.CSSProperties {
  return {
    fontFamily: 'var(--font-display)',
    fontSize: 10,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    padding: '4px 10px',
    borderRadius: 999,
    cursor: 'pointer',
    background: active ? 'rgba(60,216,255,0.14)' : 'transparent',
    border: `1px solid ${active ? 'var(--team-cx)' : 'var(--neon-line)'}`,
    color: active ? 'var(--team-cx)' : 'var(--neon-txt-dim)',
  };
}
