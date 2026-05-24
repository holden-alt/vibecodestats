'use client';

import HeatMap from '@uiw/react-heat-map';
import { useMemo, useState } from 'react';
import type { DailyStat } from '@/lib/stats/profile-data';
import { formatNumber } from '@/lib/format';

type Props = { stats: DailyStat[]; weeks?: number; today?: string };

// Strava-style spectrum: cold (zero) → cool → warm → hot (monster days).
// 6 stops so a power-law token distribution actually fans out across hues.
const HEAT_COLORS = ['#1a2a4a', '#2d5a8a', '#2d9a8a', '#c9a64a', '#d97757', '#c04545'];

// Linear fallback used when there aren't enough active days to derive quantiles.
const FALLBACK_THRESHOLDS = [100_000, 500_000, 1_500_000, 3_000_000, 6_000_000];

function computeThresholds(tokens: number[]): number[] {
  const nonzero = tokens.filter((v) => v > 0).sort((a, b) => a - b);
  if (nonzero.length < 7) return FALLBACK_THRESHOLDS;
  const q = (p: number) => nonzero[Math.floor((nonzero.length - 1) * p)]!;
  const raw = [q(0.2), q(0.4), q(0.6), q(0.8), q(0.95)];
  // panelColors keys must be strictly increasing; bump duplicates so collapsed
  // quantiles (e.g. lots of identical values) still produce distinct bins.
  const out: number[] = [];
  let prev = 0;
  for (const v of raw) {
    const adj = Math.max(v, prev + 1);
    out.push(adj);
    prev = adj;
  }
  return out;
}

type Hovered = { date: string; tokens: number; x: number; y: number } | null;

export function ContributionHeatmap({ stats, weeks = 52, today }: Props) {
  const [hovered, setHovered] = useState<Hovered>(null);
  const values = useMemo(
    () =>
      stats.map((s) => ({ date: s.date.replace(/-/g, '/'), count: s.tokens_total })),
    [stats],
  );
  const panelColors = useMemo(() => {
    const t = computeThresholds(stats.map((s) => s.tokens_total));
    return {
      0: HEAT_COLORS[0]!,
      [t[0]!]: HEAT_COLORS[1]!,
      [t[1]!]: HEAT_COLORS[2]!,
      [t[2]!]: HEAT_COLORS[3]!,
      [t[3]!]: HEAT_COLORS[4]!,
      [t[4]!]: HEAT_COLORS[5]!,
    };
  }, [stats]);
  const todayDate = today ? new Date(today + 'T00:00:00Z') : new Date();
  const start = new Date(todayDate);
  start.setDate(todayDate.getDate() - weeks * 7);

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
      <HeatMap
        width={'100%' as unknown as number}
        height={120}
        value={values}
        startDate={start}
        endDate={todayDate}
        space={2}
        rectSize={11}
        panelColors={panelColors}
        legendCellSize={0}
        rectRender={(props, data) => {
          const tokens = (data as { count?: number }).count ?? 0;
          const date = String(data.date);
          return (
            <rect
              {...props}
              rx={1}
              ry={1}
              onMouseEnter={(e) => {
                const target = e.currentTarget as SVGRectElement;
                const containerRect = (target.closest('div') as HTMLDivElement).getBoundingClientRect();
                const rectBox = target.getBoundingClientRect();
                setHovered({
                  date,
                  tokens,
                  x: rectBox.left + rectBox.width / 2 - containerRect.left,
                  y: rectBox.top - containerRect.top,
                });
              }}
            />
          );
        }}
      />
      {hovered && (
        <div
          style={{
            position: 'absolute',
            left: hovered.x,
            top: hovered.y,
            transform: 'translate(-50%, calc(-100% - 6px))',
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            padding: '4px 8px',
            borderRadius: 3,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
            fontSize: '0.65rem',
            color: 'var(--color-text)',
            fontVariantNumeric: 'tabular-nums',
            pointerEvents: 'none',
            zIndex: 10,
            whiteSpace: 'nowrap',
          }}
        >
          {hovered.date.replace(/\//g, '-')}: {formatNumber(hovered.tokens)} tokens
        </div>
      )}
    </div>
  );
}
