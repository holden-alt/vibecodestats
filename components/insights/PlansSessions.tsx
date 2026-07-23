'use client';

import { useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { prettyModel } from '@/lib/insights/compute';
import { OUTCOME_COLOR, OUTCOME_LABEL, type PlansData } from '@/lib/insights/types';
import { fmtPctDelta } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

type Win = '14d' | '30d';
const WINDOWS: { id: Win; label: string }[] = [
  { id: '14d', label: '14d' },
  { id: '30d', label: '30d' },
];
const WIN_DAYS: Record<Win, number> = { '14d': 14, '30d': 30 };

const STACK: { key: string; label: string; color: string }[] = [
  { key: 'completed', label: OUTCOME_LABEL.completed ?? 'done', color: OUTCOME_COLOR.completed ?? 'var(--color-green)' },
  { key: 'partial', label: OUTCOME_LABEL.partial ?? 'partial', color: OUTCOME_COLOR.partial ?? 'var(--color-yellow)' },
  { key: 'blocked', label: OUTCOME_LABEL.blocked ?? 'blocked', color: OUTCOME_COLOR.blocked ?? 'var(--color-red)' },
  { key: 'abandoned', label: OUTCOME_LABEL.abandoned ?? 'abandoned', color: OUTCOME_COLOR.abandoned ?? 'var(--color-dim)' },
];

export function PlansSessions({ data }: { data: PlansData }) {
  const [win, setWin] = useState<Win>('30d');
  const trend = useMemo(() => data.trend.slice(-WIN_DAYS[win]), [data.trend, win]);
  const hasTrend = trend.some((d) => d.completed + d.partial + d.blocked + d.abandoned > 0);

  const controls = <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="trend window" />;

  return (
    <PanelShell title="Plans & sessions" hint="interactive outcomes over time" right={controls}>
      <WowStrip data={data} />

      {hasTrend ? (
        <div style={{ height: 150, marginTop: 14, marginLeft: -8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trend} margin={{ left: 4, right: 8, top: 4, bottom: 0 }} barCategoryGap={2}>
              <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
                tickFormatter={(d: string) => d.slice(5)}
                minTickGap={22}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
                width={26}
                allowDecimals={false}
              />
              <Tooltip cursor={{ fill: 'var(--color-bg-2)', opacity: 0.5 }} content={<TrendTooltip />} />
              {STACK.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.label} stackId="1" fill={s.color} isAnimationActive={false} />
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <div style={{ height: 120, marginTop: 14, display: 'grid', placeItems: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
          No judged interactive sessions in this window yet.
        </div>
      )}

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px', marginTop: 10 }}>
        {STACK.map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.6rem', color: 'var(--color-dim)' }}>
            <span aria-hidden style={{ width: 8, height: 8, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <SessionList data={data} />
    </PanelShell>
  );
}

function WowStrip({ data }: { data: PlansData }) {
  const has = data.thisRate != null && data.lastRate != null;
  const delta = has ? (data.thisRate as number) - (data.lastRate as number) : 0;
  const deltaColor = delta > 0.001 ? 'var(--color-green)' : delta < -0.001 ? 'var(--color-red)' : 'var(--color-dim)';
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px 24px', flexWrap: 'wrap' }}>
      <div>
        <div style={{ fontSize: '1.5rem', fontWeight: 700, lineHeight: 1, color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' }}>
          {data.thisRate == null ? '—' : `${Math.round(data.thisRate * 100)}%`}
        </div>
        <div className="term-eyebrow" style={{ marginTop: 5 }}>
          completion · this wk ({data.thisSessions})
        </div>
      </div>
      <div>
        <div style={{ fontSize: '1rem', fontWeight: 600, lineHeight: 1, color: 'var(--color-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {data.lastRate == null ? '—' : `${Math.round(data.lastRate * 100)}%`}
        </div>
        <div className="term-eyebrow" style={{ marginTop: 5 }}>
          last wk ({data.lastSessions})
        </div>
      </div>
      {has && data.lastRate !== 0 && (
        <div style={{ color: deltaColor, fontSize: '0.8rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', paddingBottom: 2 }}>
          {delta >= 0 ? '▲' : '▼'} {fmtPctDelta(Math.abs(delta))}
        </div>
      )}
    </div>
  );
}

function SessionList({ data }: { data: PlansData }) {
  if (data.todaySessions.length === 0) {
    return (
      <div style={{ marginTop: 16, fontSize: '0.7rem', color: 'var(--color-dim)' }}>
        No interactive sessions recorded today yet.
      </div>
    );
  }
  return (
    <div style={{ marginTop: 16 }}>
      <div className="term-eyebrow" style={{ marginBottom: 8 }}>
        today · interactive sessions
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
        {data.todaySessions.map((s) => (
          <div key={s.sessionId} style={{ display: 'flex', gap: 9, alignItems: 'baseline' }}>
            <span
              aria-hidden
              title={s.outcome}
              style={{ width: 7, height: 7, borderRadius: '50%', background: OUTCOME_COLOR[s.outcome] ?? 'var(--color-dim)', flexShrink: 0, transform: 'translateY(1px)' }}
            />
            <div style={{ minWidth: 0, flex: 1 }}>
              <div
                style={{ fontSize: '0.72rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                title={s.summary || s.intent}
              >
                {s.intent || s.summary || '(no summary)'}
              </div>
              <div style={{ display: 'flex', gap: 10, fontSize: '0.58rem', color: 'var(--color-dim)', marginTop: 2 }}>
                <span style={{ color: OUTCOME_COLOR[s.outcome] ?? 'var(--color-dim)' }}>
                  {OUTCOME_LABEL[s.outcome] ?? s.outcome}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 180 }}>{s.project}</span>
                <span>{prettyModel(s.model)}</span>
                <FrictionPips friction={s.friction} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrictionPips({ friction }: { friction: number }) {
  const f = Math.max(0, Math.min(3, friction));
  return (
    <span style={{ display: 'inline-flex', gap: 2, alignItems: 'center' }} title={`friction ${f}/3`}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          aria-hidden
          style={{
            width: 5,
            height: 5,
            borderRadius: '50%',
            background: i < f ? (f >= 2 ? 'var(--color-red)' : 'var(--color-yellow)') : 'var(--color-border)',
          }}
        />
      ))}
    </span>
  );
}

type TooltipItem = { name?: string; value?: number; color?: string; dataKey?: string };
function TrendTooltip({ active, payload, label }: { active?: boolean; payload?: TooltipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const items = payload.filter((p) => typeof p.value === 'number' && p.value > 0);
  if (items.length === 0) return null;
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
        minWidth: 120,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>{label}</div>
      {items.map((p, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
          <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: p.color }} />
          <span style={{ color: 'var(--color-dim)' }}>{p.name}</span>
          <span style={{ marginLeft: 'auto' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}
