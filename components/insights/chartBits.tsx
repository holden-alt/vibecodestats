import type { CSSProperties, ReactNode } from 'react';

// Shared pieces for the overview charts: one tooltip box, one legend row, and
// the axis tick style every Recharts panel on the station already uses.

export const AXIS_TICK = { fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' } as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-13' → 'Oct 13'. */
export function fmtDay(date: string): string {
  return `${MONTHS[Number(date.slice(5, 7)) - 1]} ${Number(date.slice(8, 10))}`;
}

/** '2026-10-01' → 'Oct' (or 'Oct 2026' with the year). */
export function fmtMonth(date: string, withYear = false): string {
  const m = MONTHS[Number(date.slice(5, 7)) - 1];
  return withYear ? `${m} ${date.slice(0, 4)}` : m!;
}

export function TipBox({ title, children, minWidth = 150 }: { title: ReactNode; children: ReactNode; minWidth?: number }) {
  return (
    <div
      className="num"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 3,
        padding: '7px 9px',
        fontSize: '0.64rem',
        color: 'var(--color-text)',
        minWidth,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>{title}</div>
      {children}
    </div>
  );
}

export function TipRow({ color, label, value }: { color?: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
      {color && <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: color, flex: 'none' }} />}
      <span style={{ color: 'var(--color-dim)' }}>{label}</span>
      <span style={{ marginLeft: 'auto', paddingLeft: 10 }}>{value}</span>
    </div>
  );
}

/** Legend row: a colored key beside text-colored labels (text never wears the series color). */
export function Legend({
  items,
  style,
}: {
  items: { label: string; color: string; line?: boolean }[];
  style?: CSSProperties;
}) {
  return (
    <div
      className="num"
      style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: '0.64rem', color: 'var(--color-dim)', ...style }}
    >
      {items.map((it) => (
        <span key={it.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span
            aria-hidden
            style={
              it.line
                ? { width: 12, height: 2, borderRadius: 1, background: it.color }
                : { width: 8, height: 8, borderRadius: 2, background: it.color }
            }
          />
          {it.label}
        </span>
      ))}
    </div>
  );
}
