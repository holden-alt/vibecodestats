'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, Line, ReferenceDot, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatCompact } from '@/lib/format';
import type { DailyStat } from '@/lib/stats/profile-data';

// Arcade palette: tokens = warm (Claude), 7d avg = cyan (Codex/accent).
const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--team-cc)' },
  avg7d: { label: '7d avg', color: 'var(--team-cx)' },
};

type Props = {
  stats: DailyStat[];
  today?: string;
  // height of the chart body. Default 120 (bento tile). The profile "Your
  // tokens" spotlight passes a tall value (~300) to make it the focal chart.
  height?: number;
  // hide the small "tokens trend" eyebrow when a parent section already titles it.
  hideTitle?: boolean;
};

type Range = '7d' | '30d' | '90d' | 'all';
const RANGES: Range[] = ['7d', '30d', '90d', 'all'];
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 366 };

export function TokenTrendChart({ stats, today, height = 120, hideTitle = false }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const data = useMemo(() => {
    const sorted = [...stats].sort((a, b) => (a.date < b.date ? -1 : 1));
    if (range === 'all') return sorted.map((s) => ({ date: s.date, tokens: s.tokens_total }));
    const anchor = today ?? sorted[sorted.length - 1]?.date;
    if (!anchor) return [];
    const days = RANGE_DAYS[range];
    const start = new Date(anchor + 'T00:00:00Z');
    start.setUTCDate(start.getUTCDate() - days + 1);
    const startKey = start.toISOString().slice(0, 10);
    return sorted
      .filter((s) => s.date >= startKey && s.date <= anchor)
      .map((s) => ({ date: s.date, tokens: s.tokens_total }));
  }, [stats, range, today]);

  const enriched = useMemo(() => {
    // window-aware rolling 7d avg, marked best day in range
    let bestIdx = -1;
    let bestVal = 0;
    data.forEach((d, i) => { if (d.tokens > bestVal) { bestVal = d.tokens; bestIdx = i; } });
    return data.map((d, i) => {
      const start = Math.max(0, i - 6);
      const win = data.slice(start, i + 1);
      const avg = win.reduce((s, x) => s + x.tokens, 0) / Math.max(1, win.length);
      return { ...d, avg7d: Math.round(avg), isBest: i === bestIdx };
    });
  }, [data]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 8, flexWrap: 'wrap' }}>
        {!hideTitle ? (
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, opacity: 0.7, textTransform: 'uppercase', letterSpacing: '0.16em', color: 'var(--neon-txt-dim)' }}>
            tokens trend
          </div>
        ) : (
          <span />
        )}
        <div style={{ display: 'flex', gap: 4 }}>
          {RANGES.map((r) => (
            <button key={r} onClick={() => setRange(r)} style={pill(r === range)}>{r}</button>
          ))}
        </div>
      </div>
      <ChartContainer config={config} style={{ height, fontFamily: 'var(--font-num)' }}>
        <AreaChart data={enriched} margin={{ left: 0, right: 6, top: 6, bottom: 0 }}>
          <defs>
            <linearGradient id="ttc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--team-cc)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="var(--team-cc)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--neon-line)" strokeDasharray="2 4" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            tick={{ fontSize: 11, fill: 'var(--neon-txt-dim)' }}
            tickFormatter={(d) => d.slice(5)}
            minTickGap={28}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--neon-txt-dim)' }}
            tickFormatter={(v) => formatCompact(v)}
            width={58}
          />
          <ChartTooltip cursor={{ stroke: 'var(--team-cc)', strokeOpacity: 0.5, strokeWidth: 1.5 }} content={<ChartTooltipContent />} />
          <Area type="monotone" dataKey="tokens" stroke="var(--team-cc)" fill="url(#ttc-fill)" strokeWidth={2} isAnimationActive animationDuration={1200} />
          <Line type="monotone" dataKey="avg7d" stroke="var(--team-cx)" strokeWidth={1.4} strokeDasharray="3 4" dot={false} isAnimationActive animationDuration={1500} />
          {enriched.find((d) => d.isBest) && (
            <ReferenceDot
              x={enriched.find((d) => d.isBest)!.date}
              y={enriched.find((d) => d.isBest)!.tokens}
              r={5}
              fill="#ffe93c"
              stroke="var(--neon-ink)"
              strokeWidth={2}
            />
          )}
        </AreaChart>
      </ChartContainer>
    </div>
  );
}

function pill(active: boolean): React.CSSProperties {
  return {
    background: active ? 'rgba(255,138,60,0.12)' : 'transparent',
    border: `1px solid ${active ? 'var(--team-cc)' : 'var(--neon-line)'}`,
    color: active ? 'var(--team-cc)' : 'var(--neon-txt-dim)',
    padding: '3px 10px',
    borderRadius: 8,
    cursor: 'pointer',
    fontFamily: 'var(--font-display)',
    fontSize: 11,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };
}
