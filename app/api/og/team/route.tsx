import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { campScoreboard } from '@/lib/stats/team';
import type { Database } from '@/lib/types/database';
import { orbitron900, rajdhani700 } from '@/lib/og/fonts';


// ---------------------------------------------------------------------------
// Data window: all-time aggregate across every daily_stats row (up to
// STATS_LIMIT rows). This gives the most stable scoreboard split — it
// reflects the full project-lifetime token war, not a volatile daily delta.
// Caveat: bounded by STATS_LIMIT (same cap as other routes). Replace with a
// server-side SUM aggregate (RPC/view) before the cap is reached.
// ---------------------------------------------------------------------------
const STATS_LIMIT = 4000;

// ---------------------------------------------------------------------------
// Design tokens (mirror app/[handle]/opengraph-image.tsx)
// ---------------------------------------------------------------------------
const FOIL = 'linear-gradient(110deg,#ff2db3 0%,#ff8a3c 18%,#ffe93c 34%,#3cff8a 52%,#3cd8ff 70%,#9b5cff 86%,#ff2db3 100%)';
const BG_RADIAL = 'radial-gradient(120% 120% at 50% 0%,#150d2e,#08060f 65%)';
const TEXT_DARK = '#08060f';
const CC_COLOR = '#ff8a3c';  // Claude Code warm
const CX_COLOR = '#3cd8ff';  // Codex cyan

const size = { width: 1200, height: 630 };

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------
export async function GET(): Promise<Response> {
  try {
    // 1. Fetch all tokens_by_model entries across daily_stats
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );

    const { data: rows } = await supabase
      .from('daily_stats')
      .select('tokens_by_model')
      .limit(STATS_LIMIT);

    // 2. Feed the tokens_by_model maps into campScoreboard
    const maps = (rows ?? []).map(
      (r) => (r.tokens_by_model as Record<string, number> | null),
    );
    const { claude, codex, claudePct, codexPct, leader } = campScoreboard(maps);

    // 3. Fonts (inlined; see lib/og/fonts.ts for why)
    const fonts = [
      { name: 'Orbitron', data: orbitron900, weight: 900 as const, style: 'normal' as const },
      { name: 'Rajdhani', data: rajdhani700, weight: 700 as const, style: 'normal' as const },
    ];

    // 4. Format totals for display (compact: 1.2B, 430M, etc.)
    function compact(n: number): string {
      if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
      if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
      if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
      return String(n);
    }

    const claudeLabel = `TEAM CLAUDE CODE`;
    const codexLabel = `TEAM CODEX`;
    const leaderPct = leader === 'claude_code' ? claudePct : codexPct;

    // Bar segment widths — clamp so neither side fully vanishes (min 8%)
    const claudeBarPct = Math.max(8, Math.min(92, claudePct));
    const codexBarPct = 100 - claudeBarPct;

    return new ImageResponse(
      (
        // Outer foil-frame border
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
              padding: '40px 50px 32px',
            }}
          >
            {/* HEADER */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Orbitron',
                  fontWeight: 900,
                  fontSize: 72,
                  color: '#fff',
                  letterSpacing: '-1px',
                  lineHeight: 1,
                }}
              >
                THE AI CODING WAR
              </div>
              <div
                style={{
                  display: 'flex',
                  fontFamily: 'Rajdhani',
                  fontWeight: 700,
                  fontSize: 24,
                  color: '#cdbaff',
                  letterSpacing: '3px',
                  marginTop: 8,
                }}
              >
                ALL-TIME TOKEN SPLIT · {leader === 'claude_code' ? 'CLAUDE CODE LEADING' : 'CODEX LEADING'} {leaderPct}%
              </div>
            </div>

            {/* TEAM LABELS ROW */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 32,
              }}
            >
              {/* Claude Code label */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 900,
                    fontSize: 22,
                    color: CC_COLOR,
                    letterSpacing: '1px',
                  }}
                >
                  {claudeLabel}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 18,
                    color: 'rgba(255,138,60,0.7)',
                    letterSpacing: '1px',
                    marginTop: 2,
                  }}
                >
                  {compact(claude)} tokens
                </div>
              </div>

              {/* Codex label */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-end',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 900,
                    fontSize: 22,
                    color: CX_COLOR,
                    letterSpacing: '1px',
                  }}
                >
                  {codexLabel}
                </div>
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Rajdhani',
                    fontWeight: 700,
                    fontSize: 18,
                    color: 'rgba(60,216,255,0.7)',
                    letterSpacing: '1px',
                    marginTop: 2,
                  }}
                >
                  {compact(codex)} tokens
                </div>
              </div>
            </div>

            {/* SPLIT BAR */}
            <div
              style={{
                display: 'flex',
                width: '100%',
                height: 80,
                borderRadius: '12px',
                overflow: 'hidden',
                marginTop: 12,
                border: '1px solid rgba(255,255,255,0.12)',
              }}
            >
              {/* Claude Code segment */}
              <div
                style={{
                  display: 'flex',
                  width: `${claudeBarPct}%`,
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(90deg,#c45200 0%,#ff8a3c 60%,#ffb97a 100%)',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 900,
                    fontSize: claudeBarPct > 20 ? 36 : 22,
                    color: '#fff',
                  }}
                >
                  {claudePct}%
                </div>
              </div>
              {/* Codex segment */}
              <div
                style={{
                  display: 'flex',
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: 'linear-gradient(90deg,#009ec7 0%,#3cd8ff 60%,#9aeeff 100%)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    fontFamily: 'Orbitron',
                    fontWeight: 900,
                    fontSize: codexBarPct > 20 ? 36 : 22,
                    color: '#fff',
                  }}
                >
                  {codexPct}%
                </div>
              </div>
            </div>

            {/* SCORE PILLS */}
            <div style={{ display: 'flex', gap: 24, marginTop: 20 }}>
              {[
                { label: claudeLabel, pct: claudePct, tokens: compact(claude), color: CC_COLOR, bg: 'rgba(255,138,60,0.13)', border: 'rgba(255,138,60,0.4)' },
                { label: codexLabel, pct: codexPct, tokens: compact(codex), color: CX_COLOR, bg: 'rgba(60,216,255,0.13)', border: 'rgba(60,216,255,0.4)' },
              ].map(({ label, pct, tokens, color, bg, border }) => (
                <div
                  key={label}
                  style={{
                    display: 'flex',
                    flex: 1,
                    flexDirection: 'column',
                    alignItems: 'center',
                    background: bg,
                    border: `1.5px solid ${border}`,
                    borderRadius: '12px',
                    padding: '14px 10px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      fontFamily: 'Orbitron',
                      fontWeight: 900,
                      fontSize: 48,
                      color,
                      lineHeight: 1,
                    }}
                  >
                    {pct}%
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      fontFamily: 'Rajdhani',
                      fontWeight: 700,
                      fontSize: 15,
                      color: 'rgba(255,255,255,0.55)',
                      letterSpacing: '2px',
                      marginTop: 4,
                    }}
                  >
                    {tokens} TOKENS
                  </div>
                </div>
              ))}
            </div>

            {/* CTA STRIP */}
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
                padding: '14px',
                letterSpacing: '0.5px',
                marginTop: 20,
              }}
            >
              PICK A SIDE · VIBECODESTATS.DEV
            </div>
          </div>
        </div>
      ),
      { ...size, fonts },
    );
  } catch {
    // Fallback error card
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
            fontSize: 36,
          }}
        >
          vibecodestats.dev · team scoreboard
        </div>
      ),
      size,
    );
  }
}
