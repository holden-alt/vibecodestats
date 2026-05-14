'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';
import {
  type StatsWindow,
  filterByWindow,
  trendForWindow,
  modelTotals,
  dayOfWeekAverages,
  hourlyTotals,
  projectTotals,
  machineTotals,
} from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TokenTrendChart } from '@/components/charts/TokenTrendChart';
import { ModelAreaChart } from '@/components/charts/ModelAreaChart';
import { ModelDonut } from '@/components/charts/ModelDonut';
import { DayOfWeekChart } from '@/components/charts/DayOfWeekChart';
import { TimeOfDayHistogram } from '@/components/charts/TimeOfDayHistogram';
import { RankedBarList } from '@/components/RankedBarList';

type StatsExplorerProps = {
  dailyStats: DailyStat[];
  machineStats: MachineDailyStat[];
  today: string;
};

const TABS = [
  { id: 'trends', label: 'trends' },
  { id: 'models', label: 'model mix' },
  { id: 'timeofday', label: 'time of day' },
  { id: 'dayofweek', label: 'day of week' },
  { id: 'projects', label: 'projects' },
  { id: 'machines', label: 'machines' },
] as const;

const WINDOWS = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function StatsExplorer({ dailyStats, machineStats, today }: StatsExplorerProps) {
  const [tab, setTab] = useState<TabId>('trends');
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');

  const filteredDaily = filterByWindow(dailyStats, today, statsWindow);
  const filteredMachines = filterByWindow(machineStats, today, statsWindow);

  let body: ReactNode;
  switch (tab) {
    case 'trends': {
      const days = trendForWindow(dailyStats, today, statsWindow);
      body = <TokenTrendChart days={days.map((d) => ({ date: d.date, tokens: d.tokens }))} />;
      break;
    }
    case 'models': {
      const days = trendForWindow(dailyStats, today, statsWindow);
      body = (
        <div className="flex flex-col gap-3">
          <ModelDonut totals={modelTotals(filteredDaily)} />
          <ModelAreaChart days={days} />
        </div>
      );
      break;
    }
    case 'timeofday':
      body = <TimeOfDayHistogram hourly={hourlyTotals(filteredDaily)} />;
      break;
    case 'dayofweek':
      body = <DayOfWeekChart averages={dayOfWeekAverages(filteredDaily)} />;
      break;
    case 'projects':
      body = <RankedBarList items={projectTotals(filteredDaily)} />;
      break;
    case 'machines':
      body = <RankedBarList items={machineTotals(filteredMachines)} />;
      break;
  }

  return (
    <section className="mt-3" data-stats-explorer>
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        stats · explorer
      </h3>
      <div
        className="rounded border p-2.5"
        style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-magenta)' }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <SegmentedControl options={TABS} value={tab} onChange={(id) => setTab(id as TabId)} />
          <SegmentedControl
            options={WINDOWS}
            value={statsWindow}
            onChange={(id) => setStatsWindow(id as StatsWindow)}
          />
        </div>
        <div data-explorer-body>{body}</div>
      </div>
    </section>
  );
}
