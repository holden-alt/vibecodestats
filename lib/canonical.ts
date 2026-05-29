// Host canonicalization: www -> apex.
//
// www.vibecodestats.dev and the apex are served as co-equal hosts. The
// @supabase/ssr PKCE code_verifier cookie is host-only (no Domain attribute),
// so a sign-in started on one host cannot complete on the other — the verifier
// is missing at the callback and exchangeCodeForSession fails. Redirecting www
// to apex before auth runs closes that trap (and keeps one canonical origin for
// the OAuth allowlist + SEO). Only a leading "www." is rewritten, so localhost
// and *.pages.dev preview hosts are untouched.

/** Returns the apex URL to redirect to if `href`'s host begins with "www.", else null. */
export function canonicalRedirectUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (!url.hostname.startsWith('www.')) return null;
  url.hostname = url.hostname.slice(4);
  return url.toString();
}
