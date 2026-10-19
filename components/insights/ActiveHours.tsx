'use client';

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { VENDOR_COLOR } from '@/lib/insights/colors';
import type { ActiveWeek } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { AXIS_TICK, fmtDay, Legend, TipBox, TipRow } from './chartBits';

const SERIES = [
  { key: 'claudeOnly', label: 'Claude only', color: VENDOR_COLOR.anthropic },
  { key: 'both', label: 'both at once', color: '#d6d0c4' },
  { key: 'codexOnly', label: 'Codex only', color: VENDOR_COLOR.openai },
  { key: 'other', label: 'other tools', color: '#6b665f' },
] as const;

/** Your time per week (deep work), split by which tools were running.
 *  "Both at once" is parallel work: Claude and Codex in the same hour. */
export function ActiveHours({ weeks, perDay30, perDayAll }: { weeks: ActiveWeek[]; perDay30: number; perDayAll: number }) {
  if (weeks.length === 0) return null;
  const shown = SERIES.filter((s) => weeks.some((w) => w[s.key] > 0));
  const full = weeks.filter((w) => !w.partial);
  const best = full.reduce<ActiveWeek | null>((b, w) => (!b || w.total > b.total ? w : b), null);
  const recent = weeks.slice(-5);
  const bothShare = recent.reduce((a, w) => a + w.both, 0) / Math.max(1e-9, recent.reduce((a, w) => a + w.total, 0));
  const h = (v: number) => `${v.toFixed(1)}h`;

  return (
    <PanelShell title="Your time" hint="deep work per week, split by which tool was running">
      <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', marginBottom: 14 }}>
        <Stat value={h(perDay30)} label="a day · last 30 days" />
        <Stat value={h(perDayAll)} label="a day · all time" />
        {best && <Stat value={`${Math.round(best.total)}h`} label={`busiest week · ${fmtDay(best.start)}`} />}
        <Stat value={`${Math.round(bothShare * 100)}%`} label="of recent time ran both tools" />
      </div>
      <Legend items={shown.map((s) => ({ label: s.label, color: s.color }))} style={{ marginBottom: 8 }} />
      <div style={{ height: 220, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={weeks} margin={{ left: 4, right: 22, top: 8, bottom: 0 }} barCategoryGap={3}>
            <CartesianGrid stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="start" tickLine={false} axisLine={{ stroke: 'var(--color-border)' }} tick={AXIS_TICK} tickFormatter={fmtDay} minTickGap={36} />
            <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} width={40} tickFormatter={(v: number) => `${Math.round(v)}h`} />
            <Tooltip cursor={{ fill: 'var(--color-text)', fillOpacity: 0.05 }} content={<HoursTip />} />
            {shown.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="hours"
                fill={s.color}
                stroke="var(--color-bg)"
                strokeWidth={1}
                maxBarSize={24}
                radius={i === shown.length - 1 ? [3, 3, 0, 0] : 0}
                isAnimationActive={false}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="term-eyebrow" style={{ margin: '10px 0 0', textTransform: 'none', letterSpacing: '0.02em' }}>
        Deep work counts continuous stretches of activity (breaks under 15 minutes keep a stretch going). The split
        follows which tools were running in those hours.
      </p>
    </PanelShell>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div style={{ fontSize: '1.35rem', fontWeight: 600, lineHeight: 1.1 }}>{value}</div>
      <div className="term-eyebrow" style={{ marginTop: 4 }}>
        {label}
      </div>
    </div>
  );
}

function HoursTip({ active, payload }: { active?: boolean; payload?: { payload?: ActiveWeek }[] }) {
  const w = payload?.[0]?.payload;
  if (!active || !w) return null;
  return (
    <TipBox title={`week of ${fmtDay(w.start)}${w.partial ? ` (${w.days} days so far)` : ''} · ${w.total.toFixed(1)}h`} minWidth={180}>
      {SERIES.filter((s) => w[s.key] > 0.05).map((s) => (
        <TipRow key={s.key} color={s.color} label={s.label} value={`${w[s.key].toFixed(1)}h`} />
      ))}
      <TipRow label="a day" value={`${(w.total / w.days).toFixed(1)}h`} />
      <TipRow label="AI running" value={`${w.running}h`} />
    </TipBox>
  );
}
