// Single source of truth for the OG share-card cache version.
//
// THE PROBLEM THIS SOLVES: X (and other crawlers) cache a link card by the URL
// they scrape, for ~1 week, with no force-refresh tool. So:
//   - A per-CLICK cache-bust (?v=Date.now()) mints a unique URL every share. X
//     freezes whatever it first scraped for each one ~1 week — if that first
//     scrape hit a stale/broken state, that URL stays broken forever. (This was
//     the bug.)
//   - A bare URL never changes, so X never re-scrapes when the card content
//     changes — it serves a stale card until its TTL.
//
// THE FIX: a CONTENT token that changes if and only if a profile's card content
// changes. Stamp it on the share/copy URL (so X re-scrapes exactly when the card
// changed, and reuses its correct cached card otherwise) AND on the og:image URL
// (so the CDN can never serve stale bytes for a new content version). The image
// itself stays the static Storage PNG that X reliably fetches.
//
// Bump OG_CARD_VERSION on any card DESIGN change, then run
// scripts/regenerate-all-og.mjs so every stored PNG + every URL is new to X.
export const OG_CARD_VERSION = 'v4';

function b36(n: number): string {
  return Math.max(0, Math.floor(Number(n) || 0)).toString(36);
}

// A compact, URL-safe token built from the card's visible headline fields. It
// changes when the design version, all-time tokens, today's tokens, tier, or
// rank change — i.e. exactly when the rendered card would look different.
// (Secondary fields like peak/sessions only move alongside these in practice.)
export function ogCardToken(input: {
  allTimeTokens: number;
  todayTokens: number;
  tier: string;
  rank: number;
}): string {
  return [
    OG_CARD_VERSION,
    b36(input.allTimeTokens),
    b36(input.todayTokens),
    input.tier,
    `r${b36(input.rank)}`,
  ].join('.');
}
