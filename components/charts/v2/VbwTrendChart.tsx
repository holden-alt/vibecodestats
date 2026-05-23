'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, ReferenceLine, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { DailyStat } from '@/lib/stats/profile-data';

const config: ChartConfig = {
  vbw: { label: 'VBW', color: 'var(--chart-2)' },
  avg7d: { label: '7d avg', color: 'var(--chart-3)' },
};

type Props = { stats: DailyStat[]; today?: string };

type Range = '7d' | '30d' | '90d' | 'all';
const RANGES: Range[] = ['7d', '30d', '90d', 'all'];
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 366 };

export function VbwTrendChart({ stats, today }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const data = useMemo(() => {
    const sorted = [...stats].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (range === 'all') return sorted.map((s) => ({ date: s.date, vbw: s.vbw_total ?? 0 }));
    const anchor = today ?? sorted[sorted.length - 1]?.date;
    if (!anchor) return [];
    const days = RANGE_DAYS[range];
    const start = new Date(anchor + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - days + 1);
    const startKey = start.toISOString().slice(0, 10);
    return sorted
      .filter((s) => s.date >= startKey && s.date <= anchor)
      .map((s) => ({ date: s.date, vbw: s.vbw_total ?? 0 }));
  }, [stats, range, today]);

  const enriched = useMemo(() => {
    let bestIdx = -1;
    let bestVal = 0;
    data.forEach((d, i) => { if (d.vbw > bestVal) { bestVal = d.vbw; bestIdx = i; } });
    return data.map((d, i) => {
      const start = Math.max(0, i - 6);
      const window = data.slice(start, i + 1);
      const avg = window.reduce((s, x) => s + x.vbw, 0) / Math.max(1, window.length);
      return { ...d, avg7d: Math.round(avg), isBest: i === bestIdx };
    });
  }, [data]);

  // Window-average reference line — the leaderboard's metric for week/month VBW.
  const windowAvg = useMemo(() => {
    if (enriched.length === 0) return 0;
    return Math.round(enriched.reduce((s, d) => s + d.vbw, 0) / enriched.length);
  }, [enriched]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            vbw trend
          </div>
          <div style={{ fontSize: '0.65rem', opacity: 0.55 }}>
            window avg: <span style={{ color: 'var(--chart-2)' }}>{windowAvg.toLocaleString()}</span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: '0.65rem' }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: 'transparent',
                border: `1px solid ${r === range ? 'var(--chart-2)' : 'var(--color-border)'}`,
                color: r === range ? 'var(--chart-2)' : 'inherit',
                padding: '1px 6px',
                borderRadius: 2,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ChartContainer config={config} style={{ height: 120 }}>
        <AreaChart data={enriched} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="vbw-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
            tickFormatter={(d) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
            tickFormatter={(v) => v.toLocaleString()}
            domain={[0, 10000]}
            ticks={[0, 2500, 5000, 7500, 10000]}
            width={42}
          />
          <ChartTooltip cursor={{ stroke: 'var(--chart-2)', strokeOpacity: 0.4 }} content={<ChartTooltipContent />} />
          <ReferenceLine y={10000} stroke="var(--color-dim)" strokeDasharray="1 4" strokeOpacity={0.4} />
          <Area type="monotone" dataKey="vbw" stroke="var(--chart-2)" fill="url(#vbw-fill)" strokeWidth={1.5} isAnimationActive animationDuration={1200} />
          <Line type="monotone" dataKey="avg7d" stroke="var(--chart-3)" strokeWidth={1.2} strokeDasharray="3 3" dot={false} isAnimationActive animationDuration={1500} />
          {enriched.find((d) => d.isBest) && (
            <ReferenceDot
              x={enriched.find((d) => d.isBest)!.date}
              y={enriched.find((d) => d.isBest)!.vbw}
              r={4}
              fill="var(--chart-5)"
              stroke="var(--color-bg)"
              strokeWidth={1}
            />
          )}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
