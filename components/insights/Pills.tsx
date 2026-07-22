'use client';

import type { CSSProperties } from 'react';

// Small terminal-style pill toggle. Orange when active, hairline border when not.
export function Pills<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: readonly { id: T; label: string; color?: string }[];
  value: T;
  onChange: (id: T) => void;
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}
    >
      {options.map((o) => {
        const active = o.id === value;
        const accent = o.color ?? 'var(--color-orange)';
        return (
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={active}
            data-active={active}
            onClick={() => onChange(o.id)}
            style={pill(active, accent)}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function pill(active: boolean, accent: string): CSSProperties {
  return {
    background: active ? 'color-mix(in srgb, ' + accent + ' 14%, transparent)' : 'transparent',
    border: `1px solid ${active ? accent : 'var(--color-border)'}`,
    color: active ? accent : 'var(--color-dim)',
    padding: '3px 9px',
    borderRadius: 3,
    cursor: 'pointer',
    fontFamily: 'var(--font-mono)',
    fontSize: '0.58rem',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    lineHeight: 1.4,
    whiteSpace: 'nowrap',
  };
}
