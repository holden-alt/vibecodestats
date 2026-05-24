import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { formatCompact } from '@/lib/format';

export const runtime = 'edge';
export const alt = 'vibecodestats.dev — Strava for AI coding';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

function fallback() {
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
          fontSize: 56,
        }}
      >
        vibecodestats.dev
      </div>
    ),
    size,
  );
}

export default async function SiteOG() {
  try {
    const supabase = await createClient();
    const today = new Date().toISOString().slice(0, 10);

    // Live aggregate stats. Three queries, all small.
    const [usersRes, todayRes, peakRes] = await Promise.all([
      // Total registered users.
      supabase.from('users').select('id', { count: 'exact', head: true }),
      // Today's aggregate tokens + count of active users.
      supabase
        .from('daily_stats')
        .select('user_id, tokens_total')
        .eq('date', today),
      // Today's top VBW with handle.
      supabase
        .from('daily_stats')
        .select('user_id, vbw_total, users:user_id (github_handle)')
        .eq('date', today)
        .order('vbw_total', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const totalUsers = usersRes.count ?? 0;
    const todayRows = todayRes.data ?? [];
    const tokensToday = todayRows.reduce((s, r) => s + Number(r.tokens_total ?? 0), 0);
    const activeToday = todayRows.filter((r) => Number(r.tokens_total ?? 0) > 0).length;

    const peak = peakRes.data as
      | { vbw_total: number; users: { github_handle: string } | null }
      | null;
    const peakVbw = peak?.vbw_total ?? 0;
    const peakHandle = peak?.users?.github_handle ?? null;

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
          {/* brand */}
          <div
            style={{
              display: 'flex',
              fontSize: 32,
              color: '#d97757',
              letterSpacing: '5px',
            }}
          >
            VIBECODESTATS.DEV
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 72,
              fontWeight: 700,
              marginTop: 16,
              lineHeight: 1.1,
              maxWidth: '85%',
            }}
          >
            Strava for AI coding.
          </div>

          <div
            style={{
              display: 'flex',
              fontSize: 26,
              opacity: 0.65,
              marginTop: 14,
              maxWidth: '85%',
              lineHeight: 1.4,
            }}
          >
            Track Claude Code + Codex daily token usage and VBW productivity score.
          </div>

          <div style={{ display: 'flex', flex: 1 }} />

          {/* live aggregate stats row */}
          <div
            style={{
              display: 'flex',
              gap: 28,
              borderTop: '1px solid rgba(217, 119, 87, 0.25)',
              paddingTop: 28,
            }}
          >
            <Stat label="DEVELOPERS" value={String(totalUsers)} color="#d97757" />
            <Stat label="ACTIVE TODAY" value={String(activeToday)} color="#6bbfd9" />
            <Stat
              label="TOKENS TODAY"
              value={tokensToday > 0 ? formatCompact(tokensToday) : '—'}
              color="#8fbc8f"
            />
            <Stat
              label="⚡ TOP VBW TODAY"
              value={peakVbw > 0 ? peakVbw.toLocaleString() : '—'}
              {...(peakHandle ? { subtitle: `@${peakHandle}` } : {})}
              color="#e3c466"
            />
          </div>
        </div>
      ),
      size,
    );
  } catch {
    return fallback();
  }
}

function Stat({
  label,
  value,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  color: string;
  subtitle?: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1 }}>
      <div
        style={{
          display: 'flex',
          fontSize: 16,
          opacity: 0.6,
          letterSpacing: '2px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          display: 'flex',
          fontSize: 52,
          fontWeight: 700,
          color,
          marginTop: 6,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
        }}
      >
        {value}
      </div>
      {subtitle ? (
        <div
          style={{
            display: 'flex',
            fontSize: 18,
            opacity: 0.55,
            marginTop: 2,
          }}
        >
          {subtitle}
        </div>
      ) : null}
    </div>
  );
}
