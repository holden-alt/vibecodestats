'use client';

// Redesigned single-page profile (v2, no view tabs). Order by importance:
//   Identity bar → Standings (leaderboard + tier distribution, side-by-side) →
//   Your tokens (the spotlight line graph) → Team competition → Share card →
//   More stats (inline-expandable deep dive). Legibility system: dark-glass
//   cards, foil reserved for accents/headlines/tier letter, solid mono numbers.
//
// Live: polls the lightweight profile endpoint so the page updates as the owner
// (or anyone) pushes today.

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { IdentityBar } from '@/components/dashboard/profile/IdentityBar';
import { GlobalLeaderboard } from '@/components/dashboard/profile/GlobalLeaderboard';
import { TierDistribution } from '@/components/dashboard/profile/TierDistribution';
import { PercentilePanel } from '@/components/dashboard/profile/PercentilePanel';
import { TokenTrendChart } from '@/components/charts/v2/TokenTrendChart';
import { TeamScoreboard } from '@/components/dashboard/profile/TeamScoreboard';
import { ShareCard } from '@/components/dashboard/profile/ShareCard';
import { StreakAtRisk } from '@/components/dashboard/profile/StreakAtRisk';
import { MoreStats } from '@/components/dashboard/profile/MoreStats';
import { computeAllTimeTotals, computeStreak } from '@/lib/stats/aggregations';
import { computeTier } from '@/lib/stats/tier';
import { campScoreboard } from '@/lib/stats/team';
import { getTeamScoreboardMapsWindow } from '@/lib/stats/leaderboard-data';
import { rankUsers } from '@/lib/stats/leaderboard';
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

export function ProfileLive({
  initialData,
  leaderboardData,
  initialLiveRanking,
  today,
  viewerIsOwner,
  hasEverPushed,
}: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user } = initialData;

  // Keep the profile live without a long-lived socket. The existing rank hook
  // uses the same 30-second cadence, which is fast enough for the dashboard and
  // substantially cheaper at the edge than an always-on realtime service.
  useEffect(() => {
    let cancelled = false;
    const refresh = async () => {
      try {
        const response = await fetch(`/api/profile/live?user=${encodeURIComponent(user.id)}`);
        if (!response.ok) return;
        const rows = (await response.json()) as DailyStat[];
        if (!cancelled) setDailyStats(rows);
      } catch {
        // A missed poll is harmless; the next interval retries.
      }
    };
    const interval = window.setInterval(refresh, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [user.id]);

  const effectiveToday = useMemo(() => {
    if (dailyStats.find((s) => s.date === today)) return today;
    return dailyStats[0]?.date ?? today;
  }, [dailyStats, today]);

  const todayRow = useMemo(
    () => dailyStats.find((s) => s.date === effectiveToday),
    [dailyStats, effectiveToday],
  );
  const tokensToday = todayRow?.tokens_total ?? 0;
  const projectsTouched = (todayRow?.projects_touched as Record<string, number>) ?? {};
  const nowProject = pickNowProject(projectsTouched);
  const streakDays = computeStreak(dailyStats, effectiveToday);

  const allTime = useMemo(() => computeAllTimeTotals(dailyStats), [dailyStats]);

  // Tier = rolling-90-day token volume vs the field's 90-day volumes (current
  // form, not lifetime). Single source for the tier across every surface here.
  const tierSource = leaderboardData.recent90ByUser ?? leaderboardData.allTimeByUser;
  const cohort90 = useMemo(() => Object.values(tierSource), [tierSource]);
  const viewer90 = tierSource[user.id] ?? 0;
  const tierResult = useMemo(() => computeTier(viewer90, cohort90), [viewer90, cohort90]);

  // Headline rank = this month: your place out of everyone active this month.
  const monthRanked = useMemo(
    () =>
      rankUsers(leaderboardData, {
        metric: 'tokens',
        window: 'month',
        scope: 'global',
        viewerId: user.id,
        today: effectiveToday,
      }),
    [leaderboardData, user.id, effectiveToday],
  );
  const rankMonth = monthRanked.find((e) => e.isViewer)?.rank ?? monthRanked.length;
  const rankTotal = monthRanked.length;

  // Today's active field (everyone with a row on effectiveToday) — drives both
  // today's tier and the "top N% today" on the share card. Ranking against the
  // same effectiveToday field keeps the web card and the OG card identical (and
  // avoids the literal-today "top 100%" wart on a quiet morning).
  const todayBoard = useMemo(
    () =>
      leaderboardData.users
        .map((u) => {
          const t = leaderboardData.statsByUser[u.id]?.find((s) => s.date === effectiveToday)
            ?.tokens_total;
          return t == null ? null : { id: u.id, tokens: t };
        })
        .filter((r): r is { id: string; tokens: number } => r !== null),
    [leaderboardData, effectiveToday],
  );
  const todayTier = useMemo(
    () => computeTier(tokensToday, todayBoard.map((r) => r.tokens)).tier,
    [tokensToday, todayBoard],
  );
  const percentileToday = useMemo(() => {
    if (todayBoard.length === 0) return 100;
    const sorted = [...todayBoard].sort((a, b) => b.tokens - a.tokens);
    const rank = sorted.findIndex((r) => r.id === user.id) + 1;
    return rank > 0 ? Math.max(1, Math.ceil((rank / sorted.length) * 100)) : 100;
  }, [todayBoard, user.id]);

  // Team scoreboards — one per window (today / week / month / all-time). Pure
  // aggregations over the already-loaded statsByUser; no new DB query.
  const teamBoards = useMemo(
    () => ({
      daily: campScoreboard(getTeamScoreboardMapsWindow(leaderboardData, effectiveToday, 'today')),
      week: campScoreboard(getTeamScoreboardMapsWindow(leaderboardData, effectiveToday, 'week')),
      month: campScoreboard(getTeamScoreboardMapsWindow(leaderboardData, effectiveToday, 'month')),
      all: campScoreboard(getTeamScoreboardMapsWindow(leaderboardData, effectiveToday, 'all')),
    }),
    [leaderboardData, effectiveToday],
  );

  return (
    <main
      className="cc-profile-main"
      style={{
        maxWidth: 1180,
        margin: '0 auto',
        padding: 'clamp(20px, 4vw, 36px) clamp(16px, 4vw, 24px) 72px',
        display: 'flex',
        flexDirection: 'column',
        gap: 44,
      }}
    >
      {/* 1 — Identity bar (+ owner setup nudge + streak-at-risk) */}
      <div style={{ marginBottom: -16 }}>
        <IdentityBar
          user={user}
          tier={tierResult.tier}
          rankMonth={rankMonth}
          rankTotal={rankTotal}
          isHandcoder={tierResult.isHandcoder}
          allTimeTokens={allTime.tokens}
          team={user.team}
          nowProject={nowProject}
        />

        {viewerIsOwner && !hasEverPushed && (
          <div
            className="neon-glass"
            style={{
              padding: '14px 18px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginTop: 16,
              flexWrap: 'wrap',
            }}
          >
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.9rem', fontWeight: 700 }}>
                your stats aren&apos;t flowing yet
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: '0.78rem',
                  color: 'var(--neon-txt-dim)',
                  marginTop: 2,
                }}
              >
                install the Claude Code Stop hook so every CC turn pushes to this profile.
              </div>
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
      </div>

      {/* 2 — Standings: leaderboard + tier distribution, side by side */}
      <section>
        <SectionLabel>Standings</SectionLabel>
        <div className="cc-world-grid">
          <GlobalLeaderboard data={leaderboardData} viewerId={user.id} today={effectiveToday} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            <TierDistribution cohortAllTime={cohort90} viewerTier={tierResult.tier} />
            <PercentilePanel data={leaderboardData} viewerId={user.id} today={effectiveToday} />
          </div>
        </div>
      </section>

      {/* 3 — Your tokens: the spotlight line graph */}
      <section>
        <SectionLabel>Your tokens</SectionLabel>
        <div className="neon-glass" style={{ padding: 'clamp(18px, 3.5vw, 26px)' }}>
          <TokenTrendChart stats={dailyStats} today={effectiveToday} height={300} hideTitle />
          <div
            style={{
              marginTop: 10,
              fontFamily: 'var(--font-body)',
              fontSize: 12,
              color: 'var(--neon-txt-dim)',
            }}
          >
            Tokens per day. Hover any point for the exact count. The cyan line is your 7-day
            average; the yellow dot is your peak day in range.
          </div>
        </div>
      </section>

      {/* 4 — Team competition */}
      <section>
        <TeamScoreboard boards={teamBoards} />
        <p
          style={{
            marginTop: 10,
            fontFamily: 'var(--font-body)',
            fontSize: 11,
            color: 'var(--neon-txt-dim)',
            opacity: 0.55,
            letterSpacing: '0.03em',
          }}
        >
          Claude Code and Codex are trademarks of Anthropic and OpenAI. vibecodestats.dev is
          independent and unaffiliated.
        </p>
      </section>

      {/* 5 — Share card */}
      <section>
        <div style={{ maxWidth: 520, margin: '0 auto' }}>
          <ShareCard
            handle={user.github_handle}
            overallTier={tierResult.tier}
            todayTier={todayTier}
            allTimeTokens={allTime.tokens}
            todayTokens={tokensToday}
            percentileToday={percentileToday}
            rank={tierResult.rank}
            viewerIsOwner={viewerIsOwner}
            team={user.team}
          />
        </div>
      </section>

      {/* 6 — More stats (inline expandable deep dive) */}
      <section>
        <MoreStats
          dailyStats={dailyStats}
          machineStats={initialData.machineStats}
          today={effectiveToday}
          viewerId={user.id}
          liveRanking={initialLiveRanking}
        />
      </section>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: 12,
        letterSpacing: '0.28em',
        textTransform: 'uppercase',
        color: 'var(--team-cx)',
        textShadow: '0 0 14px rgba(60,216,255,0.6)',
        marginBottom: 14,
      }}
    >
      {children}
    </div>
  );
}

function pickNowProject(projects: Record<string, number>): string | null {
  const entries = Object.entries(projects)
    .filter(([k]) => k && k !== '~' && k !== 'unknown')
    .sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}
