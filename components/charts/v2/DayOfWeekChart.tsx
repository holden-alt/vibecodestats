'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { DailyStat } from '@/lib/stats/profile-data';

const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-5)' },
};
const DAY_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = { stats: DailyStat[] };

export function DayOfWeekChart({ stats }: Props) {
  const buckets: [number, number, number, number, number, number, number] = [0, 0, 0, 0, 0, 0, 0];
  for (const s of stats) {
    // s.date is YYYY-MM-DD in local time; Date(...) treats it as UTC midnight.
    // For day-of-week purposes we use UTC day so the bucketing is deterministic.
    if (s.date && s.tokens_total !== undefined && s.tokens_total !== null) {
      const dow = new Date(s.date + 'T00:00:00Z').getUTCDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
      buckets[dow] += s.tokens_total;
    }
  }
  const data = buckets.map((tokens, i) => ({ day: DAY_LABEL[i], tokens }));

  return (
    <ChartContainer config={config} style={{ height: 90 }}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--color-dim)' }} />
        <YAxis hide />
        <ChartTooltip cursor={{ fill: 'var(--chart-5)', fillOpacity: 0.1 }} content={<ChartTooltipContent />} />
        <Bar dataKey="tokens" fill="var(--chart-5)" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={1200} />
      </BarChart>
    </ChartContainer>
  );
}
