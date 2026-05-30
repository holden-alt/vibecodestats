'use client';

import { useMemo, useState } from 'react';
import { LiveRankTile } from '@/components/dashboard/profile/LiveRankTile';
import { PersonalBests } from '@/components/dashboard/profile/PersonalBests';
import { RollupPills } from '@/components/dashboard/profile/RollupPills';
import { AllTimeTile } from '@/components/dashboard/profile/AllTimeTile';
import { BentoGrid } from '@/components/dashboard/profile/BentoGrid';
import { BentoTile } from '@/components/dashboard/BentoTile';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { ContributionHeatmap } from '@/components/charts/v2/ContributionHeatmap';
import { StatsExplorer } from '@/components/StatsExplorer';
import {
  computeStreak,
  computeWeekTotal,
  computeMonthTotal,
  computeAllTimeTotals,
  computePersonalBests,
  computeNextMilestone,
} from '@/lib/stats/aggregations';
import type { DailyStat, MachineDailyStat } from '@/lib/stats/profile-data';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type Props = {
  dailyStats: DailyStat[];
  machineStats: MachineDailyStat[];
  today: string;
  viewerId: string;
  liveRanking: LiveRanking;
};

// The "extra stats" zone — collapsed by default so the page stays focused on the
// leaderboard / your-tokens / team. Expanding reveals the full personal deep
// dive: live rank, personal bests, rollups, streak + all-time + 52-week heatmap,
// and the StatsExplorer (model mix, time of day, day of week, projects, machines).
export function MoreStats({ dailyStats, machineStats, today, viewerId, liveRanking }: Props) {
  const [open, setOpen] = useState(false);

  const allTime = useMemo(() => computeAllTimeTotals(dailyStats), [dailyStats]);
  const pbs = useMemo(() => computePersonalBests(dailyStats), [dailyStats]);
  const milestone = useMemo(() => computeNextMilestone(allTime.tokens), [allTime.tokens]);
  const streakDays = useMemo(() => computeStreak(dailyStats, today), [dailyStats, today]);

  const weekTokens = computeWeekTotal(dailyStats, today);
  const lastWeekAnchor = useMemo(() => {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [today]);
  const lastWeekTokens = computeWeekTotal(dailyStats, lastWeekAnchor);
  const weekDelta = lastWeekTokens > 0 ? (weekTokens - lastWeekTokens) / lastWeekTokens : 0;

  const monthTokens = computeMonthTotal(dailyStats, today);
  const monthDate = new Date(today + 'T00:00:00Z');
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const daysActiveThisMonth = dailyStats.filter((s) => s.date.startsWith(today.slice(0, 7)) && s.tokens_total > 0).length;
  const monthShips = dailyStats
    .filter((s) => s.date.startsWith(today.slice(0, 7)))
    .reduce((acc, s) => acc + ((s.ships as { commits?: number } | null)?.commits ?? 0), 0);

  return (
    <div className="neon-glass" style={{ padding: 'clamp(16px, 3vw, 22px)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          width: '100%',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          padding: 0,
          color: 'inherit',
        }}
      >
        <span style={{ textAlign: 'left' }}>
          <span style={{ display: 'block', fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 'clamp(16px, 3vw, 20px)', color: 'var(--neon-txt)' }}>
            More stats
          </span>
          <span style={{ display: 'block', fontFamily: 'var(--font-body)', fontSize: 13, color: 'var(--neon-txt-dim)', marginTop: 2 }}>
            Sessions, ships, model mix, time of day, projects, machines, streak, 52-week activity
          </span>
        </span>
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'var(--team-cx)',
            border: '1px solid var(--neon-line)',
            borderRadius: 999,
            padding: '8px 16px',
            whiteSpace: 'nowrap',
          }}
        >
          {open ? 'Hide' : 'Show more'}
        </span>
      </button>

      {open && (
        <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="cc-rank-pb-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <LiveRankTile viewerId={viewerId} date={today} initial={liveRanking} />
            <PersonalBests
              bestDayTokens={pbs.bestDayTokens}
              bestDayDate={pbs.bestDayDate}
              bestShipsCount={pbs.bestShipsCount}
              bestShipsDate={pbs.bestShipsDate}
              bestSessionsCount={pbs.bestSessionsCount}
              bestSessionsDate={pbs.bestSessionsDate}
            />
          </div>

          <RollupPills
            weekTokens={weekTokens}
            weekDelta={weekDelta}
            monthTokens={monthTokens}
            daysActiveThisMonth={daysActiveThisMonth}
            daysInMonth={daysInMonth}
            shipsThisMonth={monthShips}
          />

          <BentoGrid>
            <BentoTile label="streak" sub="days in a row" colSpan={2}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--chart-3)' }}>
                <RollingNumber value={streakDays} />d
              </span>
            </BentoTile>
            <BentoTile label="all-time" colSpan={4}>
              <AllTimeTile
                lifetimeTokens={allTime.tokens}
                daysActive={allTime.daysActive}
                lifetimeShips={allTime.ships}
                nextMilestone={milestone}
              />
            </BentoTile>
            <BentoTile label="52-week activity" colSpan={6}>
              <ContributionHeatmap stats={dailyStats} today={today} />
            </BentoTile>
          </BentoGrid>

          <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today={today} />
        </div>
      )}
    </div>
  );
}
