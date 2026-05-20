'use client';

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompact } from '@/lib/format';

const MODEL_COLOR: Record<string, string> = {
  opus: 'var(--chart-1)',
  sonnet: 'var(--chart-2)',
  haiku: 'var(--chart-3)',
  other: 'var(--color-dim)',
};
const MODEL_LABEL: Record<string, string> = {
  opus: 'opus',
  sonnet: 'sonnet',
  haiku: 'haiku',
  other: 'other',
};

function classify(modelKey: string): 'opus' | 'sonnet' | 'haiku' | 'other' {
  const k = modelKey.toLowerCase();
  if (k.includes('opus')) return 'opus';
  if (k.includes('sonnet')) return 'sonnet';
  if (k.includes('haiku')) return 'haiku';
  return 'other';
}

type Props = { tokensByModel: Record<string, number> };

export function ModelMix({ tokensByModel }: Props) {
  const buckets: Record<'opus' | 'sonnet' | 'haiku' | 'other', number> = {
    opus: 0, sonnet: 0, haiku: 0, other: 0,
  };
  for (const [k, v] of Object.entries(tokensByModel)) {
    buckets[classify(k)] += v;
  }
  const total = buckets.opus + buckets.sonnet + buckets.haiku + buckets.other;
  if (total === 0) {
    return <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>no model data yet</div>;
  }
  const data = (['opus', 'sonnet', 'haiku', 'other'] as const)
    .filter((k) => buckets[k] > 0)
    .map((k) => ({ name: MODEL_LABEL[k], value: buckets[k], color: MODEL_COLOR[k] }));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={16} outerRadius={26} stroke="none" isAnimationActive animationDuration={1200}>
              {data.map((d, i) => (<Cell key={i} fill={d.color as string} />))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 3, fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem' }}
              formatter={(v) => {
                const val = v as number;
                return `${formatCompact(val)} (${Math.round((val / total) * 100)}%)`;
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.65rem' }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
            <span style={{ opacity: 0.85 }}>{d.name}</span>
            <span style={{ opacity: 0.55, marginLeft: 'auto' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
