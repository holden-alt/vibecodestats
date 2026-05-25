'use client';

import Link from 'next/link';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { formatDelta } from '@/lib/format';
import type { DailyStat } from '@/lib/stats/profile-data';
import type { DimsMeta } from '@/lib/stats/dim-meta';

type VbwDims = {
  output?: number;
  substance?: number;
  tools?: number;
  ships?: number;
  depth?: number;
};

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
  vbwToday: number; // 0-10000 — VBW productivity score
  vbwDimensions: VbwDims; // 5 sub-scores, each 0-100
  dimsMeta?: DimsMeta; // optional "vs You" + intraday pace + sparklines per dim
  isProvisional?: boolean; // show "Provisional (projected to EOD)" badge if today is still active
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
  vbwToday,
  vbwDimensions,
  dimsMeta,
  isProvisional,
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
        padding: '32px 36px 28px',
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
        <div style={{ fontSize: '0.65rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          tokens today
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <RollingNumber value={tokensToday} className="hero-token" durationMs={900} />
          <span style={{ fontSize: '0.75rem', color: deltaColor }}>
            {deltaVsYesterday >= 0 ? '▲' : '▼'} {formatDelta(deltaVsYesterday)} vs yesterday
          </span>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 6, fontSize: '0.65rem', flexWrap: 'wrap' }}>
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
        <VbwHeroBlock vbw={vbwToday} dims={vbwDimensions} meta={dimsMeta} isProvisional={isProvisional} />
      </div>
    </div>
  );
}

// VBW sub-block — secondary hero. The headline VBW number is the absolute
// (cross-user-comparable) score that ranks the leaderboard. Under each
// dimension we also show "P64 vs you" — the personal-baseline percentile,
// which is purely informational and does NOT feed the score (so the
// leaderboard stays a real competition where the top spot belongs to the
// person with the actually-best stats).
function VbwHeroBlock({
  vbw,
  dims,
  meta,
  isProvisional,
}: {
  vbw: number;
  dims: VbwDims;
  meta?: DimsMeta | undefined;
  isProvisional?: boolean | undefined;
}) {
  const dimOrder: { key: keyof VbwDims; label: string }[] = [
    { key: 'output', label: 'output' },
    { key: 'substance', label: 'substance' },
    { key: 'tools', label: 'tools' },
    { key: 'ships', label: 'ships' },
    { key: 'depth', label: 'depth' },
  ];
  const sharedPace = meta?.output.pace ?? null;
  return (
    <div
      style={{
        marginTop: 14,
        padding: '12px 14px',
        background: 'var(--color-bg-2)',
        border: '1px solid var(--color-border)',
        borderLeft: '2px solid var(--chart-2, #f5c542)',
        borderRadius: 3,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: '0.6rem',
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
          }}
        >
          vbw today
        </span>
        <span
          style={{
            fontSize: '1.6rem',
            fontWeight: 700,
            color: 'var(--chart-2, #f5c542)',
            fontVariantNumeric: 'tabular-nums',
            lineHeight: 1,
          }}
        >
          ⚡ {vbw.toLocaleString()}
        </span>
        {isProvisional && (
          <span
            title="UTC day still in progress — score may rise as more activity rolls up"
            style={{
              fontSize: '0.6rem',
              padding: '2px 6px',
              borderRadius: 2,
              border: '1px dashed var(--chart-1)',
              color: 'var(--chart-1)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              fontWeight: 600,
            }}
          >
            provisional
          </span>
        )}
        {sharedPace && (
          <span
            title="Token volume so far today vs your typical cumulative-by-this-hour over the last 30 days"
            style={{
              fontSize: '0.65rem',
              opacity: 0.7,
              color: 'var(--color-text)',
            }}
          >
            {sharedPace}
          </span>
        )}
        <Link
          href="/methodology"
          style={{
            opacity: 0.55,
            fontSize: '0.68rem',
            textDecoration: 'underline',
            textUnderlineOffset: 2,
            marginLeft: 'auto',
          }}
        >
          how this works
        </Link>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 10,
          marginTop: 10,
          fontSize: '0.62rem',
        }}
      >
        {dimOrder.map(({ key, label }) => {
          const v = Math.max(0, Math.min(100, Math.round(dims[key] ?? 0)));
          const m = meta?.[key as keyof DimsMeta];
          return (
            <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', opacity: 0.75 }}>
                <span>{label}</span>
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{v}</span>
              </div>
              <div
                style={{
                  height: 4,
                  background: 'var(--color-bg)',
                  borderRadius: 1,
                  overflow: 'hidden',
                  border: '1px solid var(--color-border)',
                }}
              >
                <div
                  style={{
                    width: `${v}%`,
                    height: '100%',
                    background: v >= 90 ? 'var(--chart-2)' : v >= 50 ? 'var(--chart-3)' : 'var(--chart-1)',
                    transition: 'width 800ms ease-out',
                  }}
                />
              </div>
              {m && (m.pxx != null || m.trend.length > 0) && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                  {m.pxx != null && (
                    <span
                      title={`Your ${label} today is in the P${m.pxx} of your last 30 days`}
                      style={{
                        fontSize: '0.55rem',
                        opacity: 0.65,
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      P{m.pxx} vs you
                    </span>
                  )}
                  {m.trend.length > 1 && (
                    <span style={{ flex: 1, height: 10 }}>
                      <DimSparkline values={m.trend} />
                    </span>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DimSparkline({ values }: { values: number[] }) {
  const data = values.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={10}>
      <LineChart data={data} margin={{ left: 0, right: 0, top: 1, bottom: 1 }}>
        <Line dataKey="v" stroke="var(--chart-2, #f5c542)" strokeWidth={1} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}
