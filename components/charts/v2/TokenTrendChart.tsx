'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatCompact } from '@/lib/format';
import type { DailyStat } from '@/lib/stats/profile-data';

const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-1)' },
};

type Props = { stats: DailyStat[] };

type Range = '7d' | '30d' | '90d' | 'all';
const RANGES: Range[] = ['7d', '30d', '90d', 'all'];
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 366 };

export function TokenTrendChart({ stats }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const data = useMemo(() => {
    const days = RANGE_DAYS[range];
    return [...stats]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-days)
      .map((s) => ({ date: s.date, tokens: s.tokens_total }));
  }, [stats, range]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          tokens trend
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: '0.55rem' }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: 'transparent',
                border: `1px solid ${r === range ? 'var(--chart-1)' : 'var(--color-border)'}`,
                color: r === range ? 'var(--chart-1)' : 'inherit',
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
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="ttc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
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
            tickFormatter={(v) => formatCompact(v)}
            width={36}
          />
          <ChartTooltip cursor={{ stroke: 'var(--chart-1)', strokeOpacity: 0.4 }} content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="var(--chart-1)"
            fill="url(#ttc-fill)"
            strokeWidth={1.5}
            isAnimationActive
            animationDuration={1200}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
