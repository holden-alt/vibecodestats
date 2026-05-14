'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatusBar } from '@/components/StatusBar';
import { BuildsPane } from '@/components/BuildsPane';
import { ActivityPane } from '@/components/ActivityPane';
import { PersonaPane } from '@/components/PersonaPane';
import { TrendsSection } from '@/components/TrendsSection';
import { StatsExplorer } from '@/components/StatsExplorer';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';

type ProfileLiveProps = {
  initialData: ProfileData;
  today: string; // YYYY-MM-DD, computed server-side for hydration stability
};

export function ProfileLive({ initialData, today }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user, machineStats } = initialData;

  useEffect(() => {
    const supabase = createClient();
    const baseChannel: RealtimeChannel = supabase.channel(`daily_stats:${user.id}`);
    // The typed `.on` overloads don't expose a clean `postgres_changes` literal
    // signature here; cast to call the postgres-changes overload directly.
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
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const todayStat = useMemo(
    () => dailyStats.find((r) => r.date === today) ?? null,
    [dailyStats, today],
  );

  const tokensToday = todayStat?.tokens_total ?? 0;
  const sessionsToday = todayStat?.sessions ?? 0;
  const machinesToday = todayStat?.machines ?? [];
  const deepWorkToday = todayStat?.deep_work_minutes ?? 0;
  const tokensByModel = (todayStat?.tokens_by_model ?? {}) as Record<string, number>;
  const projectsToday = (todayStat?.projects_touched ?? {}) as Record<string, number>;

  const streakDays = computeStreak(dailyStats, today);

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1400px] mx-auto">
      <StatusBar
        handle={user.github_handle}
        primaryPersona={user.primary_persona ?? null}
        streakDays={streakDays}
        tokensToday={tokensToday}
      />
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.2fr] gap-3 mt-4">
        <BuildsPane projects={projectsToday} />
        <ActivityPane
          tokensToday={tokensToday}
          sessionsToday={sessionsToday}
          machinesCount={machinesToday.length}
          deepWorkMinutes={deepWorkToday}
          tokensByModel={tokensByModel}
          dailyStats={dailyStats}
          today={today}
        />
        <PersonaPane
          primary={user.primary_persona ?? null}
          secondary={user.secondary_personas ?? []}
        />
      </section>
      <TrendsSection dailyStats={dailyStats} today={today} />
      <StatsExplorer dailyStats={dailyStats} machineStats={machineStats} today={today} />
    </main>
  );
}

function computeStreak(stats: DailyStat[], today: string): number {
  const active = new Set(stats.filter((s) => s.tokens_total > 0).map((s) => s.date));
  let streak = 0;
  const cursor = new Date(today + 'T00:00:00Z');
  // Walk backwards day by day while the date is active.
  // Today not yet active still allows the streak to count from yesterday.
  if (!active.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
