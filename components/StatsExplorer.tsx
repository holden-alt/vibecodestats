'use client';

import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';
import {
  type StatsWindow,
  filterByWindow,
  projectTotals,
  machineTotals,
} from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { TokenTrendChart } from '@/components/charts/v2/TokenTrendChart';
import { ModelMix } from '@/components/charts/v2/ModelMix';
import { DayOfWeekChart } from '@/components/charts/v2/DayOfWeekChart';
import { TimeOfDayHistogram } from '@/components/charts/v2/TimeOfDayHistogram';
import { ProjectsBarList } from '@/components/charts/v2/ProjectsBarList';

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

  // Build a Record<string, number> of tokens by model from filtered stats
  const tokensByModel: Record<string, number> = {};
  for (const s of filteredDaily) {
    const byModel = (s.tokens_by_model ?? {}) as Record<string, number>;
    for (const [model, n] of Object.entries(byModel)) {
      tokensByModel[model] = (tokensByModel[model] ?? 0) + n;
    }
  }

  // Build hourlyTokens Record<string, number> from filtered stats
  const hourlyTokens: Record<string, number> = {};
  for (const s of filteredDaily) {
    const hourly = (s.hourly_tokens ?? {}) as Record<string, number>;
    for (const [h, n] of Object.entries(hourly)) {
      hourlyTokens[h] = (hourlyTokens[h] ?? 0) + n;
    }
  }

  // Convert RankedItem[] to Record<string, number> for ProjectsBarList
  const projectsRecord: Record<string, number> = Object.fromEntries(
    projectTotals(filteredDaily).map(({ label, value }) => [label, value])
  );
  const machinesRecord: Record<string, number> = Object.fromEntries(
    machineTotals(filteredMachines).map(({ label, value }) => [label, value])
  );

  let body: ReactNode;
  switch (tab) {
    case 'trends':
      body = <TokenTrendChart stats={filteredDaily} />;
      break;
    case 'models':
      body = <ModelMix tokensByModel={tokensByModel} />;
      break;
    case 'timeofday':
      body = <TimeOfDayHistogram hourlyTokens={hourlyTokens} />;
      break;
    case 'dayofweek':
      body = <DayOfWeekChart stats={filteredDaily} />;
      break;
    case 'projects':
      body = <ProjectsBarList projects={projectsRecord} />;
      break;
    case 'machines':
      body = <ProjectsBarList projects={machinesRecord} />;
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
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
          <SegmentedControl
            options={WINDOWS}
            value={statsWindow}
            onChange={setStatsWindow}
          />
        </div>
        <div data-explorer-body>{body}</div>
      </div>
    </section>
  );
}
