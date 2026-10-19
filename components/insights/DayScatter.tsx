'use client';

import { useMemo, useState } from 'react';
import {
  CartesianGrid,
  Cell,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from 'recharts';
import { inWindow } from '@/lib/insights/compute';
import { VENDOR_COLOR } from '@/lib/insights/colors';
import { fmtTokens } from '@/lib/insights/format';
import type { VendorDay } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';
import { AXIS_TICK, fmtDay, Legend, TipBox, TipRow } from './chartBits';

type Win = '30d' | '90d' | 'all';
const WINDOWS: { id: Win; label: string }[] = [
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'all' },
];
const WIN_DAYS: Record<Exclude<Win, 'all'>, number> = { '30d': 30, '90d': 90 };
const CLAUDE = VENDOR_COLOR.anthropic;
const CODEX = VENDOR_COLOR.openai;

/** Compact tick: 2B, 500M, 125M, 0. */
function fmtTick(v: number): string {
  if (v >= 1e9) return `${+(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${Math.round(v / 1e6)}M`;
  return v === 0 ? '0' : fmtTokens(v);
}

/** Round an axis max up to a clean 1/2/5 step so both axes share one scale. */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 2, 2.5, 5, 10]) if (v <= step * mag) return step * mag;
  return 10 * mag;
}

/** Every day as one dot: Claude tokens across, Codex tokens up. Above the
 *  diagonal, Codex did more of the work that day; below it, Claude did. */
export function DayScatter({ days, today }: { days: VendorDay[]; today: string }) {
  const [win, setWin] = useState<Win>('all');

  const { pts, max, todayPt } = useMemo(() => {
    const pts = days
      .filter((d) => d.claude + d.codex > 0)
      .filter((d) => win === 'all' || inWindow(d.date, today, WIN_DAYS[win]))
      .map((d) => ({ date: d.date, claude: d.claude, codex: d.codex }));
    const max = niceMax(Math.max(0, ...pts.map((p) => Math.max(p.claude, p.codex))));
    return { pts, max, todayPt: pts.find((p) => p.date === today) ?? null };
  }, [days, today, win]);

  const codexDays = pts.filter((p) => p.codex > p.claude).length;
  // Square-root axes: most days are small, a few are huge. The same transform on
  // both axes keeps the even-split diagonal a straight line. Ticks sit at even
  // steps in root space: 0, ¼, ½, 1 of the way across.
  const ticks = [0, max / 16, max / 4, max];

  return (
    <PanelShell
      title="Every day, Claude vs. Codex"
      hint="one dot per day · √ scale"
      right={<Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <Legend
          items={[
            { label: 'Claude-heavy day', color: CLAUDE },
            { label: 'Codex-heavy day', color: CODEX },
          ]}
        />
        {pts.length > 0 && (
          <span className="num" style={{ fontSize: '0.64rem', color: 'var(--color-dim)' }}>
            Codex led <span style={{ color: 'var(--color-text)' }}>{codexDays}</span> of {pts.length} days
          </span>
        )}
      </div>
      <div style={{ height: 300, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ScatterChart margin={{ left: 14, right: 18, top: 8, bottom: 14 }}>
            <CartesianGrid stroke="var(--color-border)" />
            <XAxis
              type="number"
              dataKey="claude"
              name="Claude"
              scale="sqrt"
              domain={[0, max]}
              ticks={ticks}
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tick={AXIS_TICK}
              tickFormatter={fmtTick}
              label={{ value: 'Claude tokens', position: 'insideBottom', offset: -10, fill: 'var(--color-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            />
            <YAxis
              type="number"
              dataKey="codex"
              name="Codex"
              scale="sqrt"
              domain={[0, max]}
              ticks={ticks}
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              tickFormatter={fmtTick}
              width={44}
              label={{ value: 'Codex tokens', angle: -90, position: 'left', offset: 2, fill: 'var(--color-dim)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
            />
            <ZAxis range={[44, 44]} />
            <ReferenceLine
              segment={[
                { x: 0, y: 0 },
                { x: max, y: max },
              ]}
              stroke="var(--color-text)"
              strokeOpacity={0.45}
              strokeWidth={1}
              label={{ value: 'even split', position: 'insideTopRight', fill: 'var(--color-text)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              ifOverflow="hidden"
            />
            <Tooltip cursor={false} content={<DayTip />} />
            <Scatter data={pts} isAnimationActive={false} stroke="var(--color-bg)" strokeWidth={1.5}>
              {pts.map((p) => (
                <Cell key={p.date} fill={p.codex > p.claude ? CODEX : CLAUDE} fillOpacity={0.85} />
              ))}
            </Scatter>
            {todayPt && (
              <Scatter
                data={[todayPt]}
                isAnimationActive={false}
                fill="var(--color-text)"
                stroke="var(--color-bg)"
                strokeWidth={2}
                shape="diamond"
              >
                <LabelList
                  dataKey="date"
                  position="right"
                  offset={8}
                  formatter={() => 'today'}
                  fill="var(--color-text)"
                  fontSize={10}
                  fontFamily="var(--font-mono)"
                />
              </Scatter>
            )}
          </ScatterChart>
        </ResponsiveContainer>
      </div>
    </PanelShell>
  );
}

type Pt = { date: string; claude: number; codex: number };
function DayTip({ active, payload }: { active?: boolean; payload?: { payload?: Pt }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  const lead = p.codex > p.claude ? 'Codex' : 'Claude';
  const lo = Math.min(p.claude, p.codex);
  const ratio = lo > 0 ? `${lead} ${(Math.max(p.claude, p.codex) / lo).toFixed(1)}×` : `${lead} only`;
  return (
    <TipBox title={fmtDay(p.date) + ` · ${p.date.slice(0, 4)}`}>
      <TipRow color={CLAUDE} label="Claude" value={fmtTokens(p.claude)} />
      <TipRow color={CODEX} label="Codex" value={fmtTokens(p.codex)} />
      <TipRow label="Split" value={ratio} />
    </TipBox>
  );
}
