'use client';

import { useMemo, useState } from 'react';
import { clockHourAt, workdayMidpoint } from '@/lib/insights/compute';
import { fmtTokens } from '@/lib/insights/format';
import type { ClockWeek } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';
import { fmtDay, fmtMonth, TipBox, TipRow } from './chartBits';

type Tool = 'all' | 'claude' | 'codex';
const TOOLS: { id: Tool; label: string }[] = [
  { id: 'all', label: 'all' },
  { id: 'claude', label: 'claude' },
  { id: 'codex', label: 'codex' },
];

// Fixed drawing space; the SVG scales uniformly with its container, so dots stay round.
const W = 1000;
const LEFT = 44;
const RIGHT = 16;
const TOP = 8;
const ROW = 13;
const BOTTOM = 26;
const H = TOP + ROW * 24 + BOTTOM;

/** "2p", "12a", "2:30p". */
function fmtClock(hour: number, withMinutes = false): string {
  const h = Math.floor(hour) % 24;
  const m = Math.round((hour - Math.floor(hour)) * 60);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? 'a' : 'p';
  return withMinutes && m > 0 && m < 60 ? `${h12}:${String(m).padStart(2, '0')}${suffix}` : `${h12}${suffix}`;
}

function cellsFor(w: ClockWeek, tool: Tool): number[] {
  if (tool === 'claude') return w.claude;
  if (tool === 'codex') return w.codex;
  return w.claude.map((c, i) => c + w.codex[i]! + w.other[i]!);
}

/** One dot per week per hour of the day, sized by tokens, all time. The line
 *  marks the hour by which half of that week's work was done, so a shift
 *  toward mornings or late nights shows as the line moving. */
export function WorkClock({ weeks }: { weeks: ClockWeek[] }) {
  const [tool, setTool] = useState<Tool>('all');
  const [hover, setHover] = useState<{ w: number; h: number } | null>(null);

  const { grid, max, mids } = useMemo(() => {
    const grid = weeks.map((w) => cellsFor(w, tool));
    const max = Math.max(1, ...grid.flat());
    const mids = grid.map((cells) => workdayMidpoint(cells));
    return { grid, max, mids };
  }, [weeks, tool]);

  if (weeks.length === 0) return null;

  const colW = (W - LEFT - RIGHT) / weeks.length;
  const rMax = Math.min(colW, ROW) / 2 - 0.5;
  const cx = (i: number) => LEFT + colW * (i + 0.5);
  const cy = (h: number) => TOP + ROW * (h + 0.5);

  // Compare the first and the latest four full weeks of the midpoint.
  const fullMids = mids.map((m, i) => (i < weeks.length - 1 ? m : null));
  const avg = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null);
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  const early = avg(fullMids.slice(0, 4));
  const recent = avg(fullMids.slice(-5, -1));

  const linePts = mids
    .map((m, i) => (m == null ? null : `${cx(i).toFixed(1)},${(TOP + ROW * m).toFixed(1)}`))
    .filter(Boolean)
    .join(' ');

  const monthTicks = weeks
    .map((w, i) => ({ i, start: w.start }))
    .filter(({ start }, k, all) => k === 0 || start.slice(5, 7) !== all[k - 1]!.start.slice(5, 7));

  const hovered = hover ? { week: weeks[hover.w]!, value: grid[hover.w]![hover.h]!, w: hover.w, h: hover.h } : null;

  return (
    <PanelShell
      title="When you work"
      hint="tokens by hour of day, week by week, all time"
      right={<Pills options={TOOLS} value={tool} onChange={setTool} ariaLabel="tool" />}
    >
      {early != null && recent != null && (
        <p style={{ margin: '0 0 12px', fontSize: '0.8rem', color: 'var(--color-dim)' }}>
          Half of your work is done by <span style={{ color: 'var(--color-text)' }}>{fmtClock(clockHourAt(recent), true)}</span> lately, vs{' '}
          <span style={{ color: 'var(--color-text)' }}>{fmtClock(clockHourAt(early), true)}</span> in your first weeks.
        </p>
      )}
      <div className="scroll-x" style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', minWidth: 640 }}
          role="img"
          aria-label="Tokens by hour of the day for every week, with the halfway hour of each week"
          onMouseLeave={() => setHover(null)}
        >
          {/* Hour gridlines + labels every 4 hours (4a at the top: the work day's start). */}
          {[0, 4, 8, 12, 16, 20].map((h) => (
            <g key={h}>
              <line x1={LEFT} x2={W - RIGHT} y1={TOP + ROW * h} y2={TOP + ROW * h} stroke="var(--color-border)" strokeWidth={1} />
              <text x={LEFT - 8} y={TOP + ROW * h + 4} textAnchor="end" fontSize={10} fill="var(--color-dim)" fontFamily="var(--font-mono)">
                {fmtClock(clockHourAt(h))}
              </text>
            </g>
          ))}
          {monthTicks.map(({ i, start }) => (
            <text key={start} x={cx(i)} y={H - 8} textAnchor="middle" fontSize={10} fill="var(--color-dim)" fontFamily="var(--font-mono)">
              {fmtMonth(start)}
            </text>
          ))}
          {grid.map((cells, wi) =>
            cells.map((v, h) =>
              v > 0 ? (
                <circle key={`${wi}-${h}`} cx={cx(wi)} cy={cy(h)} r={Math.max(1, Math.sqrt(v / max) * rMax)} fill="var(--color-accent)" fillOpacity={0.85} />
              ) : null,
            ),
          )}
          <polyline points={linePts} fill="none" stroke="var(--color-text)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Hit targets: one invisible cell per week × hour. */}
          {weeks.map((_, wi) =>
            Array.from({ length: 24 }, (_, h) => (
              <rect
                key={`hit-${wi}-${h}`}
                x={LEFT + colW * wi}
                y={TOP + ROW * h}
                width={colW}
                height={ROW}
                fill="transparent"
                onMouseEnter={() => setHover({ w: wi, h })}
              />
            )),
          )}
          {hovered && (
            <rect x={LEFT + colW * hovered.w} y={TOP + ROW * hovered.h} width={colW} height={ROW} fill="none" stroke="var(--color-text)" strokeOpacity={0.6} />
          )}
        </svg>
        {hovered && (
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              top: 0,
              left: `${Math.min(70, ((cx(hovered.w) + 14) / W) * 100)}%`,
            }}
          >
            <TipBox title={`week of ${fmtDay(hovered.week.start)}`}>
              <TipRow label={`${fmtClock(clockHourAt(hovered.h))}–${fmtClock(clockHourAt(hovered.h + 1))}`} value={fmtTokens(hovered.value)} />
              {mids[hovered.w] != null && (
                <TipRow label="half done by" value={fmtClock(clockHourAt(mids[hovered.w]!), true)} />
              )}
            </TipBox>
          </div>
        )}
      </div>
      <div className="num" style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: '0.64rem', color: 'var(--color-dim)' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--color-accent)' }} />
          bigger dot = more tokens that hour
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 12, height: 2, background: 'var(--color-text)' }} />
          half of the week&apos;s work done by
        </span>
        <span>day runs 4a → 4a</span>
      </div>
    </PanelShell>
  );
}
