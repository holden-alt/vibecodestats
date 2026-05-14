import type { DailyStat } from '@/lib/stats/profile-data';
import { modelTotals, dayOfWeekAverages, hourlyTotals } from '@/lib/stats/aggregations';
import { ModelDonut } from '@/components/charts/ModelDonut';
import { DayOfWeekChart } from '@/components/charts/DayOfWeekChart';
import { TimeOfDayHistogram } from '@/components/charts/TimeOfDayHistogram';

type ChartsSectionProps = {
  dailyStats: DailyStat[];
};

const PANELS = [
  { title: '· model split', color: 'var(--color-magenta)' },
  { title: '· day of week', color: 'var(--color-yellow)' },
  { title: '· time of day', color: 'var(--color-magenta)' },
];

export function ChartsSection({ dailyStats }: ChartsSectionProps) {
  const totals = modelTotals(dailyStats);
  const dow = dayOfWeekAverages(dailyStats);
  const hourly = hourlyTotals(dailyStats);
  const charts = [
    <ModelDonut key="donut" totals={totals} />,
    <DayOfWeekChart key="dow" averages={dow} />,
    <TimeOfDayHistogram key="tod" hourly={hourly} />,
  ];
  return (
    <section className="mt-3">
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        stats · charts
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {PANELS.map((panel, i) => (
          <div
            key={panel.title}
            className="rounded border p-2.5"
            style={{ borderColor: 'var(--color-border)', borderTop: `2px solid ${panel.color}` }}
          >
            <h4
              className="text-[0.58rem] uppercase tracking-[0.1em] font-semibold mb-2"
              style={{ color: panel.color }}
            >
              {panel.title}
            </h4>
            {charts[i]}
          </div>
        ))}
      </div>
    </section>
  );
}
