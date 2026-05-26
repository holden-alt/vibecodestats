'use client';

import HeatMap from '@uiw/react-heat-map';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { DailyStat } from '@/lib/stats/profile-data';
import { formatNumber } from '@/lib/format';

// 52 weeks × (rectSize 11 + space 2) = 676 + ~40px day labels ≈ 720px.
// Hardcoding a NUMERIC width because @uiw/react-heat-map silently fails to
// render colored cells when handed `'100%' as unknown as number` — the
// internal layout math hits NaN and the SVG rect fills are empty (the bug we
// saw in mobile screenshots). Container has overflow-x:auto so the heatmap
// scrolls horizontally on narrow viewports instead of stretching to fit.
const HEATMAP_WIDTH = 720;

type Props = { stats: DailyStat[]; weeks?: number; today?: string };

// Single-hue intensity ramp (chart-1 orange) — quieter than the prior
// cold-blue-to-hot-red spectrum. Reads as "this much activity" instead of
// "fire alarm". Lowest stop matches the dashboard bg so empty days disappear.
const HEAT_COLORS = [
  'rgba(217, 119, 87, 0.05)',  // empty — barely-there orange wash
  'rgba(217, 119, 87, 0.20)',  // p20
  'rgba(217, 119, 87, 0.38)',  // p40
  'rgba(217, 119, 87, 0.58)',  // p60
  'rgba(217, 119, 87, 0.80)',  // p80
  'rgb(217, 119, 87)',         // p95+ — full chart-1
];

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
  const wrapRef = useRef<HTMLDivElement>(null);
  // On mobile the 720px heatmap exceeds the ~393px viewport, so the wrapper
  // scrolls horizontally. Default that scroll position to the far right so
  // the user sees their RECENT activity (the colored cells), not the empty
  // pre-launch months sitting on the left edge.
  useEffect(() => {
    if (!wrapRef.current) return;
    const el = wrapRef.current;
    if (el.scrollWidth > el.clientWidth) {
      el.scrollLeft = el.scrollWidth - el.clientWidth;
    }
  }, [stats.length]);
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
    <div
      ref={wrapRef}
      className="cc-heatmap-wrap"
      style={{ position: 'relative' }}
      onMouseLeave={() => setHovered(null)}
    >
      <HeatMap
        width={HEATMAP_WIDTH}
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
