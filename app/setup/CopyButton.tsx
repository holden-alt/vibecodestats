'use client';

import { useState } from 'react';

export function CopyButton({ text, label = 'copy' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable (e.g. http), fallback silently
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      style={{
        marginTop: 8,
        background: 'transparent',
        border: '1px solid var(--color-border)',
        color: copied ? 'var(--chart-1, #d97757)' : 'var(--color-dim, #888)',
        padding: '4px 10px',
        borderRadius: 2,
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.7rem',
        transition: 'color 0.15s',
      }}
    >
      {copied ? 'copied!' : label}
    </button>
  );
}
