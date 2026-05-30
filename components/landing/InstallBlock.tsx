'use client';

import { useState } from 'react';

// The real installer is a tokenized one-liner from the /setup page (you get your
// TOKEN + HANDLE after signing in). This is the exact shape.
const INSTALL_CMD =
  'curl -fsSL https://vibecodestats.dev/install.sh | TOKEN=<your-token> HANDLE=<you> URL=https://vibecodestats.dev bash';

// Full copy-paste install line on the landing page, right under the 3 steps, so
// a dev can grab it without leaving the page. Monospace for legibility.
export function InstallBlock() {
  const [copied, setCopied] = useState(false);

  function copy() {
    try {
      void navigator.clipboard?.writeText(INSTALL_CMD);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div style={{ marginTop: 24 }}>
      <div
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          color: 'var(--neon-txt-dim)',
          marginBottom: 8,
          letterSpacing: '0.04em',
        }}
      >
        Sign in and your setup page hands you a personalized one-liner — paste it in your terminal,
        that&apos;s the whole install:
      </div>
      <div
        className="neon-glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          borderRadius: 12,
        }}
      >
        <code
          style={{
            fontFamily: 'var(--font-num)',
            fontSize: 'clamp(12px, 2.6vw, 14px)',
            color: 'var(--neon-txt)',
            overflowX: 'auto',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: 'var(--team-cc)' }}>$ </span>
          {INSTALL_CMD}
        </code>
        <button
          type="button"
          onClick={copy}
          style={{
            flexShrink: 0,
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: copied ? 'var(--team-cx)' : 'var(--neon-txt-dim)',
            background: 'transparent',
            border: `1px solid ${copied ? 'var(--team-cx)' : 'var(--neon-line)'}`,
            borderRadius: 8,
            padding: '7px 14px',
            cursor: 'pointer',
            transition: 'color 0.2s ease, border-color 0.2s ease',
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}
