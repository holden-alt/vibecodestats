'use client';

import { formatCompact } from '@/lib/format';

type Props = {
  handle: string;
  allTimeTokens: number;
  rank: number | null;
  viewerIsOwner: boolean;
};

export function ShareOnX({ handle, allTimeTokens, rank, viewerIsOwner }: Props) {
  const url = `https://vibecodestats.dev/${handle}`;
  const tokens = formatCompact(allTimeTokens);
  const rankPart = rank != null ? `, ranked #${rank}` : '';
  const text = viewerIsOwner
    ? `My Claude Code stats: ${tokens} all-time tokens${rankPart}. Live on vibecodestats.dev`
    : `@${handle} on vibecodestats.dev — ${tokens} all-time Claude Code tokens${rankPart}`;

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
        gap: 6,
        padding: '6px 12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-fg)',
        color: 'var(--color-bg)',
        borderRadius: 2,
        fontFamily: 'ui-monospace, monospace',
        fontSize: '0.7rem',
        fontWeight: 600,
        textDecoration: 'none',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      <svg
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
      Share on X
    </a>
  );
}
