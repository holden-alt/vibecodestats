import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { getCardData } from '@/lib/og/card-data';
import { formatCompact } from '@/lib/format';
import { orbitron900, rajdhani700 } from '@/lib/og/fonts';
import type { Tier } from '@/lib/stats/tier';

export const alt = 'vibecodestats.dev profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// ---------------------------------------------------------------------------
// v2 design tokens — mirrors the web ShareCard ("This IS the OG image design").
// A full foil-gradient face with dark, legible text + loud branding. Foil is the
// whole face here (the share artifact), not a thin frame.
// ---------------------------------------------------------------------------

const FOIL =
  'linear-gradient(110deg,#ff2db3 0%,#ff8a3c 18%,#ffe93c 34%,#3cff8a 52%,#3cd8ff 70%,#9b5cff 86%,#ff2db3 100%)';
const SHEEN = 'linear-gradient(118deg, rgba(255,255,255,0.30) 0%, rgba(255,255,255,0) 42%)';
const INK = '#0a0010'; // near-black, reads on every foil hue
const INK_DIM = 'rgba(10,0,16,0.70)';

const letter = (t: Tier) => (t === 'handcoder' ? 'HC' : t.toUpperCase());

// ---------------------------------------------------------------------------
// Fallback card — not found / error
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Main OG route — one foil-face design, today + all-time stats
// ---------------------------------------------------------------------------

export default async function OG({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;

  try {
    const supabase = await createClient();
    const card = await getCardData(supabase, handle);

    if (!card) {
      return fallback(handle);
    }

    const fonts = [
      { name: 'Orbitron', data: orbitron900, weight: 900 as const, style: 'normal' as const },
      { name: 'Rajdhani', data: rajdhani700, weight: 700 as const, style: 'normal' as const },
    ];

    const nameStr = card.displayName ?? handle;
    const teamLabel =
      card.team === 'claude_code'
        ? 'TEAM CLAUDE CODE'
        : card.team === 'codex'
          ? 'TEAM CODEX'
          : null;

    const zeroHandcoder = card.isHandcoder && card.allTimeTokens === 0;

    return new ImageResponse(
      (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            padding: 56,
            background: FOIL,
            color: INK,
            position: 'relative',
            fontFamily: 'Rajdhani',
          }}
        >
          {/* holographic sheen overlay */}
          <div style={{ position: 'absolute', inset: 0, display: 'flex', background: SHEEN }} />

          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'space-between',
              position: 'relative',
            }}
          >
            {/* TOP — wordmark + team */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 40, letterSpacing: 1 }}>
                  VIBECODESTATS.DEV
                </div>
                <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 22, letterSpacing: 6, color: INK_DIM, marginTop: 2 }}>
                  STRAVA FOR AI CODING
                </div>
              </div>
              {teamLabel && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 22,
                    letterSpacing: 2,
                    padding: '10px 20px',
                    borderRadius: 999,
                    border: `2px solid ${INK}`,
                    background: 'rgba(10,0,16,0.10)',
                  }}
                >
                  {teamLabel}
                </div>
              )}
            </div>

            {/* MIDDLE — tier letter + handle + rank line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 36 }}>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Orbitron',
                  fontWeight: 900,
                  fontSize: 230,
                  lineHeight: 0.82,
                  textShadow: '0 3px 0 rgba(255,255,255,0.45)',
                }}
              >
                {letter(card.tier)}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 64, lineHeight: 1 }}>
                  @{card.handle}
                </div>
                {nameStr !== card.handle && (
                  <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 30, color: INK_DIM, marginTop: 2 }}>
                    {nameStr}
                  </div>
                )}
                <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 30, letterSpacing: 2, marginTop: 12 }}>
                  {zeroHandcoder
                    ? 'NOTHING TO RANK YET · PICK A TEAM'
                    : `NO. ${card.rank} GLOBAL · TOP ${card.todayPercentLabel}% TODAY`}
                </div>
              </div>
            </div>

            {/* BOTTOM — stat strip: today / today tier / all-time */}
            <div style={{ display: 'flex', gap: 24 }}>
              <Stat k="TODAY" v={formatCompact(card.todayTokens)} />
              <Stat k="TODAY TIER" v={letter(card.todayTier)} />
              <Stat k="ALL-TIME" v={formatCompact(card.allTimeTokens)} />
            </div>
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  } catch {
    return fallback(handle);
  }
}

// Stat block on the foil face — dark label + big dark Orbitron value.
function Stat({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flex: 1,
        flexDirection: 'column',
        padding: '18px 22px',
        borderRadius: 16,
        background: 'rgba(10,0,16,0.10)',
        border: `2px solid rgba(10,0,16,0.22)`,
      }}
    >
      <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 22, letterSpacing: 3, color: INK_DIM }}>
        {k}
      </div>
      <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 52, marginTop: 4 }}>
        {v}
      </div>
    </div>
  );
}
