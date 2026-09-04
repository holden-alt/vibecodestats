'use client';

import { useState } from 'react';
import type { RankedDay } from '@/lib/insights/types';
import { fmtInt, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';

// Day rankings — every tracked day, ranked by total tokens, biggest first.
// Each row's bar is scaled against the best day, so the list tapers and the
// distance between the record day and an ordinary one is visible at a glance.
// Rows arrive ranked from buildDayRankings (same full-history store as the
// records board), so rank #1 always matches the "best day" record. Collapsed
// to the top rows by default; the header carries today's rank so the same
// question the Usage Pace widget answers ("how does today rank") is answered
// here without scrolling.

type Props = {
  /** Pre-ranked by buildDayRankings: tokens desc, > 0 only. */
  days: RankedDay[];
  today: string;
  /** Rows shown before the "show all" expander. */
  collapsedCount?: number;
};

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function weekdayOf(date: string): string {
  // History dates are local-calendar 'YYYY-MM-DD' keys; parse as UTC so the
  // weekday never shifts with the viewer's timezone.
  return WEEKDAYS[new Date(`${date}T00:00:00Z`).getUTCDay()] ?? '';
}

export function DayRankingsPanel({ days, today, collapsedCount = 20 }: Props) {
  const [showAll, setShowAll] = useState(false);

  if (days.length === 0) return null;

  const max = days[0]!.tokens || 1;
  const visible = showAll ? days : days.slice(0, collapsedCount);
  const todayIdx = days.findIndex((d) => d.date === today);
  const todayRank = todayIdx >= 0 ? todayIdx + 1 : null;
  const todayPct = todayRank != null ? Math.max(1, Math.ceil((todayRank / days.length) * 100)) : null;

  return (
    <PanelShell
      title="Day rankings"
      hint="every day · ranked by tokens"
      right={
        <span className="num" style={{ fontSize: '0.62rem', color: 'var(--color-dim)' }}>
          {todayRank != null ? (
            <>
              today <span style={{ color: 'var(--color-text)', fontWeight: 600 }}>#{fmtInt(todayRank)}</span> of{' '}
              {fmtInt(days.length)} · top {todayPct}%
            </>
          ) : (
            <>{fmtInt(days.length)} days tracked · today not in yet</>
          )}
        </span>
      }
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {visible.map((row, i) => {
          const rank = i + 1;
          const isToday = row.date === today;
          const isBest = rank === 1;
          // Fraction of the best day, floored so even a tiny day keeps a
          // visible sliver of bar.
          const frac = Math.max(row.tokens / max, 0.006);
          return (
            <div
              key={row.date}
              className="num"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                fontSize: '0.66rem',
              }}
              title={`#${rank} · ${weekdayOf(row.date)} ${row.date}${isToday ? ' (today)' : ''} · ${fmtInt(row.tokens)} tokens`}
            >
              <span
                style={{
                  minWidth: '3.5ch',
                  textAlign: 'right',
                  color: isBest || isToday ? 'var(--color-text)' : 'var(--color-dim)',
                  fontWeight: isBest ? 700 : 400,
                  flexShrink: 0,
                }}
              >
                #{rank}
              </span>
              <span style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                <span style={{ color: 'var(--color-dim)' }}>{weekdayOf(row.date)}</span>{' '}
                <span style={{ color: 'var(--color-text)', fontWeight: isToday ? 600 : 400 }}>{row.date}</span>
                {isToday && <span style={{ color: 'var(--color-dim)' }}> · today</span>}
              </span>
              <div
                style={{
                  flex: 1,
                  background: 'var(--color-bg-2)',
                  height: 8,
                  borderRadius: 1,
                  overflow: 'hidden',
                  minWidth: 0,
                }}
              >
                <div
                  data-testid={`dayrank-bar-${row.date}`}
                  style={{
                    width: '100%',
                    transform: `scaleX(${frac})`,
                    transformOrigin: 'left',
                    background: isToday ? 'var(--color-text)' : 'var(--color-accent)',
                    opacity: isToday || isBest ? 1 : 0.7,
                    height: '100%',
                    transition: 'transform 800ms ease-out',
                  }}
                />
              </div>
              <span
                style={{
                  minWidth: 56,
                  textAlign: 'right',
                  color: 'var(--color-text)',
                  fontWeight: isBest ? 700 : 500,
                  flexShrink: 0,
                }}
              >
                {fmtTokens(row.tokens)}
              </span>
            </div>
          );
        })}

        {days.length > collapsedCount && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            aria-expanded={showAll}
            style={{
              alignSelf: 'flex-start',
              marginTop: 8,
              background: 'transparent',
              border: '1px solid var(--color-border)',
              borderRadius: 3,
              padding: '5px 12px',
              cursor: 'pointer',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.6rem',
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: 'var(--color-text)',
            }}
          >
            {showAll ? `show top ${collapsedCount}` : `show all ${fmtInt(days.length)} days`}
          </button>
        )}
      </div>
    </PanelShell>
  );
}
