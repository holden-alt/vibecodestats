'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { prettyModel, windowStart } from '@/lib/insights/compute';
import { OTHER_COLOR, SOURCE_COLOR, SOURCE_LABEL, type ModelMeta, type TrendPoint, type WindowKey } from '@/lib/insights/types';
import { fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

const WINDOWS: { id: WindowKey; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];
const WINDOW_DAYS: Record<WindowKey, number> = { '7d': 7, '30d': 30, '90d': 90 };
const MAX_SERIES = 8;

type SourceOpt = 'all' | string;

export function ModelMixTrend({
  points,
  models,
  today,
  availableSources,
}: {
  points: TrendPoint[];
  models: ModelMeta[];
  today: string;
  availableSources: string[];
}) {
  const [win, setWin] = useState<WindowKey>('30d');
  const [source, setSource] = useState<SourceOpt>('all');

  const sourceOptions = useMemo(
    () => [
      { id: 'all', label: 'all' },
      ...availableSources.map((s) => ({ id: s, label: SOURCE_LABEL[s] ?? s, color: SOURCE_COLOR[s] ?? 'var(--color-dim)' })),
    ],
    [availableSources],
  );

  // Which model series are visible for the current source filter.
  const series = useMemo(() => {
    const allowed = source === 'all' ? models : models.filter((m) => m.source === source);
    const top = allowed.slice(0, MAX_SERIES);
    const otherSet = new Set(allowed.slice(MAX_SERIES).map((m) => m.model));
    const allowedSet = new Set(allowed.map((m) => m.model));
    return { top, otherSet, allowedSet, hasOther: otherSet.size > 0 };
  }, [models, source]);

  // Windowed, flattened rows for recharts (one numeric key per visible model + `other`).
  const data = useMemo(() => {
    const start = windowStart(today, WINDOW_DAYS[win]);
    return points
      .filter((p) => p.date >= start && p.date <= today)
      .map((p) => {
        const row: Record<string, number | string> = { date: p.date };
        let other = 0;
        for (const [model, tok] of Object.entries(p.models)) {
          if (!series.allowedSet.has(model)) continue;
          if (series.otherSet.has(model)) other += tok;
          else row[model] = tok;
        }
        if (series.hasOther) row.__other = other;
        return row;
      });
  }, [points, today, win, series]);

  const hasData = data.some((row) =>
    Object.entries(row).some(([k, v]) => k !== 'date' && typeof v === 'number' && v > 0),
  );

  const controls = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Pills options={sourceOptions} value={source} onChange={setSource} ariaLabel="source filter" />
      <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />
    </div>
  );

  return (
    <PanelShell title="Model mix" hint="daily tokens, stacked by model" right={controls}>
      {!hasData ? (
        <EmptyChart />
      ) : (
        <>
          <div style={{ height: 240, marginLeft: -8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={26}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
                  tickFormatter={(v: number) => fmtTokens(v)}
                  width={46}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--color-orange)', strokeOpacity: 0.4, strokeWidth: 1 }}
                  content={<TrendTooltip />}
                />
                {series.top.map((m) => (
                  <Area
                    key={m.model}
                    type="monotone"
                    dataKey={m.model}
                    name={prettyModel(m.model)}
                    stackId="1"
                    stroke={m.color}
                    fill={m.color}
                    fillOpacity={0.28}
                    strokeWidth={1.4}
                    isAnimationActive={false}
                  />
                ))}
                {series.hasOther && (
                  <Area
                    type="monotone"
                    dataKey="__other"
                    name="other"
                    stackId="1"
                    stroke={OTHER_COLOR}
                    fill={OTHER_COLOR}
                    fillOpacity={0.2}
                    strokeWidth={1}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px 14px', marginTop: 12 }}>
            {series.top.map((m) => (
              <LegendChip key={m.model} color={m.color} label={prettyModel(m.model)} />
            ))}
            {series.hasOther && <LegendChip color={OTHER_COLOR} label="other" />}
          </div>
        </>
      )}
    </PanelShell>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.62rem', color: 'var(--color-dim)' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 240, display: 'grid', placeItems: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
      No token activity in this window.
    </div>
  );
}

type TooltipItem = { name?: string; value?: number; color?: string; dataKey?: string };
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter((p) => typeof p.value === 'number' && p.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const total = items.reduce((acc, p) => acc + (p.value ?? 0), 0);
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 3,
        padding: '7px 9px',
        fontFamily: 'var(--font-mono)',
        fontSize: '0.64rem',
        color: 'var(--color-text)',
        fontVariantNumeric: 'tabular-nums',
        minWidth: 150,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>{label}</div>
      {items.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />
          <span style={{ color: 'var(--color-dim)' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto' }}>{fmtTokens(p.value ?? 0)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 7, marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--color-border)' }}>
        <span style={{ color: 'var(--color-dim)' }}>total</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-orange)' }}>{fmtTokens(total)}</span>
      </div>
    </div>
  );
}
