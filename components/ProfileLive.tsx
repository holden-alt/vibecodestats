'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatsExplorer } from '@/components/StatsExplorer';
import { IdentityStrip } from '@/components/dashboard/profile/IdentityStrip';
import { HeroBlock } from '@/components/dashboard/profile/HeroBlock';
import { BentoGrid } from '@/components/dashboard/profile/BentoGrid';
import { BentoTile } from '@/components/dashboard/BentoTile';
import { LiveRankTile } from '@/components/dashboard/profile/LiveRankTile';
import { GlobalLeaderboard } from '@/components/dashboard/profile/GlobalLeaderboard';
import { PersonalBests } from '@/components/dashboard/profile/PersonalBests';
import { RollupPills } from '@/components/dashboard/profile/RollupPills';
import { AllTimeTile } from '@/components/dashboard/profile/AllTimeTile';
import { StreakAtRisk } from '@/components/dashboard/profile/StreakAtRisk';
import { TokenTrendChart } from '@/components/charts/v2/TokenTrendChart';
import { ContributionHeatmap } from '@/components/charts/v2/ContributionHeatmap';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import {
  computeStreak,
  computeRollingAverage,
  computeWeekTotal,
  computeMonthTotal,
  computeAllTimeTotals,
  computePersonalBests,
  computeNextMilestone,
} from '@/lib/stats/aggregations';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type ProfileLiveProps = {
  initialData: ProfileData;
  leaderboardData: LeaderboardData;
  initialLiveRanking: LiveRanking;
  today: string;
};

export function ProfileLive({ initialData, leaderboardData, initialLiveRanking, today }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user } = initialData;

  useEffect(() => {
    const supabase = createClient();
    const baseChannel: RealtimeChannel = supabase.channel(`daily_stats:${user.id}`);
    const channel = (
      baseChannel.on as unknown as (
        event: 'postgres_changes',
        filter: { event: string; schema: string; table: string; filter: string },
        callback: (payload: { new?: DailyStat }) => void,
      ) => RealtimeChannel
    )(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_stats', filter: `user_id=eq.${user.id}` },
      (payload: { new?: DailyStat }) => {
        const row = payload.new;
        if (!row) return;
        setDailyStats((prev) => {
          const without = prev.filter((r) => r.date !== row.date);
          return [row, ...without].sort((a, b) => (a.date < b.date ? 1 : -1));
        });
      },
    ).subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [user.id]);

  const effectiveToday = useMemo(() => {
    if (dailyStats.find((s) => s.date === today)) return today;
    return dailyStats[0]?.date ?? today;
  }, [dailyStats, today]);

  const todayRow = useMemo(() => dailyStats.find((s) => s.date === effectiveToday), [dailyStats, effectiveToday]);
  const yesterdayRow = useMemo(() => {
    const d = new Date(effectiveToday + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const key = d.toISOString().slice(0, 10);
    return dailyStats.find((s) => s.date === key);
  }, [dailyStats, effectiveToday]);

  const tokensToday = todayRow?.tokens_total ?? 0;
  const tokensYesterday = yesterdayRow?.tokens_total ?? 0;
  const deltaVsYesterday = tokensYesterday > 0 ? (tokensToday - tokensYesterday) / tokensYesterday : 0;
  const avg7d = computeRollingAverage(dailyStats, effectiveToday, 7);
  const avg30d = computeRollingAverage(dailyStats, effectiveToday, 30);
  const deltaVs7d = avg7d > 0 ? (tokensToday - avg7d) / avg7d : 0;
  const deltaVs30d = avg30d > 0 ? (tokensToday - avg30d) / avg30d : 0;

  const sessionsToday = todayRow?.sessions ?? 0;
  const shipsToday = (todayRow?.ships as { commits?: number; repos?: number } | undefined) ?? {};
  const projectsTouched = (todayRow?.projects_touched as Record<string, number>) ?? {};

  const projectsTouchedCount = Object.keys(projectsTouched).length;
  const streakDays = computeStreak(dailyStats, effectiveToday);
  const nowProject = pickNowProject(projectsTouched);

  const weekTokens = computeWeekTotal(dailyStats, effectiveToday);
  const lastWeekAnchor = useMemo(() => {
    const d = new Date(effectiveToday + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 7);
    return d.toISOString().slice(0, 10);
  }, [effectiveToday]);
  const lastWeekTokens = computeWeekTotal(dailyStats, lastWeekAnchor);
  const weekDelta = lastWeekTokens > 0 ? (weekTokens - lastWeekTokens) / lastWeekTokens : 0;

  const monthTokens = computeMonthTotal(dailyStats, effectiveToday);
  const monthDate = new Date(effectiveToday + 'T00:00:00Z');
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const daysActiveThisMonth = dailyStats.filter((s) => s.date.startsWith(effectiveToday.slice(0, 7)) && s.tokens_total > 0).length;
  const monthShips = dailyStats
    .filter((s) => s.date.startsWith(effectiveToday.slice(0, 7)))
    .reduce((acc, s) => acc + ((s.ships as { commits?: number } | null)?.commits ?? 0), 0);

  const allTime = useMemo(() => computeAllTimeTotals(dailyStats), [dailyStats]);
  const pbs = useMemo(() => computePersonalBests(dailyStats), [dailyStats]);
  const milestone = useMemo(() => computeNextMilestone(allTime.tokens), [allTime.tokens]);

  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 24px 64px', display: 'flex', flexDirection: 'column', gap: 0 }}>
      <div style={{ marginBottom: 28 }}>
        <IdentityStrip
          user={user}
          rank={null}
          squadSize={null}
          streakDays={streakDays}
          nowProject={nowProject}
        />
      </div>

      <StreakAtRisk streakDays={streakDays} todayTokens={tokensToday} />

      <div style={{ marginBottom: 24 }}>
        <HeroBlock
          tokensToday={tokensToday}
          sessionsToday={sessionsToday}
          deepWorkMinutes={0}
          shipsToday={{ commits: shipsToday.commits ?? 0, repos: shipsToday.repos ?? 0 }}
          projectsTouchedCount={projectsTouchedCount}
          trendStats={dailyStats}
          deltaVsYesterday={deltaVsYesterday}
          deltaVs7dAvg={deltaVs7d}
          deltaVs30dAvg={deltaVs30d}
        />
      </div>

      <div className="cc-rank-pb-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <LiveRankTile viewerId={user.id} date={effectiveToday} initial={initialLiveRanking} />
        <PersonalBests
          bestDayTokens={pbs.bestDayTokens}
          bestDayDate={pbs.bestDayDate}
          bestShipsCount={pbs.bestShipsCount}
          bestShipsDate={pbs.bestShipsDate}
          bestSessionsCount={pbs.bestSessionsCount}
          bestSessionsDate={pbs.bestSessionsDate}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <GlobalLeaderboard data={leaderboardData} viewerId={user.id} today={effectiveToday} />
      </div>

      <div style={{ marginBottom: 24 }}>
        <RollupPills
          weekTokens={weekTokens}
          weekDelta={weekDelta}
          monthTokens={monthTokens}
          daysActiveThisMonth={daysActiveThisMonth}
          daysInMonth={daysInMonth}
          shipsThisMonth={monthShips}
        />
      </div>

      <section style={{ marginTop: 32 }}>
        <h2 style={{ fontSize: '0.65rem', opacity: 0.5, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 12px' }}>rolling stats</h2>
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
          <BentoTile label="30-day trend" colSpan={6}>
            <TokenTrendChart stats={dailyStats} today={effectiveToday} />
          </BentoTile>
        </BentoGrid>
        <div style={{ marginTop: 12 }}>
          <BentoTile label="52-week activity">
            <ContributionHeatmap stats={dailyStats} today={effectiveToday} />
          </BentoTile>
        </div>
      </section>

      <section style={{ marginTop: 40, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <h2 style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.1em', margin: 0 }}>deep dive</h2>
        <StatsExplorer dailyStats={dailyStats} machineStats={initialData.machineStats} today={effectiveToday} />
      </section>
    </main>
  );
}

function pickNowProject(projects: Record<string, number>): string | null {
  const entries = Object.entries(projects).filter(([k]) => k && k !== '~' && k !== 'unknown').sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}
