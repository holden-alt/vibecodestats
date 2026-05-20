'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatsExplorer } from '@/components/StatsExplorer';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { GroupLeaderboardSection } from '@/components/GroupLeaderboardSection';
import { IdentityStrip } from '@/components/dashboard/profile/IdentityStrip';
import { HeroBlock } from '@/components/dashboard/profile/HeroBlock';
import { BentoGrid } from '@/components/dashboard/profile/BentoGrid';
import { BentoTile } from '@/components/dashboard/BentoTile';
import { TokenTrendChart } from '@/components/charts/v2/TokenTrendChart';
import { ModelMix } from '@/components/charts/v2/ModelMix';
import { TimeOfDayHistogram } from '@/components/charts/v2/TimeOfDayHistogram';
import { DayOfWeekChart } from '@/components/charts/v2/DayOfWeekChart';
import { ProjectsBarList } from '@/components/charts/v2/ProjectsBarList';
import { ContributionHeatmap } from '@/components/charts/v2/ContributionHeatmap';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { formatCompact } from '@/lib/format';
import { computeStreak } from '@/lib/stats/aggregations';
import { rankUsers } from '@/lib/stats/leaderboard';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

type ProfileLiveProps = {
  initialData: ProfileData;
  leaderboardData: LeaderboardData;
  today: string;
  initialLiveRanking?: LiveRanking;
};

export function ProfileLive({ initialData, leaderboardData, today }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user, machineStats = [] } = initialData;

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
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user.id]);

  // Server passes UTC `today`, but the ingest pipeline writes rows keyed by the
  // user's LOCAL date. To avoid showing 0 while the user is still in their local
  // "today" (and UTC has rolled over), prefer the most recent row when the
  // server-computed UTC date has no data yet.
  const effectiveToday = useMemo(() => {
    if (dailyStats.find((s) => s.date === today)) return today;
    return dailyStats[0]?.date ?? today; // dailyStats is sorted desc by date
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

  const sessionsToday = todayRow?.sessions ?? 0;
  const deepWorkMinutes = todayRow?.deep_work_minutes ?? 0;
  const shipsToday = (todayRow?.ships as { commits?: number; repos?: number } | undefined) ?? {};
  const projectsTouched = (todayRow?.projects_touched as Record<string, number>) ?? {};
  const tokensByModel = (todayRow?.tokens_by_model as Record<string, number>) ?? {};
  const hourlyTokens = (todayRow?.hourly_tokens as Record<string, number>) ?? {};

  const projectsTouchedCount = Object.keys(projectsTouched).length;
  const streakDays = computeStreak(dailyStats, effectiveToday);
  const nowProject = pickNowProject(projectsTouched);

  const globalRanked = useMemo(
    () => rankUsers(leaderboardData, { metric: 'tokens', window: 'month', scope: 'global', viewerId: user.id, today: effectiveToday }),
    [leaderboardData, user.id, effectiveToday],
  );
  const rank = globalRanked.find((e) => e.isViewer)?.rank ?? null;
  const squadSize = globalRanked.length > 0 ? globalRanked.length : null;

  const machineRowsToday = machineStats.filter((m) => m.date === effectiveToday);

  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 16px 48px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <IdentityStrip
        user={user}
        rank={rank}
        squadSize={squadSize}
        streakDays={streakDays}
        nowProject={nowProject}
      />
      <HeroBlock
        tokensToday={tokensToday}
        sessionsToday={sessionsToday}
        deepWorkMinutes={deepWorkMinutes}
        shipsToday={{ commits: shipsToday.commits ?? 0, repos: shipsToday.repos ?? 0 }}
        projectsTouchedCount={projectsTouchedCount}
        trendStats={dailyStats}
        deltaVsYesterday={deltaVsYesterday}
        deltaVs7dAvg={0}
        deltaVs30dAvg={0}
      />

      <BentoGrid>
        <BentoTile label="30-day tokens" colSpan={4} rowSpan={2}>
          <TokenTrendChart stats={dailyStats} />
        </BentoTile>
        <BentoTile
          label="rank in squad"
          {...(squadSize != null ? { sub: `of ${squadSize} members` } : {})}
          colSpan={2}
          href="/leaderboard"
        >
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--chart-5)' }}>
            {rank != null ? `#${rank}` : '—'}
          </span>
        </BentoTile>
        <BentoTile label="streak" sub="days in a row" colSpan={2}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--chart-3)' }}>
            <RollingNumber value={streakDays} />d
          </span>
        </BentoTile>

        <BentoTile label="model mix" colSpan={2}>
          <ModelMix tokensByModel={tokensByModel} />
        </BentoTile>
        <BentoTile label="hour of day" colSpan={2}>
          <TimeOfDayHistogram hourlyTokens={hourlyTokens} />
        </BentoTile>
        <BentoTile label="day of week" colSpan={2}>
          <DayOfWeekChart stats={dailyStats} />
        </BentoTile>

        <BentoTile label="top projects today" colSpan={3}>
          <ProjectsBarList projects={projectsTouched} />
        </BentoTile>
        <BentoTile label="machines" colSpan={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6rem' }}>
            {machineRowsToday.length === 0 && <div style={{ opacity: 0.6 }}>no machine data today</div>}
            {machineRowsToday.map((m) => (
              <div key={m.machine} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, border: '1px solid var(--chart-2)', borderRadius: 2 }} />
                <span>{m.machine}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{formatCompact(m.tokens_total)}</span>
              </div>
            ))}
          </div>
        </BentoTile>
        <BentoTile label="ships" sub={`across ${shipsToday.repos ?? 0} repos`} colSpan={1}>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--chart-5)' }}>
            <RollingNumber value={shipsToday.commits ?? 0} />
          </span>
        </BentoTile>
      </BentoGrid>

      <BentoTile label="52-week activity">
        <ContributionHeatmap stats={dailyStats} />
      </BentoTile>

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', opacity: 0.7, fontSize: '0.7rem' }}>deep dive — trends, projects, machines, leaderboard</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <StatsExplorer
            dailyStats={dailyStats}
            machineStats={machineStats}
            today={today}
          />
          <LeaderboardSection data={leaderboardData} viewerId={user.id} today={today} />
          {leaderboardData.viewerGroups.map((group) => (
            <GroupLeaderboardSection
              key={group.id}
              data={leaderboardData}
              viewerId={user.id}
              today={today}
              group={group}
            />
          ))}
        </div>
      </details>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </main>
  );
}

function pickNowProject(projects: Record<string, number>): string | null {
  const entries = Object.entries(projects).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}
