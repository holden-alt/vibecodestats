import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { formatCompact } from '@/lib/format';

export const runtime = 'edge';
export const alt = 'vibecodestats.dev profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function fallback(handle: string) {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d0d0d',
          color: '#ece6dc',
          fontFamily: 'monospace',
          fontSize: 48,
        }}
      >
        @{handle} · vibecodestats.dev
      </div>
    ),
    size,
  );
}

type Stat = { label: string; value: string; color: string };

function StatBlock({ label, value, color }: Stat) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div
        style={{
          display: 'flex',
          fontSize: 20,
          opacity: 0.55,
          letterSpacing: '2px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 64,
          fontWeight: 700,
          color,
          marginTop: 6,
        }}
      >
        {value}
      </div>
    </div>
  );
}

export default async function OG({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  try {
    const supabase = await createClient();
    const { data: user } = await supabase
      .from('users')
      .select('id, github_handle, display_name')
      .eq('github_handle', handle)
      .maybeSingle();

    if (!user) {
      return fallback(handle);
    }

    // Pull every daily_stats row for EVERY user so we can compute all-time
    // rank in one query. ~1K users × ~30 days = ~30K rows, cheap on edge.
    const { data: allRows } = await supabase
      .from('daily_stats')
      .select('user_id, tokens_total, date');

    const today = new Date().toISOString().slice(0, 10);
    const rows = allRows ?? [];

    // Sum tokens per user (all-time) and find current user's rank.
    const allTimeByUser = new Map<string, number>();
    for (const r of rows) {
      const cur = allTimeByUser.get(r.user_id) ?? 0;
      allTimeByUser.set(r.user_id, cur + Number(r.tokens_total ?? 0));
    }
    const sortedAllTime = [...allTimeByUser.entries()].sort(
      (a, b) => b[1] - a[1],
    );
    const rankIdx = sortedAllTime.findIndex(([id]) => id === user.id);
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const allTimeTokens = allTimeByUser.get(user.id) ?? 0;

    // Filter for this user's rows to derive today + days active.
    const userRows = rows.filter((r) => r.user_id === user.id);
    const daysActive = userRows.length;
    const todayRow = userRows.find((r) => r.date === today);
    const todayTokens = todayRow ? Number(todayRow.tokens_total ?? 0) : 0;

    const stats: Stat[] = [
      {
        label: 'ALL-TIME',
        value: formatCompact(allTimeTokens),
        color: '#d97757', // orange
      },
      {
        label: 'RANK',
        value: rank !== null ? `#${rank}` : '—',
        color: '#6bbfd9', // cyan
      },
      {
        label: 'TODAY',
        value: todayTokens > 0 ? formatCompact(todayTokens) : '—',
        color: '#7ad17a', // green
      },
      {
        label: 'DAYS',
        value: String(daysActive),
        color: '#ece6dc', // bone
      },
    ];

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            background: '#0d0d0d',
            color: '#ece6dc',
            fontFamily: 'monospace',
            padding: '64px 72px',
          }}
        >
          <div
            style={{
              display: 'flex',
              fontSize: 28,
              color: '#d97757',
              letterSpacing: '4px',
            }}
          >
            VIBECODESTATS.DEV
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 80,
              fontWeight: 700,
              marginTop: 28,
            }}
          >
            @{handle}
          </div>

          {user.display_name ? (
            <div
              style={{
                display: 'flex',
                fontSize: 32,
                opacity: 0.6,
                marginTop: 6,
              }}
            >
              {user.display_name}
            </div>
          ) : null}

          <div style={{ display: 'flex', flex: 1 }} />

          <div style={{ display: 'flex', gap: 24 }}>
            {stats.map((s) => (
              <StatBlock key={s.label} {...s} />
            ))}
          </div>
        </div>
      ),
      size,
    );
  } catch {
    return fallback(handle);
  }
}
