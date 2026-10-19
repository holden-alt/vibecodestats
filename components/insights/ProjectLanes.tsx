'use client';

import { useState } from 'react';
import { VENDOR_COLOR } from '@/lib/insights/colors';
import { fmtTokens } from '@/lib/insights/format';
import type { ProjectLanes as Lanes } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { fmtDay, fmtMonth, Legend, TipBox, TipRow } from './chartBits';

const CLAUDE = VENDOR_COLOR.anthropic;
const CODEX = VENDOR_COLOR.openai;
const OTHER = VENDOR_COLOR.xai;

// Fixed drawing space; scales uniformly with the container.
const W = 1000;
const LABEL_W = 190;
const TOTAL_W = 64;
const TOP = 6;
const ROW = 26;
const BOTTOM = 24;

/** The biggest projects as lanes, one dot per week sized by tokens and colored
 *  by the tool that did most of that week's work. Lanes start where a project
 *  started, so the chart reads top to bottom as projects arriving and fading. */
export function ProjectLanes({ data }: { data: Lanes }) {
  const [hover, setHover] = useState<{ lane: number; week: number } | null>(null);
  const { weeks, lanes, maxCell, rest } = data;
  if (lanes.length === 0) return null;

  const H = TOP + ROW * lanes.length + BOTTOM;
  const plotL = LABEL_W;
  const plotR = W - TOTAL_W;
  const colW = (plotR - plotL) / weeks.length;
  // Let the biggest weeks spill slightly past their lane so mid-sized weeks stay visible.
  const rMax = Math.min(colW / 2, ROW * 0.62) - 0.5;
  const cx = (i: number) => plotL + colW * (i + 0.5);
  const cy = (i: number) => TOP + ROW * (i + 0.5);
  const weekIndex = (date: string) => {
    let idx = 0;
    for (let i = 0; i < weeks.length; i++) if (weeks[i]! <= date) idx = i;
    return idx;
  };
  const monthTicks = weeks
    .map((start, i) => ({ i, start }))
    .filter(({ start }, k, all) => k === 0 || start.slice(5, 7) !== all[k - 1]!.start.slice(5, 7));

  const hovered = hover
    ? { lane: lanes[hover.lane]!, lane_i: hover.lane, cell: lanes[hover.lane]!.cells[hover.week]!, week: hover.week }
    : null;

  return (
    <PanelShell title="Projects over time" hint={`your ${lanes.length} biggest projects, week by week, all time`}>
      <Legend
        items={[
          { label: 'mostly Claude that week', color: CLAUDE },
          { label: 'mostly Codex that week', color: CODEX },
        ]}
        style={{ marginBottom: 10 }}
      />
      <div className="scroll-x" style={{ position: 'relative' }}>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          style={{ display: 'block', minWidth: 680 }}
          role="img"
          aria-label="Weekly tokens for each of your biggest projects"
          onMouseLeave={() => setHover(null)}
        >
          {monthTicks.map(({ i, start }) => (
            <g key={start}>
              <line x1={plotL + colW * i} x2={plotL + colW * i} y1={TOP} y2={H - BOTTOM} stroke="var(--color-border)" strokeWidth={1} />
              <text x={plotL + colW * i + 3} y={H - 8} fontSize={10} fill="var(--color-dim)" fontFamily="var(--font-mono)">
                {fmtMonth(start)}
              </text>
            </g>
          ))}
          {lanes.map((lane, li) => {
            const a = weekIndex(lane.first);
            const b = weekIndex(lane.last);
            return (
              <g key={lane.project}>
                <text x={plotL - 10} y={cy(li) + 4} textAnchor="end" fontSize={11} fill="var(--color-text)" fontFamily="var(--font-sans)">
                  {lane.label.length > 28 ? lane.label.slice(0, 27) + '…' : lane.label}
                  <title>{lane.project}</title>
                </text>
                {/* Lifespan: first to last active week. */}
                <line x1={cx(a)} x2={cx(b)} y1={cy(li)} y2={cy(li)} stroke="var(--color-dim)" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" />
                {lane.cells.map((c, wi) => {
                  const v = c.claude + c.codex + c.other;
                  if (v <= 0) return null;
                  const color = c.codex > c.claude && c.codex >= c.other ? CODEX : c.claude >= c.other ? CLAUDE : OTHER;
                  return (
                    <circle
                      key={wi}
                      cx={cx(wi)}
                      cy={cy(li)}
                      r={Math.max(1.5, Math.sqrt(v / maxCell) * rMax)}
                      fill={color}
                      stroke="var(--color-bg)"
                      strokeWidth={1.5}
                    />
                  );
                })}
                <text x={W - 4} y={cy(li) + 4} textAnchor="end" fontSize={11} fill="var(--color-text)" fontFamily="var(--font-mono)">
                  {fmtTokens(lane.total)}
                </text>
                {lane.cells.map((_, wi) => (
                  <rect
                    key={`hit-${wi}`}
                    x={plotL + colW * wi}
                    y={TOP + ROW * li}
                    width={colW}
                    height={ROW}
                    fill="transparent"
                    onMouseEnter={() => setHover({ lane: li, week: wi })}
                  />
                ))}
              </g>
            );
          })}
        </svg>
        {hovered && (
          <div
            style={{
              position: 'absolute',
              pointerEvents: 'none',
              top: `${((TOP + ROW * (hovered.lane_i + 1)) / H) * 100}%`,
              left: `${Math.min(68, ((cx(hovered.week) + 14) / W) * 100)}%`,
            }}
          >
            <TipBox title={`${hovered.lane.label} · week of ${fmtDay(weeks[hovered.week]!)}`} minWidth={170}>
              <TipRow color={CLAUDE} label="Claude" value={fmtTokens(hovered.cell.claude)} />
              <TipRow color={CODEX} label="Codex" value={fmtTokens(hovered.cell.codex)} />
              {hovered.cell.other > 0 && <TipRow color={OTHER} label="Other" value={fmtTokens(hovered.cell.other)} />}
            </TipBox>
          </div>
        )}
      </div>
      <p className="term-eyebrow" style={{ margin: '10px 0 0', textTransform: 'none', letterSpacing: '0.02em' }}>
        Dot size = tokens that week · worktrees count toward their project ·{' '}
        {rest.count > 0 ? `${rest.count} smaller projects (${fmtTokens(rest.total)}) not shown` : 'every project shown'}
      </p>
    </PanelShell>
  );
}
