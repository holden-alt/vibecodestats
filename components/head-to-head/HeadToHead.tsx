'use client';

import { useState } from 'react';
import type { HeadToHeadData } from '@/lib/stats/head-to-head-data';
import { computeHeadToHead } from '@/lib/stats/head-to-head';
import type { StatsWindow } from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { StatRow } from '@/components/head-to-head/StatRow';

type HeadToHeadProps = {
  data: HeadToHeadData;
  today: string;
};

const WINDOWS = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
] as const;

export function HeadToHead({ data, today }: HeadToHeadProps) {
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');
  const rows = computeHeadToHead(data, statsWindow, today);

  const nameA = data.userA.display_name ?? data.userA.github_handle;
  const nameB = data.userB.display_name ?? data.userB.github_handle;

  return (
    <div
      className="rounded border p-3"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-yellow)' }}
      data-head-to-head
    >
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 mb-3">
        <div className="text-right">
          <div
            className="text-[0.55rem] uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-orange)' }}
          >
            challenger A
          </div>
          <div className="text-[1.05rem] font-semibold" style={{ color: 'var(--color-text)' }}>
            {nameA}
          </div>
          <div className="text-[0.7rem]" style={{ color: 'var(--color-dim)' }}>
            @{data.userA.github_handle}
          </div>
        </div>
        <div className="text-[0.85rem] font-semibold" style={{ color: 'var(--color-dim)' }}>
          vs
        </div>
        <div className="text-left">
          <div
            className="text-[0.55rem] uppercase tracking-[0.12em]"
            style={{ color: 'var(--color-cyan)' }}
          >
            challenger B
          </div>
          <div className="text-[1.05rem] font-semibold" style={{ color: 'var(--color-text)' }}>
            {nameB}
          </div>
          <div className="text-[0.7rem]" style={{ color: 'var(--color-dim)' }}>
            @{data.userB.github_handle}
          </div>
        </div>
      </div>
      <div className="flex justify-center mb-3">
        <SegmentedControl options={WINDOWS} value={statsWindow} onChange={setStatsWindow} />
      </div>
      <div>
        {rows.map((row) => (
          <StatRow
            key={row.metric}
            metric={row.metric}
            valueA={row.valueA}
            valueB={row.valueB}
            winner={row.winner}
            sparkA={row.sparkA}
            sparkB={row.sparkB}
          />
        ))}
      </div>
    </div>
  );
}
