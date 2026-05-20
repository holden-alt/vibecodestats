export type LiveRankRow = {
  user_id: string;
  github_handle: string;
  tokens_total: number;
};

export type LiveRanking = {
  rank: number | null;
  total: number;
  percentile: number; // 0..1, fraction of users at or below the viewer
  viewerTokens: number;
  closestAbove: { handle: string; tokens: number; tokensAhead: number } | null;
  closestBelow: { handle: string; tokens: number; tokensBehind: number } | null;
  top: { rank: number; handle: string; tokens: number; isViewer: boolean }[];
};

export function computeLiveDailyRanking(
  rows: LiveRankRow[],
  viewerId: string,
  topN = 10,
): LiveRanking {
  const sorted = [...rows].sort((a, b) => b.tokens_total - a.tokens_total);
  const idx = sorted.findIndex((r) => r.user_id === viewerId);
  const total = sorted.length;

  if (idx === -1) {
    return {
      rank: null, total,
      percentile: 0, viewerTokens: 0,
      closestAbove: null, closestBelow: null,
      top: sorted.slice(0, topN).map((r, i) => ({ rank: i + 1, handle: r.github_handle, tokens: r.tokens_total, isViewer: false })),
    };
  }

  const rank = idx + 1;
  const viewerTokens = sorted[idx]!.tokens_total;
  const percentile = total > 0 ? (total - rank + 1) / total : 0;

  const above = sorted[idx - 1];
  const below = sorted[idx + 1];

  return {
    rank, total, percentile, viewerTokens,
    closestAbove: above ? { handle: above.github_handle, tokens: above.tokens_total, tokensAhead: above.tokens_total - viewerTokens } : null,
    closestBelow: below ? { handle: below.github_handle, tokens: below.tokens_total, tokensBehind: viewerTokens - below.tokens_total } : null,
    top: sorted.slice(0, topN).map((r, i) => ({
      rank: i + 1, handle: r.github_handle, tokens: r.tokens_total, isViewer: r.user_id === viewerId,
    })),
  };
}
