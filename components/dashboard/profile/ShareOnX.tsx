'use client';

import { formatCompact } from '@/lib/format';

type Props = {
  handle: string;
  tokensToday: number;
  vbwToday: number;
  rank: number | null;
  viewerIsOwner: boolean;
};

export function ShareOnX({ handle, tokensToday, vbwToday, rank, viewerIsOwner }: Props) {
  // Daily cache-bust so Twitter/X treats every day's share as a fresh URL
  // and re-fetches the OG image. Without this they cache the bare URL
  // forever and your card never updates after the first share.
  const v = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const url = `https://vibecodestats.dev/${handle}?v=${v}`;
  const tokens = formatCompact(tokensToday);
  const vbwPart = vbwToday > 0 ? ` · ⚡ ${vbwToday.toLocaleString()} VBW` : '';
  const rankPart = rank != null ? ` (#${rank} today)` : '';

  // Build the share text. Lead with today's tokens, append VBW badge if
  // present, append rank if present. Fall back to a rank-only flex when
  // today's tokens are zero so we don't broadcast '0 tokens today'.
  let text: string;
  if (viewerIsOwner) {
    text = tokensToday > 0
      ? `${tokens} AI tokens today${vbwPart}${rankPart} on vibecodestats.dev`
      : rank != null
        ? `Ranked #${rank} on vibecodestats.dev's leaderboard today`
        : `Tracking my AI coding stats on vibecodestats.dev`;
  } else {
    text = tokensToday > 0
      ? `@${handle} pushed ${tokens} AI tokens today${vbwPart}${rankPart} on vibecodestats.dev`
      : `@${handle} on vibecodestats.dev's leaderboard`;
  }

  const intentUrl = `https://x.com/intent/post?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;

  return (
    <a
      href={intentUrl}
      target="_blank"
      rel="noopener noreferrer"
      title="Share this profile on X"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 14px',
        background: '#000000',
        color: '#ffffff',
        border: '1px solid #2a2a32',
        borderRadius: 3,
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.75rem',
        fontWeight: 600,
        textDecoration: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 24 24"
        fill="#ffffff"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share on X
    </a>
  );
}
