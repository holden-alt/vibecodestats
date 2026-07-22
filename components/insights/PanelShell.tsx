import type { CSSProperties, ReactNode } from 'react';

// Plain presentational shell — no hooks, no 'use client'. Usable from both server
// and client components. A bordered terminal panel with an uppercase mono
// eyebrow header and an optional right-aligned controls slot.
export function PanelShell({
  title,
  hint,
  right,
  children,
  id,
  bodyStyle,
}: {
  title: string;
  hint?: string;
  right?: ReactNode;
  children: ReactNode;
  id?: string;
  bodyStyle?: CSSProperties;
}) {
  return (
    <section id={id} className="term-panel" style={{ padding: '14px 16px 16px' }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 12,
          marginBottom: 14,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <h2 className="term-eyebrow" style={{ margin: 0, fontWeight: 500 }}>
            {title}
          </h2>
          {hint && (
            <span style={{ fontSize: '0.58rem', color: 'var(--color-dim)', opacity: 0.7 }}>{hint}</span>
          )}
        </div>
        {right}
      </header>
      <div style={bodyStyle}>{children}</div>
    </section>
  );
}
