import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

/**
 * Public Storage URL for a user's pre-rendered OG share-card.
 * Always stable. Files are stored as og/{handle}.png in a public bucket.
 *
 * Storage CDN serves these as plain static PNGs — no edge runtime, no Satori,
 * no Supabase queries in the X-bot fetch path. This is what the page's
 * og:image / twitter:image meta tags should point to.
 */
export function ogImageUrl(handle: string): string {
  const base =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://srexmxntzjdhbuicqvso.supabase.co';
  return `${base}/storage/v1/object/public/og/${handle}.png`;
}

/**
 * Re-render a user's OG share-card PNG and upload to Supabase Storage,
 * overwriting whatever was there before.
 *
 * Implementation: fetch the existing edge-rendered route to get the PNG bytes,
 * then upload them as a static asset. The route stays as the canonical
 * generator; Storage is just a static-asset cache that X bots love.
 *
 * Designed to fail soft: returns { ok: false } on any error so the caller
 * (typically /api/ingest) can fire-and-forget without breaking the main flow.
 */
export async function regenerateOgImage(
  handle: string,
  supabase: SupabaseClient<Database>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  // Retry transient failures (edge cold-start, network blips, storage hiccups)
  // so a push reliably lands a fresh PNG. The stored PNG is the single source
  // the og:image points at, so a silent miss here is what would let a stale
  // card survive — worth a couple of retries.
  const ATTEMPTS = 3;
  let lastError = 'unknown';
  for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
    const result = await regenerateOgImageOnce(handle, supabase);
    if (result.ok) return result;
    lastError = result.error;
    if (attempt < ATTEMPTS) {
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  return { ok: false, error: `regen failed after ${ATTEMPTS} attempts: ${lastError}` };
}

async function regenerateOgImageOnce(
  handle: string,
  supabase: SupabaseClient<Database>,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';

  let bytes: Uint8Array;
  try {
    const res = await fetch(
      `${siteUrl}/${encodeURIComponent(handle)}/opengraph-image?regen=${Date.now()}`,
      { headers: { 'user-agent': 'vibecodestats-og-regen/1' } },
    );
    if (!res.ok) {
      return { ok: false, error: `edge route returned ${res.status}` };
    }
    bytes = new Uint8Array(await res.arrayBuffer());
  } catch (e) {
    return { ok: false, error: `fetch failed: ${(e as Error).message}` };
  }

  if (bytes.byteLength < 1024) {
    return { ok: false, error: `image too small: ${bytes.byteLength} bytes` };
  }

  const { error } = await supabase.storage
    .from('og')
    .upload(`${handle}.png`, bytes, {
      contentType: 'image/png',
      upsert: true,
      cacheControl: '3600',
    });

  if (error) {
    return { ok: false, error: `storage upload failed: ${error.message}` };
  }

  return { ok: true };
}
