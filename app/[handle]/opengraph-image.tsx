import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { formatCompact } from '@/lib/format';

export const runtime = 'edge';
export const alt = 'cc-dashboard profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function OG({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const supabase = await createClient();
  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) {
    return new ImageResponse(
      (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
            background: '#0d0d0d',
            color: '#ece6dc',
            fontFamily: 'ui-monospace, monospace',
            fontSize: 48,
          }}
        >
          vibecodestats.dev
        </div>
      ),
      size,
    );
  }

  const { data: stats } = await supabase
    .from('daily_stats')
    .select('tokens_total, date')
    .eq('user_id', user.id);

  const allTimeTokens = (stats ?? []).reduce((s, r) => s + r.tokens_total, 0);
  const daysActive = (stats ?? []).length;

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
          fontFamily: 'ui-monospace, monospace',
          padding: '64px 72px',
          boxSizing: 'border-box',
        }}
      >
        <div
          style={{
            fontSize: 28,
            color: '#d97757',
            textTransform: 'uppercase',
            letterSpacing: '0.15em',
          }}
        >
          vibecodestats.dev
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'baseline',
            marginTop: 32,
          }}
        >
          <div style={{ fontSize: 72, fontWeight: 700 }}>@{handle}</div>
        </div>
        {user.display_name ? (
          <div style={{ fontSize: 28, opacity: 0.6, marginTop: 4 }}>
            {user.display_name}
          </div>
        ) : null}
        <div style={{ display: 'flex', marginTop: 'auto' }}>
          <div style={{ display: 'flex', flexDirection: 'column', marginRight: 48 }}>
            <div
              style={{
                fontSize: 20,
                opacity: 0.55,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              all-time tokens
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#d97757',
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {formatCompact(allTimeTokens)}
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div
              style={{
                fontSize: 20,
                opacity: 0.55,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
              }}
            >
              days active
            </div>
            <div
              style={{
                fontSize: 72,
                fontWeight: 700,
                color: '#6bbfd9',
                marginTop: 6,
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {String(daysActive)}
            </div>
          </div>
        </div>
      </div>
    ),
    size,
  );
}
