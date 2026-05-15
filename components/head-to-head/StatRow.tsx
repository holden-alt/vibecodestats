import { Sparkline } from '@/components/head-to-head/Sparkline';
import type { HeadToHeadMetric } from '@/lib/stats/head-to-head';
import { formatValue } from '@/components/leaderboard/format';

type StatRowProps = {
  metric: HeadToHeadMetric;
  valueA: number;
  valueB: number;
  winner: 'A' | 'B' | 'tie';
  sparkA: number[];
  sparkB: number[];
};

const METRIC_LABELS: Record<HeadToHeadMetric, string> = {
  tokens: 'tokens',
  sessions: 'sessions',
  deepwork: 'deep work',
  streak: 'streak',
  ships: 'ships',
};

function formatMetric(metric: HeadToHeadMetric, value: number): string {
  if (metric === 'deepwork') return `${value}h`;
  if (metric === 'streak') return `${value}d`;
  return formatValue(value);
}

export function StatRow({ metric, valueA, valueB, winner, sparkA, sparkB }: StatRowProps) {
  const isAWinner = winner === 'A';
  const isBWinner = winner === 'B';
  return (
    <div
      data-stat-row
      data-metric={metric}
      className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2 border-b"
      style={{ borderColor: 'var(--color-border)' }}
    >
      <div
        data-stat-value="A"
        data-winner={isAWinner ? 'true' : 'false'}
        className="text-right text-[0.95rem] font-mono"
        style={{ color: isAWinner ? 'var(--color-green)' : 'var(--color-text)' }}
      >
        {formatMetric(metric, valueA)}
      </div>
      <div className="flex flex-col items-center w-[140px]">
        <div
          className="text-[0.55rem] uppercase tracking-[0.12em] mb-1"
          style={{ color: 'var(--color-dim)' }}
        >
          {METRIC_LABELS[metric]}
        </div>
        <Sparkline
          seriesA={sparkA}
          seriesB={sparkB}
          ariaLabel={`${METRIC_LABELS[metric]} last 30 days`}
        />
      </div>
      <div
        data-stat-value="B"
        data-winner={isBWinner ? 'true' : 'false'}
        className="text-left text-[0.95rem] font-mono"
        style={{ color: isBWinner ? 'var(--color-green)' : 'var(--color-text)' }}
      >
        {formatMetric(metric, valueB)}
      </div>
    </div>
  );
}
