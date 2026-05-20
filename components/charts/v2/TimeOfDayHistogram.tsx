'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatCompact } from '@/lib/format';

const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-4)' },
};

type Props = { hourlyTokens: Record<string, number> };

export function TimeOfDayHistogram({ hourlyTokens }: Props) {
  const data = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    tokens: hourlyTokens[String(h)] ?? 0,
  }));
  return (
    <ChartContainer config={config} style={{ height: 90 }}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickFormatter={(h) => (h % 6 === 0 ? String(h) : '')}
          tick={{ fontSize: 9, fill: 'var(--color-dim)' }}
        />
        <YAxis hide tickFormatter={(v) => formatCompact(v)} />
        <ChartTooltip
          cursor={{ fill: 'var(--chart-4)', fillOpacity: 0.1 }}
          content={<ChartTooltipContent indicator="dashed" />}
        />
        <Bar dataKey="tokens" fill="var(--chart-4)" radius={[1, 1, 0, 0]} isAnimationActive animationDuration={1200} />
      </BarChart>
    </ChartContainer>
  );
}
