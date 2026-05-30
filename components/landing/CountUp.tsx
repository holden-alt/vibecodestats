'use client';

import { useEffect, useRef, useState } from 'react';

// One-shot count-up for the all-time-tokens hero number (the 5.2B reveal).
// Ported from the neon-arcade mockup's pure-JS easing. GPU-friendly: only the
// text node changes, no layout-affecting style writes.
//
// MOTION POLICY: this is a load-time ONE-SHOT, not a loop. It runs once, lands
// on the final value, and stops. prefers-reduced-motion renders the final value
// immediately with no animation.

type Props = {
  /** Final numeric value to land on (e.g. 5.2). */
  to: number;
  /** Decimal places to render (matches the suffix unit, e.g. "B" -> 1). */
  decimals?: number;
  /** Delay before the count begins (lets the tier badge reveal land first). */
  delayMs?: number;
  durationMs?: number;
  className?: string;
};

export function CountUp({ to, decimals = 1, delayMs = 450, durationMs = 2200, className }: Props) {
  // Start at the resolved value so SSR / no-JS / reduced-motion all show the
  // real number. The effect only *animates up to* it when motion is allowed.
  const [text, setText] = useState(() => to.toFixed(decimals));
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setText(to.toFixed(decimals));
      return;
    }

    const ease = (t: number) => 1 - Math.pow(1 - t, 3);
    let start: number | null = null;

    const step = (ts: number) => {
      if (start === null) start = ts;
      const p = Math.min((ts - start) / durationMs, 1);
      setText((ease(p) * to).toFixed(decimals));
      if (p < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setText(to.toFixed(decimals));
      }
    };

    setText((0).toFixed(decimals));
    timerRef.current = setTimeout(() => {
      rafRef.current = requestAnimationFrame(step);
    }, delayMs);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [to, decimals, delayMs, durationMs]);

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}
