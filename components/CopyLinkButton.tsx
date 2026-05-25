'use client';

import { useState } from 'react';

export function CopyLinkButton({ value, label = 'copy' }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          // ignore — fallback is the visible URL text the user can manually select
        }
      }}
      style={{
        background: 'transparent',
        border: '1px solid var(--color-border)',
        color: 'var(--chart-1)',
        padding: '3px 8px',
        borderRadius: 2,
        fontFamily: 'inherit',
        fontSize: '0.7rem',
        cursor: 'pointer',
        whiteSpace: 'nowrap',
      }}
    >
      {copied ? 'copied' : label}
    </button>
  );
}
