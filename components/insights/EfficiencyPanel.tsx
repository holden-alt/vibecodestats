'use client';

import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { windowStart } from '@/lib/insights/compute';
import { SOURCE_COLOR, SOURCE_LABEL, type EfficiencyPoint, type WindowKey } from '@/lib/insights/types';
import { fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

const WINDOWS: { id: WindowKey; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];
const WINDOW_DAYS: Record<WindowKey, number> = { '7d': 7, '30d': 30, '90d': 90 };

// Efficiency — how the tokens behave, not how many. Cache hit rate (how much of
// the input the models re-read from cache) and tokens per turn (leash length —
// how much work one turn does). Derived from real rows only, so the lines start
// where the class/turn detail starts, not at the beginning of restored history.
export function EfficiencyPanel({ points }: { points: EfficiencyPoint[] }) {
  const [win, setWin] = useState<WindowKey>('30d');

  const sources = useMemo(() => {
    const seen = new Set<string>();
    for (const p of points) if (p.cacheRate != null || p.tokensPerTurn != null) seen.add(p.source);
    return [...seen].sort();
  }, [points]);

  // Calendar-complete rows per metric: {date, [source]: value|null}.
  const { cacheRows, turnRows } = useMemo(() => {
    const start = windowStart(latestDate(points), WINDOW_DAYS[win]);
    const cache = new Map<string, Record<string, number | string | null>>();
    const turn = new Map<string, Record<string, number | string | null>>();
    for (const p of points) {
      if (p.date < start) continue;
      if (p.cacheRate != null) {
        const row = cache.get(p.date) ?? { date: p.date };
        row[p.source] = p.cacheRate * 100;
        cache.set(p.date, row);
      }
      if (p.tokensPerTurn != null) {
        const row = turn.get(p.date) ?? { date: p.date };
        row[p.source] = p.tokensPerTurn;
        turn.set(p.date, row);
      }
    }
    const toRows = (m: Map<string, Record<string, number | string | null>>) =>
      [...m.values()].sort((a, b) => ((a.date as string) < (b.date as string) ? -1 : 1));
    return { cacheRows: toRows(cache), turnRows: toRows(turn) };
  }, [points, win]);

  if (sources.length === 0) return null;

  return (
    <PanelShell
      title="Efficiency"
      hint="cache hit rate · tokens per turn"
      right={<Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />}
    >
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 18 }}>
        <MetricChart
          title="cache hit rate"
          rows={cacheRows}
          sources={sources}
          yFmt={(v) => `${Math.round(v)}%`}
          yDomain={[0, 100]}
          tipFmt={(v) => `${v.toFixed(1)}%`}
        />
        <MetricChart
          title="tokens per turn"
          rows={turnRows}
          sources={sources}
          yFmt={(v) => fmtTokens(v)}
          tipFmt={(v) => fmtTokens(v)}
        />
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 12 }}>
        {sources.map((s) => (
          <span
            key={s}
            className="num"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.62rem', color: 'var(--color-dim)' }}
          >
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: SOURCE_COLOR[s] ?? 'var(--color-dim)' }} />
            {SOURCE_LABEL[s] ?? s}
          </span>
        ))}
      </div>
    </PanelShell>
  );
}

function latestDate(points: EfficiencyPoint[]): string {
  let latest = '';
  for (const p of points) if (p.date > latest) latest = p.date;
  return latest || new Date().toISOString().slice(0, 10);
}

function MetricChart({
  title,
  rows,
  sources,
  yFmt,
  yDomain,
  tipFmt,
}: {
  title: string;
  rows: Record<string, number | string | null>[];
  sources: string[];
  yFmt: (v: number) => string;
  yDomain?: [number, number];
  tipFmt: (v: number) => string;
}) {
  return (
    <div>
      <div className="term-eyebrow" style={{ marginBottom: 6 }}>
        {title}
      </div>
      {rows.length === 0 ? (
        <div style={{ height: 160, display: 'grid', placeItems: 'center', color: 'var(--color-dim)', fontSize: '0.68rem' }}>
          No detail in this window.
        </div>
      ) : (
        <div style={{ height: 160, marginLeft: -8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rows} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                tick={{ fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                tickFormatter={(d: string) => d.slice(5)}
                minTickGap={30}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                tickFormatter={yFmt}
                width={44}
                {...(yDomain ? { domain: yDomain } : {})}
              />
              <Tooltip
                cursor={{ stroke: 'var(--color-dim)', strokeOpacity: 0.5, strokeWidth: 1 }}
                content={<MetricTooltip fmt={tipFmt} />}
              />
              {sources.map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={SOURCE_LABEL[s] ?? s}
                  stroke={SOURCE_COLOR[s] ?? 'var(--color-dim)'}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 2.5, strokeWidth: 0 }}
                  connectNulls={false}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

type TipItem = { name?: string; value?: number; color?: string };
function MetricTooltip({
  active,
  payload,
  label,
  fmt,
}: {
  active?: boolean;
  payload?: TipItem[];
  label?: string;
  fmt: (v: number) => string;
}) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => typeof p.value === 'number');
  if (!items.length) return null;
  return (
    <div
      className="num"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 3,
        padding: '7px 9px',
        fontSize: '0.64rem',
        color: 'var(--color-text)',
        minWidth: 130,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>{label}</div>
      {items.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />
          <span style={{ color: 'var(--color-dim)' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto' }}>{fmt(p.value ?? 0)}</span>
        </div>
      ))}
    </div>
  );
}
