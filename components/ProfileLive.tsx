'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatsExplorer } from '@/components/StatsExplorer';
import { IdentityStrip } from '@/components/dashboard/profile/IdentityStrip';
import { ShareOnX } from '@/components/dashboard/profile/ShareOnX';
import { HeroBlock } from '@/components/dashboard/profile/HeroBlock';
import { TeamScoreboard } from '@/components/dashboard/profile/TeamScoreboard';
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
  computeWeekTotal,
  computeMonthTotal,
  computeAllTimeTotals,
  computePersonalBests,
  computeNextMilestone,
} from '@/lib/stats/aggregations';
import { computeTier, gapToNextTier } from '@/lib/stats/tier';
import { campScoreboard } from '@/lib/stats/team';
import { getTeamScoreboardMaps } from '@/lib/stats/leaderboard-data';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type ProfileLiveProps = {
  initialData: ProfileData;
  leaderboardData: LeaderboardData;
  initialLiveRanking: LiveRanking;
  today: string;
  viewerIsOwner: boolean;
  hasEverPushed: boolean;
};

export function ProfileLive({ initialData, leaderboardData, initialLiveRanking, today, viewerIsOwner, hasEverPushed }: ProfileLiveProps) {
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

  const tokensToday = todayRow?.tokens_total ?? 0;

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

  // Tier + gap-to-next-tier computed ONCE here from the all-time total vs the
  // active cohort, then shared by IdentityStrip (T1) and HeroBlock (T2) so the
  // two surfaces never diverge. Cohort = Object.values(allTimeByUser), the same
  // source rankUsers uses (leaderboard.ts:92).
  const cohort = useMemo(() => Object.values(leaderboardData.allTimeByUser), [leaderboardData]);
  const tierResult = useMemo(() => computeTier(allTime.tokens, cohort), [allTime.tokens, cohort]);
  const tierGap = useMemo(() => gapToNextTier(allTime.tokens, cohort), [allTime.tokens, cohort]);

  // Live daily Team Scoreboard (T3). Pure aggregation over the already-loaded
  // statsByUser for the current day. No new DB query.
  const teamScoreboard = useMemo(
    () => campScoreboard(getTeamScoreboardMaps(leaderboardData, effectiveToday)),
    [leaderboardData, effectiveToday],
  );

  return (
    <main className="cc-profile-main" style={{
      maxWidth: 1400,
      margin: '0 auto',
      padding: '24px 24px 64px',
      display: 'flex',
      flexDirection: 'column',
      gap: 0,
    }}>
      <div style={{ marginBottom: 12 }}>
        <IdentityStrip
          user={user}
          rank={null}
          squadSize={null}
          tier={tierResult.tier}
          team={user.team}
          gap={tierGap}
          streakDays={streakDays}
          nowProject={nowProject}
        />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <ShareOnX
          handle={user.github_handle}
          tokensToday={tokensToday}
          rank={initialLiveRanking.rank}
          viewerIsOwner={viewerIsOwner}
        />
      </div>

      {viewerIsOwner && !hasEverPushed && (
        <div style={{
          border: '1px dashed var(--chart-1)',
          background: 'rgba(217,119,87,0.08)',
          borderRadius: 3,
          padding: '14px 18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}>
          <div>
            <div style={{ fontSize: '0.95rem', fontWeight: 600 }}>your stats aren&apos;t flowing yet</div>
            <div style={{ fontSize: '0.7rem', opacity: 0.75, marginTop: 2 }}>install the Claude Code Stop hook so every CC turn pushes to this profile.</div>
          </div>
          <Link href="/setup" prefetch={false} style={{ background: 'var(--chart-1)', color: 'var(--color-bg)', padding: '8px 14px', borderRadius: 2, fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}>
            set up sync →
          </Link>
        </div>
      )}

      <StreakAtRisk streakDays={streakDays} todayTokens={tokensToday} />

      <div style={{ marginBottom: 24 }}>
        <HeroBlock
          allTimeTokens={allTime.tokens}
          tier={tierResult.tier}
          topPercentLabel={tierResult.topPercentLabel}
          rank={tierResult.rank}
          isHandcoder={tierResult.isHandcoder}
          sessionsToday={sessionsToday}
          shipsToday={{ commits: shipsToday.commits ?? 0, repos: shipsToday.repos ?? 0 }}
          projectsTouchedCount={projectsTouchedCount}
          trendStats={dailyStats}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <TeamScoreboard scoreboard={teamScoreboard} />
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
