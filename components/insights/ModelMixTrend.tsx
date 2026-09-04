'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { bucketTrend, pickSeries, prettyModel } from '@/lib/insights/compute';
import { modelLabel, VENDOR_COLOR, VENDOR_LABEL, VENDOR_ORDER, type Vendor } from '@/lib/insights/colors';
import {
  MEASURES,
  OTHER_COLOR,
  SOURCE_COLOR,
  SOURCE_LABEL,
  type Measure,
  type ModelMeta,
  type TrendPoint,
  type WindowKey,
} from '@/lib/insights/types';
import { fmtDuration, fmtInt, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

const WINDOWS: { id: WindowKey; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];
// 90d is drawn as 13 full weeks so the last bucket is never a stub.
const WINDOW_DAYS: Record<WindowKey, number> = { '7d': 7, '30d': 30, '90d': 91 };
const MAX_SERIES = 9;
const MAX_MARKERS = 5;

type SourceOpt = 'all' | string;
type Mode = 'total' | 'share';
const MODES: { id: Mode; label: string; hint: string }[] = [
  { id: 'total', label: 'total', hint: 'absolute values, stacked' },
  { id: 'share', label: 'share', hint: 'each bucket normalized to 100%' },
];

const fmtAxis: Record<Measure, (v: number) => string> = {
  tokens: fmtTokens,
  output: fmtTokens,
  turns: (v) => fmtTokens(v),
  minutes: (v) => `${Math.round(v / 60)}h`,
};
const fmtValue: Record<Measure, (v: number) => string> = {
  tokens: fmtTokens,
  output: fmtTokens,
  turns: (v) => fmtInt(v),
  minutes: (v) => fmtDuration(v),
};

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
  const [mode, setMode] = useState<Mode>('total');
  const [measure, setMeasure] = useState<Measure>('tokens');

  // The 90d view aggregates by week — 90 daily spikes read as noise; 13 weekly
  // bands show the drift. 7d/30d stay daily.
  const weekly = win === '90d';
  const measureMeta = MEASURES.find((m) => m.id === measure)!;

  const sourceOptions = useMemo(
    () => [
      { id: 'all', label: 'all' },
      ...availableSources.map((s) => ({ id: s, label: SOURCE_LABEL[s] ?? s, color: SOURCE_COLOR[s] ?? 'var(--color-dim)' })),
    ],
    [availableSources],
  );

  // Visible layers: the top-N models (by tokens) for the source filter, then
  // re-ordered so each vendor forms one contiguous band in the stack.
  const series = useMemo(() => {
    const allowed = source === 'all' ? models : models.filter((m) => m.source === source);
    const { top, fold } = pickSeries(allowed, MAX_SERIES);
    return { top, fold, hasOther: fold.size > 0 };
  }, [models, source]);

  const data = useMemo(
    () =>
      bucketTrend(points, {
        today,
        days: WINDOW_DAYS[win],
        weekly,
        measure,
        share: mode === 'share',
        series: series.top.map((m) => m.model),
        fold: series.fold,
      }),
    [points, today, win, weekly, measure, mode, series],
  );

  // "First seen" markers — the day a model first appears in the data. Watching
  // a new model take over is the point of this chart. Skips restored history
  // and anything already present on day one of the data.
  const markers = useMemo(() => {
    const dataStart = points[0]?.date;
    if (!dataStart) return [];
    const firstSeen = new Map<string, string>();
    for (const p of points) {
      for (const [model, cell] of Object.entries(p.models)) {
        if (cell.tokens <= 0) continue;
        if (!firstSeen.has(model)) firstSeen.set(model, p.date);
      }
    }
    const rowDates = data.map((r) => r.date as string);
    const visible = new Set(rowDates);
    // Rows are end-of-bucket labeled: the bucket holding d is the first row
    // whose date is >= d.
    const snap = (d: string) => (visible.has(d) ? d : (rowDates.find((rd) => rd >= d) ?? null));
    return series.top
      .filter((m) => m.model !== 'approx-history')
      .slice(0, MAX_MARKERS)
      .map((m) => ({ model: m.model, date: firstSeen.get(m.model) }))
      .filter((m): m is { model: string; date: string } => !!m.date && m.date > dataStart)
      .map((m) => ({ ...m, x: snap(m.date) }))
      .filter((m): m is { model: string; date: string; x: string } => !!m.x);
  }, [points, data, series]);

  const hasData = data.some((row) => ((row.__totalAbs as number) || 0) > 0);

  // Tooltip needs vendor + label per series key.
  const keyMeta = useMemo(() => {
    const m: Record<string, { vendor: Vendor; label: string; color: string }> = {};
    for (const s of series.top) m[s.model] = { vendor: s.vendor, label: modelLabel(s.model, prettyModel), color: s.color };
    m.__other = { vendor: 'other', label: 'other', color: OTHER_COLOR };
    return m;
  }, [series]);

  // Legend grouped by vendor, in stack order.
  const legend = useMemo(() => {
    const groups = new Map<Vendor, ModelMeta[]>();
    for (const m of series.top) groups.set(m.vendor, [...(groups.get(m.vendor) ?? []), m]);
    return VENDOR_ORDER.filter((v) => groups.has(v)).map((v) => ({ vendor: v, models: groups.get(v)! }));
  }, [series]);

  const controls = (
    <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
      <Pills options={MEASURES} value={measure} onChange={setMeasure} ariaLabel="measure" />
      <Pills options={MODES} value={mode} onChange={setMode} ariaLabel="value mode" />
      <Pills options={sourceOptions} value={source} onChange={setSource} ariaLabel="source filter" />
      <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />
    </div>
  );

  return (
    <PanelShell
      title="Model mix"
      hint={`${weekly ? 'weekly' : 'daily'} ${measureMeta.label}${mode === 'share' ? ' · % of total' : ''} · warm = anthropic, cool = openai, grey = xai`}
      right={controls}
    >
      {!hasData ? (
        <EmptyChart />
      ) : (
        <>
          <div style={{ height: 290, marginLeft: -8 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid stroke="var(--color-border)" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={{ stroke: 'var(--color-border)' }}
                  tick={{ fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(d: string) => d.slice(5)}
                  minTickGap={26}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                  tickFormatter={(v: number) => (mode === 'share' ? `${Math.round(v)}%` : fmtAxis[measure](v))}
                  width={46}
                  {...(mode === 'share' ? { domain: [0, 100] as [number, number] } : {})}
                />
                <Tooltip
                  cursor={{ stroke: 'var(--color-dim)', strokeOpacity: 0.5, strokeWidth: 1 }}
                  content={<TrendTooltip mode={mode} measure={measure} keyMeta={keyMeta} />}
                />
                {markers.map((m) => (
                  <ReferenceLine
                    key={m.model}
                    x={m.x}
                    stroke="var(--color-dim-2)"
                    strokeDasharray="3 4"
                    label={{
                      value: modelLabel(m.model, prettyModel),
                      position: 'insideTopLeft',
                      angle: -90,
                      fontSize: 9,
                      fill: 'var(--color-dim)',
                      fontFamily: 'var(--font-mono)',
                      offset: 10,
                    }}
                  />
                ))}
                {series.top.map((m) => (
                  <Area
                    key={m.model}
                    type="linear"
                    dataKey={m.model}
                    name={m.model}
                    stackId="1"
                    stroke={m.color}
                    fill={m.color}
                    fillOpacity={0.55}
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 2.5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                ))}
                {series.hasOther && (
                  <Area
                    type="linear"
                    dataKey="__other"
                    name="__other"
                    stackId="1"
                    stroke={OTHER_COLOR}
                    fill={OTHER_COLOR}
                    fillOpacity={0.4}
                    strokeWidth={1}
                    dot={false}
                    activeDot={{ r: 2.5, strokeWidth: 0 }}
                    isAnimationActive={false}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 12 }}>
            {legend.map((g) => (
              <div key={g.vendor} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px 14px' }}>
                <span
                  className="term-eyebrow"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 82, fontSize: '0.55rem' }}
                >
                  <span aria-hidden style={{ width: 6, height: 6, borderRadius: '50%', background: VENDOR_COLOR[g.vendor] }} />
                  {VENDOR_LABEL[g.vendor]}
                </span>
                {g.models.map((m) => (
                  <LegendChip key={m.model} color={m.color} label={modelLabel(m.model, prettyModel)} />
                ))}
              </div>
            ))}
            {series.hasOther && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <span className="term-eyebrow" style={{ minWidth: 82, fontSize: '0.55rem' }} />
                <LegendChip color={OTHER_COLOR} label={`other (${series.fold.size})`} />
              </div>
            )}
          </div>
          <div className="term-eyebrow" style={{ marginTop: 10, textTransform: 'none', letterSpacing: '0.02em', fontSize: '0.56rem', opacity: 0.8 }}>
            {measureMeta.hint}
            {measure !== 'tokens' && ' · restored history (before per-turn detail) shows as zero'}
          </div>
        </>
      )}
    </PanelShell>
  );
}

function LegendChip({ color, label }: { color: string; label: string }) {
  return (
    <span className="num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.62rem', color: 'var(--color-dim)' }}>
      <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
      {label}
    </span>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 290, display: 'grid', placeItems: 'center', color: 'var(--color-dim)', fontSize: '0.74rem' }}>
      No activity in this window.
    </div>
  );
}

type TooltipItem = { name?: string; value?: number; color?: string; dataKey?: string; payload?: Record<string, number | string> };
function TrendTooltip({
  active,
  payload,
  label,
  mode,
  measure,
  keyMeta,
}: {
  active?: boolean;
  payload?: TooltipItem[];
  label?: string;
  mode: Mode;
  measure: Measure;
  keyMeta: Record<string, { vendor: Vendor; label: string; color: string }>;
}) {
  if (!active || !payload?.length) return null;
  const items = payload
    .filter((p) => typeof p.value === 'number' && p.value > 0)
    .sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
  const totalAbs = Number(payload[0]?.payload?.__totalAbs ?? 0);
  const fmt = (v: number) => (mode === 'share' ? `${v.toFixed(1)}%` : fmtValue[measure](v));

  const byVendor = new Map<Vendor, number>();
  for (const p of items) {
    const v = keyMeta[String(p.dataKey)]?.vendor ?? 'other';
    byVendor.set(v, (byVendor.get(v) ?? 0) + (p.value ?? 0));
  }
  const vendors = VENDOR_ORDER.filter((v) => byVendor.has(v));

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
        minWidth: 170,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>{label}</div>
      {items.map((p, i) => {
        const meta = keyMeta[String(p.dataKey)];
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: meta?.color ?? p.color }} />
            <span style={{ color: 'var(--color-dim)' }}>{meta?.label ?? p.name}</span>
            <span style={{ marginLeft: 'auto' }}>{fmt(p.value ?? 0)}</span>
          </div>
        );
      })}
      {vendors.length > 1 && (
        <div style={{ marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--color-border)' }}>
          {vendors.map((v) => (
            <div key={v} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
              <span aria-hidden style={{ width: 7, height: 7, borderRadius: '50%', background: VENDOR_COLOR[v] }} />
              <span style={{ color: 'var(--color-dim)' }}>{VENDOR_LABEL[v]}</span>
              <span style={{ marginLeft: 'auto' }}>{fmt(byVendor.get(v) ?? 0)}</span>
            </div>
          ))}
        </div>
      )}
      <div style={{ display: 'flex', gap: 7, marginTop: 5, paddingTop: 5, borderTop: '1px solid var(--color-border)' }}>
        <span style={{ color: 'var(--color-dim)' }}>total</span>
        <span style={{ marginLeft: 'auto' }}>{fmtValue[measure](totalAbs)}</span>
      </div>
    </div>
  );
}
