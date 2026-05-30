import { ImageResponse } from 'next/og';
import { createClient } from '@/lib/supabase/server';
import { getCardData } from '@/lib/og/card-data';
import { formatCompact } from '@/lib/format';
import { orbitron900, rajdhani700 } from '@/lib/og/fonts';

export const alt = 'vibecodestats.dev profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// ---------------------------------------------------------------------------
// Design tokens
// ---------------------------------------------------------------------------

const FOIL = 'linear-gradient(110deg,#ff2db3 0%,#ff8a3c 18%,#ffe93c 34%,#3cff8a 52%,#3cd8ff 70%,#9b5cff 86%,#ff2db3 100%)';
const BG_RADIAL = 'radial-gradient(120% 120% at 50% 0%,#150d2e,#08060f 65%)';
const TEXT_LABEL = '#cdbaff';
const TEXT_DARK = '#08060f';
const CC_BORDER = '#ff8a3c';
const CC_TEXT = '#ffb47a';
const CC_BG = 'rgba(255,138,60,0.13)';
const CX_BORDER = '#3cd8ff';
const CX_TEXT = '#8fe6ff';
const CX_BG = 'rgba(60,216,255,0.13)';

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
// Main OG route
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
    const handleStr = `@${card.handle} · vibecodestats.dev`;

    // Team chip styling
    const chipBg = card.team === 'claude_code' ? CC_BG : CX_BG;
    const chipBorder = card.team === 'claude_code' ? CC_BORDER : CX_BORDER;
    const chipText = card.team === 'claude_code' ? CC_TEXT : CX_TEXT;
    const chipLabel = card.team === 'claude_code' ? 'TEAM CLAUDE CODE' : 'TEAM CODEX';
    const dotColor = card.team === 'claude_code' ? CC_BORDER : CX_BORDER;

    // -----------------------------------------------------------------------
    // HANDCODER — zero tokens variant
    // -----------------------------------------------------------------------

    if (card.isHandcoder && card.allTimeTokens === 0) {
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              padding: '6px',
              background: '#3cd8ff', // thin foil-colored outer ring
            }}
          >
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                background: 'radial-gradient(120% 120% at 50% 0%,#1c1c22,#08080c 65%)',
                borderRadius: '10px',
                padding: '36px 46px',
              }}
            >
              {/* Head */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 58, color: '#e7e9ee' }}>
                    {nameStr}
                  </div>
                  <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 25, color: '#8a90a0', letterSpacing: '1px', marginTop: 4 }}>
                    {handleStr}
                  </div>
                </div>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 100, color: '#9aa0ad', lineHeight: 0.72, textAlign: 'right' }}>
                  HANDCODER
                </div>
              </div>

              {/* Hero */}
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 96, color: '#e7e9ee', lineHeight: 0.85 }}>
                  NOTHING TO RANK
                </div>
                <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 30, color: '#aab0bd', marginTop: 20, maxWidth: 900 }}>
                  No AI tokens detected. Still mostly raw dogging it.
                </div>
              </div>

              {/* CTA */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: '#e7e9ee',
                  color: '#16161b',
                  fontFamily: 'Orbitron',
                  fontWeight: 900,
                  fontSize: 24,
                  borderRadius: '8px',
                  padding: '15px',
                  letterSpacing: '0.5px',
                  marginTop: 18,
                }}
              >
                PICK A TEAM AND GET ON THE BOARD · VIBECODESTATS.DEV
              </div>
            </div>
          </div>
        ),
        { ...size, fonts },
      );
    }

    // -----------------------------------------------------------------------
    // HANDCODER — active / bottom-10% variant (has tokens but isHandcoder)
    // -----------------------------------------------------------------------

    if (card.isHandcoder && card.allTimeTokens > 0) {
      return new ImageResponse(
        (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              padding: '6px',
              background: FOIL,
            }}
          >
            <div
              style={{
                display: 'flex',
                flex: 1,
                flexDirection: 'column',
                background: BG_RADIAL,
                borderRadius: '10px',
                padding: '36px 46px',
              }}
            >
              {/* Head */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 58, color: '#fff' }}>
                    {nameStr}
                  </div>
                  <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 25, color: TEXT_LABEL, letterSpacing: '1px', marginTop: 4 }}>
                    {handleStr}
                  </div>
                  {card.team && (
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 20,
                        letterSpacing: '1.5px',
                        padding: '7px 16px',
                        borderRadius: '999px',
                        border: `1.5px solid ${chipBorder}`,
                        background: chipBg,
                        color: chipText,
                        marginTop: 14,
                        alignSelf: 'flex-start',
                      }}
                    >
                      <div style={{ display: 'flex', width: 11, height: 11, borderRadius: '50%', background: dotColor }} />
                      {chipLabel}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 80, color: '#ffe93c', lineHeight: 0.72, textAlign: 'right' }}>
                  HANDCODER
                </div>
              </div>

              {/* Hero */}
              <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 140, color: '#fff', lineHeight: 0.82 }}>
                  {formatCompact(card.allTimeTokens)}
                </div>
                <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 26, color: TEXT_LABEL, letterSpacing: '3px', marginTop: 8 }}>
                  ALL-TIME TOKENS · No. {card.rank} GLOBAL
                </div>
                <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 26, color: '#aab0bd', marginTop: 10 }}>
                  bottom 10%, still mostly raw dogging it
                </div>

                {/* Stat pills */}
                <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
                  {[
                    { v: formatCompact(card.peakDay), k: 'PEAK DAY' },
                    { v: String(card.sessions), k: 'SESSIONS' },
                    { v: String(card.activeDays), k: 'ACTIVE DAYS' },
                  ].map(({ v, k }) => (
                    <div
                      key={k}
                      style={{
                        display: 'flex',
                        flex: 1,
                        flexDirection: 'column',
                        alignItems: 'center',
                        background: 'rgba(255,255,255,0.06)',
                        border: '1px solid rgba(255,255,255,0.13)',
                        borderRadius: '10px',
                        padding: '12px 10px',
                      }}
                    >
                      <div style={{ display: 'flex', fontFamily: 'Orbitron', fontWeight: 900, fontSize: 36, color: '#fff' }}>{v}</div>
                      <div style={{ display: 'flex', fontFamily: 'Rajdhani', fontWeight: 700, fontSize: 14, color: TEXT_LABEL, letterSpacing: '2px' }}>{k}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* CTA */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  background: FOIL,
                  color: TEXT_DARK,
                  fontFamily: 'Orbitron',
                  fontWeight: 900,
                  fontSize: 24,
                  borderRadius: '8px',
                  padding: '15px',
                  letterSpacing: '0.5px',
                  marginTop: 18,
                }}
              >
                WHERE DO YOU RANK? · VIBECODESTATS.DEV
              </div>
            </div>
          </div>
        ),
        { ...size, fonts },
      );
    }

    // -----------------------------------------------------------------------
    // NORMAL rank-lead card (S / A / B / C / D tiers)
    // -----------------------------------------------------------------------

    return new ImageResponse(
      (
        // Outer foil-frame border (6px foil gradient ring)
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            padding: '6px',
            background: FOIL,
          }}
        >
          {/* Inner dark body */}
          <div
            style={{
              display: 'flex',
              flex: 1,
              flexDirection: 'column',
              background: BG_RADIAL,
              borderRadius: '10px',
              padding: '36px 46px',
            }}
          >
            {/* HEAD ROW */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              {/* Left: name + handle + chip */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                {/* Display name — large Orbitron */}
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 900,
                    fontSize: 58,
                    color: '#ffe93c',
                  }}
                >
                  {nameStr}
                </div>
                {/* @handle · site */}
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 25,
                    color: TEXT_LABEL,
                    letterSpacing: '1px',
                    marginTop: 2,
                  }}
                >
                  {handleStr}
                </div>
                {/* Team chip — only if team is set */}
                {card.team && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontFamily: 'Rajdhani',
                      fontWeight: 700,
                      fontSize: 20,
                      letterSpacing: '1.5px',
                      padding: '7px 16px',
                      borderRadius: '999px',
                      border: `1.5px solid ${chipBorder}`,
                      background: chipBg,
                      color: chipText,
                      marginTop: 14,
                      alignSelf: 'flex-start',
                    }}
                  >
                    <div style={{ display: 'flex', width: 11, height: 11, borderRadius: '50%', background: dotColor }} />
                    {chipLabel}
                  </div>
                )}
              </div>

              {/* Right: TIER letter — foil gradient bar behind bright letter */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 168,
                  height: 168,
                  background: FOIL,
                  borderRadius: '16px',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 900,
                    fontSize: 148,
                    color: '#08060f',
                    lineHeight: 1,
                  }}
                >
                  {card.tier}
                </div>
              </div>
            </div>

            {/* HERO — all-time tokens + rank label */}
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', justifyContent: 'center' }}>
              {/* Giant token number */}
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Orbitron',
                  fontWeight: 900,
                  fontSize: 148,
                  color: '#fff',
                  lineHeight: 0.82,
                }}
              >
                {formatCompact(card.allTimeTokens)}
              </div>
              {/* Rank label */}
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Rajdhani',
                  fontWeight: 700,
                  fontSize: 26,
                  color: TEXT_LABEL,
                  letterSpacing: '3px',
                  marginTop: 8,
                }}
              >
                ALL-TIME TOKENS · No. {card.rank} GLOBAL · TOP {card.topPercentLabel}%
              </div>

              {/* STAT PILLS */}
              <div style={{ display: 'flex', gap: 16, marginTop: 14 }}>
                {[
                  { v: formatCompact(card.peakDay), k: 'PEAK DAY' },
                  { v: String(card.sessions), k: 'SESSIONS' },
                  { v: String(card.activeDays), k: 'ACTIVE DAYS' },
                ].map(({ v, k }) => (
                  <div
                    key={k}
                    style={{
                      display: 'flex',
                      flex: 1,
                      flexDirection: 'column',
                      alignItems: 'center',
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.13)',
                      borderRadius: '10px',
                      padding: '14px 10px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        fontFamily: 'Orbitron',
                        fontWeight: 900,
                        fontSize: 40,
                        color: '#fff',
                      }}
                    >
                      {v}
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        fontFamily: 'Rajdhani',
                        fontWeight: 700,
                        fontSize: 15,
                        color: TEXT_LABEL,
                        letterSpacing: '2px',
                      }}
                    >
                      {k}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA STRIP — foil bg, dark text */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                background: FOIL,
                color: TEXT_DARK,
                fontFamily: 'Orbitron',
                fontWeight: 900,
                fontSize: 26,
                borderRadius: '8px',
                padding: '15px',
                letterSpacing: '0.5px',
                marginTop: 18,
              }}
            >
              WHERE DO YOU RANK? · VIBECODESTATS.DEV
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
