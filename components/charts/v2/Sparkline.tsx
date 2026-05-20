'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompact } from '@/lib/format';

type SeriesPoint = { date: string; you: number; them?: number };

type Props = {
  data: SeriesPoint[];
  height?: number;
  showThem?: boolean;
};

export function Sparkline({ data, height = 28, showThem }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
        <Tooltip
          contentStyle={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.6rem',
          }}
          formatter={(v) => {
            if (typeof v === 'number') {
              return formatCompact(v);
            }
            return v;
          }}
          labelFormatter={(d) => String(d)}
        />
        <Line
          dataKey="you"
          name="you"
          stroke="var(--chart-1)"
          strokeWidth={1.2}
          dot={false}
          isAnimationActive
          animationDuration={1000}
        />
        {showThem && (
          <Line
            dataKey="them"
            name="them"
            stroke="var(--chart-2)"
            strokeWidth={1.2}
            dot={false}
            isAnimationActive
            animationDuration={1000}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
