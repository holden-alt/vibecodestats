// Host canonicalization: apex -> www.
//
// The bare apex (vibecodestats.dev) worker-route binding is wedged on
// Cloudflare's edge, so the site is served on www.vibecodestats.dev and a
// Cloudflare edge redirect forwards the apex to www. The worker therefore
// canonicalizes to www (not the apex) to avoid a redirect loop and keep one
// canonical origin for OAuth (the @supabase/ssr PKCE code_verifier cookie is
// host-only, so sign-in must start and finish on the same host) + SEO.
// Only the bare production apex is rewritten; www, localhost, *.workers.dev,
// and *.pages.dev preview hosts are untouched.

/** Returns the www URL to redirect to if `href`'s host is the bare production apex, else null. */
export function canonicalRedirectUrl(href: string): string | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.hostname !== 'vibecodestats.dev') return null;
  url.hostname = 'www.vibecodestats.dev';
  return url.toString();
}
