'use client';

// Site-level "share on X" — links to vibecodestats.dev/ (not a profile).
// Includes a daily-rotating ?v= query param so X's image cache treats
// each day's share as a fresh URL and re-fetches the latest OG card.
// Use on the homepage hero. Also useful as a copy-able pinned-tweet URL.

const DEFAULT_TEXT =
  "Strava for AI coding — public leaderboard for Claude Code + Codex daily token usage. Track your VBW productivity score and see where you rank.";

export function ShareSiteOnX({ text = DEFAULT_TEXT }: { text?: string }) {
  const v = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://vibecodestats.dev/?v=${v}`;
  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <a
      href={intentUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Share vibecodestats.dev on X"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 18px',
        background: '#000000',
        color: '#ffffff',
        border: '1px solid #2a2a32',
        borderRadius: 3,
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.85rem',
        fontWeight: 600,
        textDecoration: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <svg width="13" height="13" viewBox="0 0 24 24" fill="#ffffff" aria-hidden="true">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share on X
    </a>
  );
}
