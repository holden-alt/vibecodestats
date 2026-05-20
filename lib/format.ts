export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDelta(ratio: number): string {
  const pct = Math.round(ratio * 100);
  const sign = pct >= 0 ? '+' : '-';
  return `${sign}${Math.abs(pct)}%`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
