'use client';

import { useState } from 'react';

export function OnboardingForm({ defaultEmail }: { defaultEmail: string }) {
  const [team, setTeam] = useState<'claude_code' | 'codex' | null>(null);
  const [email, setEmail] = useState(defaultEmail);
  const [optIn, setOptIn] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const btnBase: React.CSSProperties = {
    fontFamily: 'inherit',
    fontSize: '0.875rem',
    fontWeight: 700,
    border: '1px solid var(--color-border)',
    borderRadius: 3,
    padding: '14px 20px',
    cursor: 'pointer',
    transition: 'border-color 120ms, background 120ms',
    textAlign: 'left' as const,
    width: '100%',
  };

  const btnSelected: React.CSSProperties = {
    borderColor: 'var(--color-orange)',
    background: 'rgba(217,119,87,0.08)',
    color: 'var(--color-text)',
  };

  const btnUnselected: React.CSSProperties = {
    background: 'var(--color-bg-2)',
    color: 'var(--color-dim)',
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team, email: email.trim(), email_opt_in: optIn }),
      });
      if (!res.ok) {
        const msg = await res.text().catch(() => 'unknown error');
        setError(msg);
        setBusy(false);
        return;
      }
      const json = (await res.json()) as { handle?: string };
      const handle = json.handle ?? '';
      window.location.href = handle ? `/${handle}` : '/';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'something went wrong');
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Team pick */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <button
          type="button"
          onClick={() => setTeam('claude_code')}
          style={{
            ...btnBase,
            ...(team === 'claude_code' ? btnSelected : btnUnselected),
          }}
        >
          <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            camp one
          </div>
          Team Claude Code
        </button>

        <button
          type="button"
          onClick={() => setTeam('codex')}
          style={{
            ...btnBase,
            ...(team === 'codex' ? btnSelected : btnUnselected),
          }}
        >
          <div style={{ fontSize: '0.7rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            camp two
          </div>
          Team Codex
        </button>
      </div>

      {/* Email opt-in */}
      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 3,
          padding: '16px 18px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <div style={{ fontSize: '0.7rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          optional
        </div>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 2,
            padding: '8px 10px',
            color: 'var(--color-text)',
            fontFamily: 'inherit',
            fontSize: '0.85rem',
            width: '100%',
          }}
        />
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: '0.85rem',
            cursor: 'pointer',
            color: 'var(--color-dim)',
          }}
        >
          <input
            type="checkbox"
            checked={optIn}
            onChange={(e) => setOptIn(e.target.checked)}
            style={{ accentColor: 'var(--color-orange)', width: 14, height: 14 }}
          />
          Get updates from Holden
        </label>
      </div>

      {error && (
        <div
          style={{
            fontSize: '0.8rem',
            color: 'var(--color-red)',
            padding: '10px 12px',
            border: '1px solid var(--color-border)',
            borderRadius: 2,
          }}
        >
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={!team || busy}
        style={{
          fontFamily: 'inherit',
          fontSize: '0.9rem',
          fontWeight: 700,
          background: team ? 'var(--color-orange)' : 'var(--color-bg-2)',
          color: team ? 'var(--color-bg)' : 'var(--color-dim)',
          border: 'none',
          borderRadius: 3,
          padding: '12px 20px',
          cursor: team && !busy ? 'pointer' : 'default',
          transition: 'background 120ms, color 120ms',
          opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? 'locking in...' : 'lock in my team'}
      </button>
    </form>
  );
}
