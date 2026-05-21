import { ImageResponse } from 'next/og';

export const runtime = 'edge';
export const alt = 'vibecodestats.dev — Strava for Claude Code';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OG() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'center',
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
            marginBottom: 24,
          }}
        >
          vibecodestats.dev
        </div>
        <div
          style={{
            fontSize: 80,
            fontWeight: 700,
            letterSpacing: '-0.02em',
            lineHeight: 1.05,
          }}
        >
          Strava for Claude Code.
        </div>
        <div
          style={{
            fontSize: 32,
            opacity: 0.65,
            marginTop: 24,
            lineHeight: 1.4,
          }}
        >
          Public profiles. Global leaderboard. Live token counter.
        </div>
      </div>
    ),
    size,
  );
}
