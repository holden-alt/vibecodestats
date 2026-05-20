'use client';

import HeatMap from '@uiw/react-heat-map';
import { useMemo, useState } from 'react';
import type { DailyStat } from '@/lib/stats/profile-data';
import { formatNumber } from '@/lib/format';

type Props = { stats: DailyStat[]; weeks?: number };

const HEAT_COLORS = ['#2e2820', '#3a2a1f', '#6b3e26', '#a8623f', '#d97757'];

type Hovered = { date: string; tokens: number; x: number; y: number } | null;

export function ContributionHeatmap({ stats, weeks = 52 }: Props) {
  const [hovered, setHovered] = useState<Hovered>(null);
  const values = useMemo(
    () =>
      stats.map((s) => ({ date: s.date.replace(/-/g, '/'), count: s.tokens_total })),
    [stats],
  );
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - weeks * 7);

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setHovered(null)}>
      <HeatMap
        width={'100%' as unknown as number}
        height={120}
        value={values}
        startDate={start}
        endDate={today}
        space={2}
        rectSize={11}
        panelColors={{
          0: HEAT_COLORS[0]!,
          100_000: HEAT_COLORS[1]!,
          500_000: HEAT_COLORS[2]!,
          1_500_000: HEAT_COLORS[3]!,
          3_000_000: HEAT_COLORS[4]!,
        }}
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
