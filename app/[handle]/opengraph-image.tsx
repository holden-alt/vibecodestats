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

    const { data: stats } = await supabase
      .from('daily_stats')
      .select('tokens_total')
      .eq('user_id', user.id);

    const allTimeTokens = (stats ?? []).reduce(
      (s, r) => s + Number(r.tokens_total ?? 0),
      0,
    );
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

          <div style={{ display: 'flex' }}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                marginRight: 80,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  opacity: 0.55,
                  letterSpacing: '2px',
                }}
              >
                ALL-TIME TOKENS
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 84,
                  fontWeight: 700,
                  color: '#d97757',
                  marginTop: 8,
                }}
              >
                {formatCompact(allTimeTokens)}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  display: 'flex',
                  fontSize: 22,
                  opacity: 0.55,
                  letterSpacing: '2px',
                }}
              >
                DAYS ACTIVE
              </div>
              <div
                style={{
                  display: 'flex',
                  fontSize: 84,
                  fontWeight: 700,
                  color: '#6bbfd9',
                  marginTop: 8,
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
  } catch {
    return fallback(handle);
  }
}
