'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { formatDelta } from '@/lib/format';
import type { DailyStat } from '@/lib/stats/profile-data';

type Props = {
  tokensToday: number;
  sessionsToday: number;
  deepWorkMinutes: number;
  shipsToday: { commits: number; repos: number };
  projectsTouchedCount: number;
  trendStats: DailyStat[]; // last ~30 days for the ghosted sparkline
  deltaVsYesterday: number; // 0.38 → +38%
  deltaVs7dAvg: number; // ratio (today / 7d avg - 1), 0 if no 7d avg
  deltaVs30dAvg: number; // ratio, 0 if no 30d avg
};

export function HeroBlock({
  tokensToday,
  sessionsToday,
  deepWorkMinutes: _deepWorkMinutes, // eslint-disable-line @typescript-eslint/no-unused-vars
  shipsToday,
  projectsTouchedCount,
  trendStats,
  deltaVsYesterday,
  deltaVs7dAvg,
  deltaVs30dAvg,
}: Props) {
  const sparkData = [...trendStats]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-30)
    .map((s) => ({ d: s.date, v: s.tokens_total }));
  const deltaColor = deltaVsYesterday >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)';
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '14px 16px 12px',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--chart-1)',
        background: 'linear-gradient(180deg, var(--color-bg-2), var(--color-bg))',
        borderRadius: 3,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
        <ResponsiveContainer>
          <LineChart data={sparkData} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
            <Line dataKey="v" stroke="var(--chart-1)" strokeWidth={1} dot={false} isAnimationActive animationDuration={1500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          tokens today
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <RollingNumber value={tokensToday} className="hero-token" durationMs={900} />
          <span style={{ fontSize: '0.75rem', color: deltaColor }}>
            {deltaVsYesterday >= 0 ? '▲' : '▼'} {formatDelta(deltaVsYesterday)} vs yesterday
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.6rem', flexWrap: 'wrap' }}>
          {deltaVs7dAvg !== 0 && (
            <span style={{ color: deltaVs7dAvg >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)' }}>
              {deltaVs7dAvg >= 0 ? '▲' : '▼'} {formatDelta(deltaVs7dAvg)} vs 7d avg
            </span>
          )}
          {deltaVs30dAvg !== 0 && (
            <span style={{ color: deltaVs30dAvg >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)' }}>
              {deltaVs30dAvg >= 0 ? '▲' : '▼'} {formatDelta(deltaVs30dAvg)} vs 30d avg
            </span>
          )}
          <span style={{ opacity: 0.65 }}>
            {sessionsToday} sessions · {shipsToday.commits} ships · {projectsTouchedCount} projects
          </span>
        </div>
      </div>
    </div>
  );
}
