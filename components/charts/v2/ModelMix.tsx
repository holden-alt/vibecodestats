'use client';

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompact } from '@/lib/format';

// Family-level buckets so users see "gpt-5" instead of "other" when they push
// from Codex CLI. Add new families here as new model lines ship.
type Bucket = 'opus' | 'sonnet' | 'haiku' | 'gpt-5' | 'gpt-4' | 'other';

const BUCKET_ORDER: Bucket[] = ['opus', 'sonnet', 'haiku', 'gpt-5', 'gpt-4', 'other'];

const BUCKET_COLOR: Record<Bucket, string> = {
  opus: 'var(--chart-1)',
  sonnet: 'var(--chart-2)',
  haiku: 'var(--chart-3)',
  'gpt-5': 'var(--chart-5)',
  'gpt-4': 'var(--chart-4)',
  other: 'var(--color-dim)',
};

function classify(modelKey: string): Bucket {
  const k = modelKey.toLowerCase();
  if (k.includes('opus')) return 'opus';
  if (k.includes('sonnet')) return 'sonnet';
  if (k.includes('haiku')) return 'haiku';
  // OpenAI / Codex families. gpt-5-codex, gpt-5.5, gpt-5-mini, etc. all roll up.
  if (k.startsWith('gpt-5') || k.includes('gpt-5')) return 'gpt-5';
  if (k.startsWith('gpt-4') || k.includes('gpt-4')) return 'gpt-4';
  return 'other';
}

type Props = { tokensByModel: Record<string, number> };

export function ModelMix({ tokensByModel }: Props) {
  const buckets: Record<Bucket, number> = {
    opus: 0, sonnet: 0, haiku: 0, 'gpt-5': 0, 'gpt-4': 0, other: 0,
  };
  for (const [k, v] of Object.entries(tokensByModel)) {
    buckets[classify(k)] += v;
  }
  const total = Object.values(buckets).reduce((s, v) => s + v, 0);
  if (total === 0) {
    return <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>no model data yet</div>;
  }
  const data = BUCKET_ORDER
    .filter((k) => buckets[k] > 0)
    .map((k) => ({ name: k, value: buckets[k], color: BUCKET_COLOR[k] }));

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
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 120 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
            <span style={{ opacity: 0.85 }}>{d.name}</span>
            <span style={{ opacity: 0.55, marginLeft: 'auto' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
