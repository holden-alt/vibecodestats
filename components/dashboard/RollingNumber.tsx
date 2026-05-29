'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber, formatCompact } from '@/lib/format';

type Props = {
  value: number;
  compact?: boolean;
  /** ms - total animation duration. Default 600ms. */
  durationMs?: number;
  className?: string;
  /** Roll up from 0 on first mount (the SPEC load-roll). Default false. */
  animateOnMount?: boolean;
};

export function RollingNumber({ value, compact, durationMs = 600, className, animateOnMount }: Props) {
  const [display, setDisplay] = useState(animateOnMount ? 0 : value);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(animateOnMount ? 0 : value);

  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (reduced || value === fromRef.current) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const text = compact ? formatCompact(display) : formatNumber(display);
  return (
    <span className={className} data-value={value} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}
