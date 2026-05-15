'use client';

import { useState } from 'react';
import type { LeaderboardData, LeaderboardMetric, LeaderboardScope } from '@/lib/stats/leaderboard';
import { rankUsers } from '@/lib/stats/leaderboard';
import type { StatsWindow } from '@/lib/stats/aggregations';
import { SegmentedControl } from '@/components/SegmentedControl';
import { RankList } from '@/components/leaderboard/RankList';
import { BarComparison } from '@/components/leaderboard/BarComparison';

type LeaderboardProps = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
  // When set, the scope SegmentedControl is hidden and rankUsers uses this value.
  // For lockedScope='groups', lockedGroupId pins the rank to that specific group.
  lockedScope?: LeaderboardScope;
  lockedGroupId?: string;
};

type ViewId = 'ranklist' | 'barcomparison';

const METRICS = [
  { id: 'tokens', label: 'tokens' },
  { id: 'sessions', label: 'sessions' },
  { id: 'deepwork', label: 'deep work' },
  { id: 'streak', label: 'streak' },
  { id: 'ships', label: 'ships' },
] as const;

const WINDOWS = [
  { id: 'today', label: 'today' },
  { id: 'week', label: 'week' },
  { id: 'month', label: 'month' },
  { id: 'quarter', label: 'quarter' },
  { id: 'year', label: 'year' },
  { id: 'all', label: 'all' },
] as const;

const SCOPES = [
  { id: 'global', label: 'global' },
  { id: 'groups', label: 'my groups' },
  { id: 'friends', label: 'friends' },
] as const;

const VIEWS = [
  { id: 'ranklist', label: 'rank list' },
  { id: 'barcomparison', label: 'bars' },
] as const;

export function Leaderboard({
  data,
  viewerId,
  today,
  lockedScope,
  lockedGroupId,
}: LeaderboardProps) {
  const [metric, setMetric] = useState<LeaderboardMetric>('tokens');
  const [statsWindow, setStatsWindow] = useState<StatsWindow>('all');
  const [scope, setScope] = useState<LeaderboardScope>(lockedScope ?? 'global');
  const [view, setView] = useState<ViewId>('ranklist');

  const effectiveScope = lockedScope ?? scope;
  const ranked = rankUsers(data, {
    metric,
    window: statsWindow,
    scope: effectiveScope,
    viewerId,
    today,
    ...(effectiveScope === 'groups' && lockedGroupId ? { groupId: lockedGroupId } : {}),
  });

  return (
    <div
      className="rounded border p-2.5"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-yellow)' }}
      data-leaderboard
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <SegmentedControl options={METRICS} value={metric} onChange={setMetric} />
        <SegmentedControl options={WINDOWS} value={statsWindow} onChange={setStatsWindow} />
        {!lockedScope && (
          <SegmentedControl options={SCOPES} value={scope} onChange={setScope} />
        )}
        <SegmentedControl options={VIEWS} value={view} onChange={setView} />
      </div>
      <div data-leaderboard-body>
        {view === 'ranklist' ? <RankList entries={ranked} /> : <BarComparison entries={ranked} />}
      </div>
    </div>
  );
}
