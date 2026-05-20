import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  label?: string;
  sub?: string;
  href?: string;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children: ReactNode;
};

export function BentoTile({ label, sub, href, colSpan, rowSpan, className, children }: Props) {
  const style: CSSProperties = {
    background: 'var(--color-bg-2, #14110e)',
    border: '1px solid var(--color-border, #2a2622)',
    borderRadius: 3,
    padding: '10px 12px',
    transition: 'border-color 200ms ease-out, box-shadow 200ms ease-out',
    gridColumn: colSpan ? `span ${colSpan}` : undefined,
    gridRow: rowSpan ? `span ${rowSpan}` : undefined,
    color: 'inherit',
    textDecoration: 'none',
    display: 'block',
  };

  const content = (
    <>
      {label && (
        <div
          style={{
            fontSize: '0.65rem',
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      <div>{children}</div>
      {sub && (
        <div style={{ fontSize: '0.65rem', opacity: 0.6, marginTop: 4 }}>{sub}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} style={style} className={`bento-tile ${className ?? ''}`}>
        {content}
      </Link>
    );
  }
  return (
    <div style={style} className={`bento-tile ${className ?? ''}`}>
      {content}
    </div>
  );
}
