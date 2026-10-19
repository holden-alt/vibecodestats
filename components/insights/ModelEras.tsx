'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtTokens } from '@/lib/insights/format';
import type { ModelWeeks } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';
import { AXIS_TICK, fmtDay, TipBox, TipRow } from './chartBits';

type Mode = 'tokens' | 'share';
const MODES: { id: Mode; label: string }[] = [
  { id: 'tokens', label: 'tokens' },
  { id: 'share', label: 'share' },
];
const LIST_COLLAPSED = 10;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function span(first: string, last: string): string {
  const m = (d: string) => MONTHS[Number(d.slice(5, 7)) - 1];
  return first.slice(0, 7) === last.slice(0, 7) ? fmtDay(first) : `${m(first)}–${m(last)}`;
}

/** Every model you have used, week by week since the first tracked day, plus
 *  the all-time list. Stacked in the order models arrived, so it reads as eras. */
export function ModelEras({ data }: { data: ModelWeeks }) {
  const [mode, setMode] = useState<Mode>('tokens');
  const [showAll, setShowAll] = useState(false);
  const { weeks, stack, list } = data;
  if (weeks.length === 0) return null;

  const rows = weeks.map((w) => {
    const total = Object.values(w.values).reduce((a, b) => a + b, 0);
    const row: Record<string, number | string | boolean> = { start: w.start, partial: w.partial, total };
    for (const m of stack) {
      const v = w.values[m.model] ?? 0;
      row[m.model] = mode === 'share' ? (total > 0 ? (v / total) * 100 : 0) : v;
    }
    return row;
  });
  const grand = list.reduce((a, m) => a + m.total, 0);
  const visible = showAll ? list : list.slice(0, LIST_COLLAPSED);

  return (
    <PanelShell
      title="Models over time"
      hint="every model, week by week, all time"
      right={<Pills options={MODES} value={mode} onChange={setMode} ariaLabel="measure" />}
    >
      <div style={{ height: 260, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={rows} margin={{ left: 4, right: 22, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="start" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} tick={AXIS_TICK} tickFormatter={fmtDay} minTickGap={36} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={AXIS_TICK}
              width={52}
              {...(mode === 'share'
                ? { domain: [0, 100], ticks: [0, 50, 100], tickFormatter: (v: number) => `${v}%` }
                : { tickFormatter: (v: number) => fmtTokens(v) })}
            />
            <Tooltip cursor={{ stroke: 'var(--color-dim)', strokeOpacity: 0.5, strokeWidth: 1 }} content={<ErasTip stack={stack} mode={mode} />} />
            {stack.map((m) => (
              <Area
                key={m.model}
                type="monotone"
                dataKey={m.model}
                name={m.label}
                stackId="models"
                stroke="var(--color-bg)"
                strokeWidth={1}
                fill={m.color}
                fillOpacity={0.9}
                isAnimationActive={false}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="term-eyebrow" style={{ margin: '16px 0 8px' }}>
        all-time list · {list.length} models · {fmtTokens(grand)}
      </div>
      <ol
        style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 300px), 1fr))',
          columnGap: 24,
          rowGap: 2,
        }}
      >
        {visible.map((m, i) => (
          <li
            key={m.model}
            className="num"
            style={{ display: 'grid', gridTemplateColumns: '22px 10px minmax(0, 1fr) auto auto', alignItems: 'center', gap: 8, fontSize: '0.68rem', padding: '3px 0' }}
          >
            <span style={{ color: 'var(--color-dim-2)' }}>{i + 1}</span>
            <span aria-hidden style={{ width: 9, height: 9, borderRadius: 2, background: m.color }} />
            <span style={{ color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={m.label}>
              {m.label}
            </span>
            <span style={{ color: 'var(--color-dim)' }}>{span(m.first, m.last)}</span>
            <span style={{ color: 'var(--color-text)', minWidth: 56, textAlign: 'right' }}>{fmtTokens(m.total)}</span>
          </li>
        ))}
      </ol>
      {list.length > LIST_COLLAPSED && (
        <button
          type="button"
          onClick={() => setShowAll((v) => !v)}
          className="term-eyebrow"
          style={{ marginTop: 10, background: 'none', border: '1px solid var(--color-border)', borderRadius: 3, padding: '5px 10px', cursor: 'pointer' }}
        >
          {showAll ? 'show top 10' : `show all ${list.length} models`}
        </button>
      )}
    </PanelShell>
  );
}

type Row = Record<string, number | string | boolean>;
function ErasTip({
  active,
  payload,
  stack,
  mode,
}: {
  active?: boolean;
  payload?: { payload?: Row }[];
  stack: ModelWeeks['stack'];
  mode: Mode;
}) {
  const row = payload?.[0]?.payload;
  if (!active || !row) return null;
  const items = stack
    .map((m) => ({ m, v: Number(row[m.model] ?? 0) }))
    .filter((x) => x.v > 0)
    .sort((a, b) => b.v - a.v);
  return (
    <TipBox title={`week of ${fmtDay(String(row.start))}${row.partial ? ' (so far)' : ''} · ${fmtTokens(Number(row.total))}`} minWidth={190}>
      {items.length === 0 && <div style={{ color: 'var(--color-dim)' }}>no usage</div>}
      {items.map(({ m, v }) => (
        <TipRow key={m.model} color={m.color} label={m.label} value={mode === 'share' ? `${Math.round(v)}%` : fmtTokens(v)} />
      ))}
    </TipBox>
  );
}
