'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
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
const MAX_MARKERS = 5;

type SourceOpt = 'all' | string;
type Mode = 'tokens' | 'share';
const MODES: { id: Mode; label: string }[] = [
  { id: 'tokens', label: 'tokens' },
  { id: 'share', label: 'share' },
];

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
  const [win, setWin] = useState<WindowKey>('90d');
  const [source, setSource] = useState<SourceOpt>('all');
  const [mode, setMode] = useState<Mode>('tokens');

  // The 90d view aggregates by week — 90 daily spikes read as noise; 13 weekly
  // bands show the drift. 7d/30d stay daily.
  const weekly = win === '90d';

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

  // Calendar-complete, zero-filled rows for recharts (see 2026-07 fix notes:
  // recharts leaves holes + compresses skipped days otherwise). Weekly view
  // sums the zero-filled days into 7-day buckets anchored at the window start;
  // share mode then normalizes each row to percentages (raw total kept on
  // __totalAbs for the tooltip footer).
  const data = useMemo(() => {
    const earliest = points[0]?.date; // points are sorted ascending upstream
    let start = windowStart(today, WINDOW_DAYS[win]);
    if (earliest && earliest > start) start = earliest;

    const byDate = new Map(points.map((p) => [p.date, p.models]));
    const keys = [...series.top.map((m) => m.model), ...(series.hasOther ? ['__other'] : [])];

    const rows: Record<string, number | string>[] = [];
    const cur = new Date(start + 'T00:00:00Z');
    const end = new Date(today + 'T00:00:00Z');
    let bucketRow: Record<string, number | string> | null = null;
    let dayIdx = 0;
    while (cur <= end) {
      const date = cur.toISOString().slice(0, 10);
      if (!weekly || dayIdx % 7 === 0) {
        bucketRow = { date };
        for (const k of keys) bucketRow[k] = 0;
        rows.push(bucketRow);
      }
      const dayModels = byDate.get(date) ?? {};
      for (const [model, tok] of Object.entries(dayModels)) {
        if (!series.allowedSet.has(model)) continue;
        const k = series.otherSet.has(model) ? '__other' : model;
        if (k === '__other' && !series.hasOther) continue;
        bucketRow![k] = ((bucketRow![k] as number) ?? 0) + tok;
      }
      cur.setUTCDate(cur.getUTCDate() + 1);
      dayIdx++;
    }

    for (const row of rows) {
      const total = keys.reduce((acc, k) => acc + ((row[k] as number) || 0), 0);
      row.__totalAbs = total;
      if (mode === 'share' && total > 0) {
        for (const k of keys) row[k] = (((row[k] as number) || 0) / total) * 100;
      }
    }
    return rows;
  }, [points, today, win, series, weekly, mode]);

  // "First seen" markers — the day a model first appears in the data. Watching
  // a new model take over is the point of this chart. Skips synthetic history
  // and anything that was already present on day one of the data.
  const markers = useMemo(() => {
    const dataStart = points[0]?.date;
    if (!dataStart) return [];
    const firstSeen = new Map<string, string>();
    for (const p of points) {
      for (const [model, tok] of Object.entries(p.models)) {
        if (tok <= 0) continue;
        if (!firstSeen.has(model)) firstSeen.set(model, p.date);
      }
    }
    const visibleDates = new Set(data.map((r) => r.date as string));
    const sortedRowDates = data.map((r) => r.date as string);
    const snap = (d: string) => {
      if (visibleDates.has(d)) return d;
      // weekly buckets: snap to the bucket containing d
      let best: string | null = null;
      for (const rd of sortedRowDates) {
        if (rd <= d) best = rd;
        else break;
      }
      return best;
    };
    return series.top
      .filter((m) => m.model !== 'approx-history')
      .slice(0, MAX_MARKERS)
      .map((m) => ({ model: m.model, date: firstSeen.get(m.model) }))
      .filter((m): m is { model: string; date: string } => !!m.date && m.date > dataStart)
      .map((m) => ({ ...m, x: snap(m.date) }))
      .filter((m): m is { model: string; date: string; x: string } => !!m.x);
  }, [points, data, series]);

  const hasData = data.some((row) => ((row.__totalAbs as number) || 0) > 0);

  const controls = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Pills options={MODES} value={mode} onChange={setMode} ariaLabel="value mode" />
      <Pills options={sourceOptions} value={source} onChange={setSource} ariaLabel="source filter" />
      <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />
    </div>
  );

  return (
    <PanelShell
      title="Model mix"
      hint={`${weekly ? 'weekly' : 'daily'} tokens, stacked by model${mode === 'share' ? ' · % of total' : ''}`}
      right={controls}
    >
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
                  tickFormatter={(v: number) => (mode === 'share' ? `${Math.round(v)}%` : fmtTokens(v))}
                  width={46}
                  {...(mode === 'share' ? { domain: [0, 100] as [number, number] } : {})}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--color-orange)', strokeOpacity: 0.4, strokeWidth: 1 }}
                  content={<TrendTooltip mode={mode} />}
                />
                {markers.map((m) => (
                  <ReferenceLine
                    key={m.model}
                    x={m.x}
                    stroke="var(--color-dim)"
                    strokeDasharray="3 4"
                    label={{
                      value: prettyModel(m.model),
                      position: 'insideTopLeft',
                      angle: -90,
                      fontSize: 9,
                      fill: 'var(--color-dim)',
                      offset: 10,
                    }}
                  />
                ))}
                {series.top.map((m) => (
                  <Area
                    key={m.model}
                    type="linear"
                    dataKey={m.model}
                    name={prettyModel(m.model)}
                    stackId="1"
                    stroke={m.color}
                    fill={m.color}
                    fillOpacity={0.32}
                    strokeWidth={1.25}
                    dot={false}
                    activeDot={{ r: 2.5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
                {series.hasOther && (
                  <Area
                    type="linear"
                    dataKey="__other"
                    name="other"
                    stackId="1"
                    stroke={OTHER_COLOR}
                    fill={OTHER_COLOR}
                    fillOpacity={0.22}
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 2.5, strokeWidth: 0 }}
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

type TooltipItem = { name?: string; value?: number; color?: string; dataKey?: string; payload?: Record<string, number | string> };
function TrendTooltip({
  active,
  payload,
  label,
  mode,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  mode?: Mode;
}) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter((p) => typeof p.value === 'number' && p.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const totalAbs = Number(payload[0]?.payload?.__totalAbs ?? 0);
  const fmt = (v: number) => (mode === 'share' ? `${v.toFixed(1)}%` : fmtTokens(v));
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
          <span style={{ marginLeft: 'auto' }}>{fmt(p.value ?? 0)}</span>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 7, marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--color-border)' }}>
        <span style={{ color: 'var(--color-dim)' }}>total</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-orange)' }}>{fmtTokens(totalAbs)}</span>
      </div>
    </div>
  );
}
