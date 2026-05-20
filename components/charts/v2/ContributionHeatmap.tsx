'use client';

import HeatMap from '@uiw/react-heat-map';
import { useMemo } from 'react';
import type { DailyStat } from '@/lib/stats/profile-data';
import { formatNumber } from '@/lib/format';

type Props = { stats: DailyStat[]; weeks?: number };

const HEAT_COLORS = ['#2e2820', '#3a2a1f', '#6b3e26', '#a8623f', '#d97757'];

export function ContributionHeatmap({ stats, weeks = 52 }: Props) {
  const values = useMemo(
    () =>
      stats.map((s) => ({ date: s.date.replace(/-/g, '/'), count: s.tokens_total })),
    [stats],
  );
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - weeks * 7);

  return (
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
        return (
          <rect
            {...props}
            rx={1}
            ry={1}
          >
            <title>{`${data.date}: ${formatNumber(tokens)} tokens`}</title>
          </rect>
        );
      }}
    />
  );
}
