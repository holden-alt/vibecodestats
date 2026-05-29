import { ImageResponse } from 'next/og';
import { todayLocal } from '@/lib/date';
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

    const today = todayLocal();

    // Pull TODAY's row for every user — we need this user's tokens +
    // their rank among the cohort that actually pushed today (for percentile).
    const { data: todayRows } = await supabase
      .from('daily_stats')
      .select('user_id, tokens_total')
      .eq('date', today);

    const rows = todayRows ?? [];
    const meRow = rows.find((r) => r.user_id === user.id);
    const tokensToday = meRow ? Number(meRow.tokens_total ?? 0) : 0;

    // Today's rank + percentile, computed against everyone who pushed today.
    // Sort descending by tokens; resolves rank by ordinal position. If no
    // activity yet, fall back to a clean "no rank today" state on the card.
    const activeToday = rows.filter((r) => Number(r.tokens_total ?? 0) > 0);
    activeToday.sort((a, b) => Number(b.tokens_total ?? 0) - Number(a.tokens_total ?? 0));
    const rankIdx = activeToday.findIndex((r) => r.user_id === user.id);
    const rank = rankIdx >= 0 ? rankIdx + 1 : null;
    const cohort = activeToday.length;
    // Percentile: 1 / N → top N%; smaller is better. Top of leaderboard = "top 1%".
    // Floor at 1% so it never reads "top 0%" which is confusing.
    const percentile = rank != null && cohort > 0
      ? Math.max(1, Math.ceil((rank / cohort) * 100))
      : null;

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
            padding: '60px 72px',
          }}
        >
          {/* top row: site + handle */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                display: 'flex',
                fontSize: 26,
                color: '#d97757',
                letterSpacing: '4px',
              }}
            >
              VIBECODESTATS.DEV
            </div>
            <div style={{ display: 'flex', fontSize: 64, fontWeight: 700, marginTop: 18 }}>
              @{handle}
            </div>
            {user.display_name ? (
              <div style={{ display: 'flex', fontSize: 24, opacity: 0.55, marginTop: 4 }}>
                {user.display_name}
              </div>
            ) : null}
          </div>

          {/* spacer — push tokens block to vertical center */}
          <div style={{ display: 'flex', flex: 1 }} />

          {/* tokens today — the hero number */}
          <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 12 }}>
            <div
              style={{
                display: 'flex',
                fontSize: 22,
                opacity: 0.55,
                letterSpacing: '4px',
              }}
            >
              TOKENS TODAY
            </div>
            <div
              style={{
                display: 'flex',
                fontSize: 140,
                fontWeight: 700,
                color: '#d97757',
                lineHeight: 1,
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {tokensToday > 0 ? formatCompact(tokensToday) : '—'}
            </div>
          </div>

          {/* footer row — percentile + rank */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              fontSize: 24,
              opacity: 0.75,
              marginTop: 18,
            }}
          >
            {percentile != null ? (
              <div style={{ display: 'flex', color: '#6bbfd9' }}>top {percentile}% today</div>
            ) : (
              <div style={{ display: 'flex', opacity: 0.5 }}>no activity today yet</div>
            )}
            {rank != null && cohort > 0 ? (
              <>
                <div style={{ display: 'flex', opacity: 0.4 }}>·</div>
                <div style={{ display: 'flex' }}>
                  #{rank} of {cohort.toLocaleString()}
                </div>
              </>
            ) : null}
          </div>
        </div>
      ),
      size,
    );
  } catch {
    return fallback(handle);
  }
}
