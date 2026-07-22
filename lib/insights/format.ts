// Compact, tabular-friendly formatting for the insights station. All outputs are
// designed for tnum monospace columns (fixed-ish width, no surprises).

/** 462.7M, 1.2B, 12.3K, 940. Never scientific notation. */
export function fmtTokens(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(Math.round(n));
}

/** $54.01, $2,716, $0.42. null → em dash. */
export function fmtCost(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n >= 1000) return `$${Math.round(n).toLocaleString('en-US')}`;
  return `$${n.toFixed(2)}`;
}

/** Whole-number counts with grouping: 16,842. */
export function fmtInt(n: number): string {
  return Math.round(n).toLocaleString('en-US');
}

/** Ratio to 1–2 significant places for rate columns: 3.2, 0.41, 12. */
export function fmtRate(n: number): string {
  if (!isFinite(n)) return '—';
  if (n === 0) return '0';
  const abs = Math.abs(n);
  if (abs >= 100) return String(Math.round(n));
  if (abs >= 10) return n.toFixed(1);
  return n.toFixed(2);
}

/** minutes → "6h 12m" / "48m". */
export function fmtDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem ? `${h}h ${rem}m` : `${h}h`;
}

/** Signed percent for w/w deltas: +340%, -12%. */
export function fmtPctDelta(ratio: number): string {
  const pct = Math.round(ratio * 100);
  return `${pct >= 0 ? '+' : ''}${pct}%`;
}

/** "×2.1" multiplier for callouts. */
export function fmtMultiplier(x: number): string {
  return `${x.toFixed(1)}×`;
}
