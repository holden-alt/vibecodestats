// Compact value formatter for leaderboard views — tokens, sessions, streak days,
// ship counts all run through this. Shared by RankList and BarComparison.
export function formatValue(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}
