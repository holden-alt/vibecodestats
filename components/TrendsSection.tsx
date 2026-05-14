import type { DailyStat } from '@/lib/stats/profile-data';
import { last30Days } from '@/lib/stats/aggregations';
import { TokenTrendChart } from '@/components/charts/TokenTrendChart';
import { ModelAreaChart } from '@/components/charts/ModelAreaChart';

type TrendsSectionProps = {
  dailyStats: DailyStat[];
  today: string;
};

export function TrendsSection({ dailyStats, today }: TrendsSectionProps) {
  const days = last30Days(dailyStats, today);
  return (
    <section className="mt-4">
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        trends · 30d
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div
          className="rounded border p-2.5"
          style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-orange)' }}
        >
          <h4
            className="text-[0.58rem] uppercase tracking-[0.1em] font-semibold mb-2"
            style={{ color: 'var(--color-orange)' }}
          >
            · daily tokens
          </h4>
          <TokenTrendChart days={days.map((d) => ({ date: d.date, tokens: d.tokens }))} />
        </div>
        <div
          className="rounded border p-2.5"
          style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-cyan)' }}
        >
          <h4
            className="text-[0.58rem] uppercase tracking-[0.1em] font-semibold mb-2"
            style={{ color: 'var(--color-cyan)' }}
          >
            · model mix
          </h4>
          <ModelAreaChart days={days} />
        </div>
      </div>
    </section>
  );
}
