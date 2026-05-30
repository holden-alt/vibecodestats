'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatsExplorer } from '@/components/StatsExplorer';
import { PlayerCard } from '@/components/dashboard/profile/PlayerCard';
import { ShareCard } from '@/components/dashboard/profile/ShareCard';
import { TeamScoreboard } from '@/components/dashboard/profile/TeamScoreboard';
import { TierDistribution } from '@/components/dashboard/profile/TierDistribution';
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
import { formatCompact } from '@/lib/format';
import {
  getTeamScoreboardMaps,
  getTeamScoreboardMapsAllTime,
} from '@/lib/stats/leaderboard-data';
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

type ProfileView = 'overview' | 'tiers' | 'team';

const VIEWS: { id: ProfileView; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'tiers', label: 'Tier Distribution' },
  { id: 'team', label: 'Team Daily' },
];

export function ProfileLive({ initialData, leaderboardData, initialLiveRanking, today, viewerIsOwner, hasEverPushed }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const [view, setView] = useState<ProfileView>('overview');
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
  // active cohort, then shared by every surface (the player card, the tier
  // distribution marker) so they never diverge. Cohort = Object.values(
  // allTimeByUser), the same source rankUsers uses (leaderboard.ts:92).
  const cohort = useMemo(() => Object.values(leaderboardData.allTimeByUser), [leaderboardData]);
  const tierResult = useMemo(() => computeTier(allTime.tokens, cohort), [allTime.tokens, cohort]);
  const tierGap = useMemo(() => gapToNextTier(allTime.tokens, cohort), [allTime.tokens, cohort]);

  // Team Scoreboard (T3). DAILY is the default; all-time is the toggle. Both are
  // pure aggregations over the already-loaded statsByUser. No new DB query.
  const teamDaily = useMemo(
    () => campScoreboard(getTeamScoreboardMaps(leaderboardData, effectiveToday)),
    [leaderboardData, effectiveToday],
  );
  const teamAllTime = useMemo(
    () => campScoreboard(getTeamScoreboardMapsAllTime(leaderboardData)),
    [leaderboardData],
  );

  return (
    <main
      className="cc-profile-main"
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 'clamp(16px, 4vw, 32px) clamp(16px, 4vw, 24px) 64px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
      }}
    >
      {/* Identity header — handle + tier + team, neon styled */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          flexWrap: 'wrap',
          rowGap: 10,
          marginBottom: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: '50%',
              flexShrink: 0,
              background: user.avatar_url
                ? `url(${user.avatar_url}) center/cover`
                : 'var(--foil-gradient)',
              boxShadow: '0 0 14px var(--neon-glow-foil)',
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: '1.05rem' }}>
              @{user.github_handle}
            </span>
            {user.display_name && (
              <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--neon-txt-dim)' }}>
                {user.display_name}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span
            className={tierResult.tier === 'S' ? 'neon-foil-text-static' : undefined}
            style={{
              fontFamily: 'var(--font-display)',
              fontWeight: 800,
              fontSize: '0.85rem',
              letterSpacing: '0.08em',
              padding: '4px 12px',
              borderRadius: 999,
              border: '1px solid var(--neon-line)',
              background: 'rgba(255,255,255,0.04)',
              color: tierResult.tier === 'S' ? undefined : 'var(--neon-txt)',
            }}
          >
            {tierResult.tier === 'handcoder' ? 'HANDCODER' : `${tierResult.tier.toUpperCase()} TIER`}
          </span>
          {tierGap.nextTier != null && (
            <span style={{ fontFamily: 'var(--font-body)', fontSize: '0.75rem', color: 'var(--neon-txt-dim)' }}>
              {formatCompact(tierGap.tokensNeeded)} from {tierGap.nextTier.toUpperCase()}
            </span>
          )}
          {user.team != null && (
            <span
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: '0.7rem',
                letterSpacing: '0.08em',
                padding: '4px 10px',
                borderRadius: 999,
                color: user.team === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)',
                border: `1px solid ${user.team === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)'}`,
              }}
            >
              {user.team === 'codex' ? 'TEAM CODEX' : 'TEAM CLAUDE CODE'}
            </span>
          )}
          {nowProject && (
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: '0.72rem',
                color: 'var(--team-cc)',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                maxWidth: 220,
                overflow: 'hidden',
              }}
            >
              <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: 'var(--team-cc)', animation: 'cc-pulse 1.5s ease-in-out infinite' }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>now: {nowProject}</span>
            </span>
          )}
        </div>
      </div>

      {/* Primary view switcher — Overview / Tier Distribution / Team Daily */}
      <nav
        aria-label="Profile views"
        style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 22 }}
      >
        {VIEWS.map((v) => {
          const active = v.id === view;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-pressed={active}
              style={{
                fontFamily: 'var(--font-display)',
                fontSize: 11,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                padding: '9px 18px',
                borderRadius: 999,
                cursor: 'pointer',
                border: `1px solid ${active ? 'transparent' : 'var(--neon-line)'}`,
                background: active ? 'rgba(255,45,179,0.12)' : 'rgba(255,255,255,0.03)',
                color: active ? '#ffd9f2' : 'var(--neon-txt-dim)',
                boxShadow: active ? '0 0 22px rgba(255,45,179,0.3), inset 0 0 16px rgba(255,45,179,0.16)' : 'none',
              }}
            >
              {v.label}
            </button>
          );
        })}
      </nav>

      {viewerIsOwner && !hasEverPushed && (
        <div
          className="neon-glass"
          style={{
            padding: '14px 18px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 22,
            flexWrap: 'wrap',
          }}
        >
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700 }}>your stats aren&apos;t flowing yet</div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: '0.78rem', color: 'var(--neon-txt-dim)', marginTop: 2 }}>install the Claude Code Stop hook so every CC turn pushes to this profile.</div>
          </div>
          <Link
            href="/setup"
            prefetch={false}
            style={{
              fontFamily: 'var(--font-display)',
              fontSize: '0.72rem',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#110018',
              backgroundImage: 'var(--foil-gradient)',
              padding: '9px 16px',
              borderRadius: 10,
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            set up sync →
          </Link>
        </div>
      )}

      <StreakAtRisk streakDays={streakDays} todayTokens={tokensToday} />

      {/* ── OVERVIEW VIEW ───────────────────────────────────────────────── */}
      {view === 'overview' && (
        <>
          <div className="cc-profile-card-row" style={{ display: 'grid', gridTemplateColumns: '1.15fr 1fr', gap: 24, marginBottom: 24, alignItems: 'start' }}>
            <PlayerCard
              user={user}
              tier={tierResult.tier}
              rank={tierResult.rank}
              topPercentLabel={tierResult.topPercentLabel}
              isHandcoder={tierResult.isHandcoder}
              allTimeTokens={allTime.tokens}
              team={user.team}
              peakDayTokens={pbs.bestDayTokens}
              peakDayDate={pbs.bestDayDate}
              sessionsAllTime={allTime.sessions}
              activeDays={allTime.daysActive}
            />
            <ShareCard
              handle={user.github_handle}
              tier={tierResult.tier}
              allTimeTokens={allTime.tokens}
              rank={tierResult.rank}
              tokensToday={tokensToday}
              liveRank={initialLiveRanking.rank}
              viewerIsOwner={viewerIsOwner}
            />
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 18, fontFamily: 'var(--font-body)', fontSize: '0.8rem', color: 'var(--neon-txt-dim)' }}>
            {sessionsToday} sessions · {shipsToday.commits ?? 0} ships · {projectsTouchedCount} projects today
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
            <RollupPills
              weekTokens={weekTokens}
              weekDelta={weekDelta}
              monthTokens={monthTokens}
              daysActiveThisMonth={daysActiveThisMonth}
              daysInMonth={daysInMonth}
              shipsThisMonth={monthShips}
            />
          </div>

          <section style={{ marginTop: 8 }}>
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--neon-txt-dim)', textTransform: 'uppercase', letterSpacing: '0.18em', margin: '0 0 12px' }}>rolling stats</h2>
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
            <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '0.7rem', color: 'var(--neon-txt-dim)', textTransform: 'uppercase', letterSpacing: '0.18em', margin: 0 }}>deep dive</h2>
            <StatsExplorer dailyStats={dailyStats} machineStats={initialData.machineStats} today={effectiveToday} />
          </section>
        </>
      )}

      {/* ── TIER DISTRIBUTION VIEW ──────────────────────────────────────── */}
      {view === 'tiers' && (
        <div style={{ marginBottom: 24 }}>
          <TierDistribution cohortAllTime={cohort} viewerTier={tierResult.tier} />
        </div>
      )}

      {/* ── TEAM DAILY VIEW ─────────────────────────────────────────────── */}
      {view === 'team' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <TeamScoreboard daily={teamDaily} allTime={teamAllTime} />
          <GlobalLeaderboard data={leaderboardData} viewerId={user.id} today={effectiveToday} />
        </div>
      )}
    </main>
  );
}

function pickNowProject(projects: Record<string, number>): string | null {
  const entries = Object.entries(projects).filter(([k]) => k && k !== '~' && k !== 'unknown').sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}
