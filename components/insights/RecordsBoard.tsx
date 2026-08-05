'use client';

import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { RecordsData } from '@/lib/insights/types';
import { fmtInt, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';

// Records board — lifetime bests from the full-history day store, plus the
// cumulative "odometer" line climbing toward the next round milestone.
export function RecordsBoard({ records }: { records: RecordsData }) {
  const r = records;
  if (r.daysTracked === 0) return null;

  const pct = Math.min(100, (r.lifetimeTokens / r.nextMilestone) * 100);

  return (
    <PanelShell
      title="Records"
      hint="lifetime bests · full history"
      right={
        <span style={{ fontSize: '0.62rem', color: 'var(--color-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {fmtTokens(r.lifetimeTokens)} of {fmtTokens(r.nextMilestone)} ({pct.toFixed(0)}%)
        </span>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: '14px 18px',
          marginBottom: 14,
        }}
      >
        <Tile label="lifetime tokens" value={fmtTokens(r.lifetimeTokens)} accent />
        <Tile
          label={`best day${r.bestDay ? ` · ${r.bestDay.date.slice(5)}` : ''}`}
          value={r.bestDay ? fmtTokens(r.bestDay.tokens) : '—'}
        />
        <Tile
          label={`best week${r.bestWeek ? ` · wk of ${r.bestWeek.start.slice(5)}` : ''}`}
          value={r.bestWeek ? fmtTokens(r.bestWeek.tokens) : '—'}
        />
        <Tile label="1B+ days" value={fmtInt(r.billionDays)} />
        <Tile label="500M+ days" value={fmtInt(r.halfBillionDays)} />
        <Tile
          label={`streak · longest ${r.longestStreak ? fmtInt(r.longestStreak.days) : 0}`}
          value={`${fmtInt(r.currentStreak)}d`}
        />
      </div>

      <div style={{ height: 150, marginLeft: -8 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={r.odometer} margin={{ left: 4, right: 8, top: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 4" vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={{ stroke: 'var(--color-border)' }}
              tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
              tickFormatter={(d: string) => d.slice(5)}
              minTickGap={40}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
              tickFormatter={(v: number) => fmtTokens(v)}
              width={46}
              domain={[0, Math.max(r.nextMilestone, r.lifetimeTokens)]}
            />
            <Tooltip
              cursor={{ stroke: 'var(--color-orange)', strokeOpacity: 0.4, strokeWidth: 1 }}
              content={<OdometerTooltip />}
            />
            <ReferenceLine
              y={r.nextMilestone}
              stroke="var(--color-dim)"
              strokeDasharray="4 4"
              label={{
                value: fmtTokens(r.nextMilestone),
                position: 'insideTopRight',
                fontSize: 10,
                fill: 'var(--color-dim)',
              }}
            />
            <Area
              type="monotone"
              dataKey="cumulative"
              name="cumulative"
              stroke="var(--color-orange)"
              fill="var(--color-orange)"
              fillOpacity={0.18}
              strokeWidth={1.5}
              dot={false}
              activeDot={{ r: 2.5, strokeWidth: 0 }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </PanelShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        style={{
          fontSize: '1.15rem',
          fontWeight: 600,
          lineHeight: 1.1,
          color: accent ? 'var(--color-orange)' : 'var(--color-text)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {value}
      </div>
      <div className="term-eyebrow" style={{ marginTop: 5 }}>
        {label}
      </div>
    </div>
  );
}

type TipItem = { value?: number; payload?: { date?: string; cumulative?: number; day?: number } };
function OdometerTooltip({ active, payload, label }: { active?: boolean; payload?: TipItem[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
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
        minWidth: 130,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>{label}</div>
      <div style={{ display: 'flex', gap: 7 }}>
        <span style={{ color: 'var(--color-dim)' }}>lifetime</span>
        <span style={{ marginLeft: 'auto', color: 'var(--color-orange)' }}>{fmtTokens(p?.cumulative ?? 0)}</span>
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <span style={{ color: 'var(--color-dim)' }}>that day</span>
        <span style={{ marginLeft: 'auto' }}>+{fmtTokens(p?.day ?? 0)}</span>
      </div>
    </div>
  );
}
