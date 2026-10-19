'use client';

import { useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { VENDOR_COLOR } from '@/lib/insights/colors';
import { fmtTokens } from '@/lib/insights/format';
import type { Grain, VendorPoint } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';
import { AXIS_TICK, fmtDay, fmtMonth, Legend, TipBox, TipRow } from './chartBits';

const GRAINS: { id: Grain; label: string }[] = [
  { id: 'day', label: 'day' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
];
const TOTAL = 'var(--color-text)';
const CLAUDE = VENDOR_COLOR.anthropic;
const CODEX = VENDOR_COLOR.openai;

function bucketLabel(p: VendorPoint, grain: Grain): string {
  if (grain === 'day') return fmtDay(p.start);
  if (grain === 'week') return `week of ${fmtDay(p.start)}`;
  return fmtMonth(p.start, true);
}

/** All-time tokens: total, Claude, and Codex, by day, week, or month. */
export function TokenTimeline({
  byGrain,
  lifetime,
  since,
}: {
  byGrain: Record<Grain, VendorPoint[]>;
  lifetime: number;
  since: string | null;
}) {
  const [grain, setGrain] = useState<Grain>('week');
  const rows = byGrain[grain];
  const best = rows.reduce<VendorPoint | null>((b, p) => (!b || p.total > b.total ? p : b), null);

  return (
    <PanelShell
      title="Tokens over time"
      hint={since ? `all time · ${fmtTokens(lifetime)} since ${fmtDay(since)}` : 'all time'}
      right={<Pills options={GRAINS} value={grain} onChange={setGrain} ariaLabel="group by" />}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}>
        <Legend
          items={[
            { label: 'Total', color: TOTAL, line: true },
            { label: 'Claude', color: CLAUDE, line: true },
            { label: 'Codex', color: CODEX, line: true },
          ]}
        />
        {best && (
          <span className="num" style={{ fontSize: '0.64rem', color: 'var(--color-dim)' }}>
            best {grain} · <span style={{ color: 'var(--color-text)' }}>{fmtTokens(best.total)}</span> ·{' '}
            {grain === 'month' ? fmtMonth(best.start, true) : fmtDay(best.start)}
          </span>
        )}
      </div>
      <div style={{ height: 260, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ left: 4, right: 22, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="start"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tick={AXIS_TICK}
              tickFormatter={(d: string) => (grain === 'month' ? fmtMonth(d) : fmtDay(d))}
              minTickGap={grain === 'month' ? 8 : 36}
            />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(v: number) => fmtTokens(v)} width={52} />
            <Tooltip
              cursor={{ stroke: 'var(--color-dim)', strokeOpacity: 0.5, strokeWidth: 1 }}
              content={<TimelineTip grain={grain} />}
            />
            <Line type="monotone" dataKey="claude" name="Claude" stroke={CLAUDE} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-bg)' }} isAnimationActive={false} />
            <Line type="monotone" dataKey="codex" name="Codex" stroke={CODEX} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-bg)' }} isAnimationActive={false} />
            <Line type="monotone" dataKey="total" name="Total" stroke={TOTAL} strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--color-bg)' }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {rows.at(-1)?.partial && (
        <div className="term-eyebrow" style={{ textTransform: 'none', letterSpacing: '0.02em', marginTop: 6 }}>
          The last {grain} is still in progress.
        </div>
      )}
    </PanelShell>
  );
}

function TimelineTip({ active, payload, grain }: { active?: boolean; payload?: { payload?: VendorPoint }[]; grain: Grain }) {
  const p = payload?.[0]?.payload;
  if (!active || !p) return null;
  return (
    <TipBox title={`${bucketLabel(p, grain)}${p.partial ? ' (so far)' : ''}`}>
      <TipRow color={TOTAL} label="Total" value={fmtTokens(p.total)} />
      <TipRow color={CLAUDE} label="Claude" value={fmtTokens(p.claude)} />
      <TipRow color={CODEX} label="Codex" value={fmtTokens(p.codex)} />
      {p.other > 0 && <TipRow label="Other" value={fmtTokens(p.other)} />}
      {p.codexShare != null && <TipRow label="Codex share" value={`${Math.round(p.codexShare * 100)}%`} />}
    </TipBox>
  );
}
