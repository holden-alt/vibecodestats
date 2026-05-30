#!/usr/bin/env node
/**
 * Backfill: regenerate EVERY user's stored OG share-card PNG so dormant users
 * pick up the v2 card design. The per-user PNG in Supabase Storage is otherwise
 * only refreshed on an /api/ingest push, so users who haven't pushed since the
 * redesign would keep serving the old-design card. Run this once AFTER deploying
 * the new opengraph-image route (it fetches the LIVE route per handle, exactly
 * like lib/og/regenerate.ts does on ingest).
 *
 * Usage:
 *   node scripts/regenerate-all-og.mjs
 *   SITE_URL=https://www.vibecodestats.dev CONCURRENCY=4 node scripts/regenerate-all-og.mjs
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 * Optional:
 *   SITE_URL      (default https://www.vibecodestats.dev)
 *   CONCURRENCY   (default 4)
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SITE_URL = (process.env.SITE_URL || 'https://www.vibecodestats.dev').replace(/\/$/, '');
const CONCURRENCY = Number(process.env.CONCURRENCY || 4);

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FATAL: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const { data: users, error: usersErr } = await supabase
  .from('users')
  .select('github_handle')
  .order('github_handle', { ascending: true });

if (usersErr) {
  console.error('failed to list users:', usersErr.message);
  process.exit(1);
}

const handles = (users ?? []).map((u) => u.github_handle).filter(Boolean);
console.log(`regenerating ${handles.length} OG card(s) from ${SITE_URL} (concurrency ${CONCURRENCY})...`);

let ok = 0;
let fail = 0;

async function regen(handle) {
  try {
    const res = await fetch(
      `${SITE_URL}/${encodeURIComponent(handle)}/opengraph-image?regen=${Date.now()}`,
      { headers: { 'user-agent': 'vibecodestats-og-backfill/1' } },
    );
    if (!res.ok) throw new Error(`route returned ${res.status}`);
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength < 1024) throw new Error(`image too small (${bytes.byteLength}b)`);
    const { error } = await supabase.storage
      .from('og')
      .upload(`${handle}.png`, bytes, {
        contentType: 'image/png',
        upsert: true,
        cacheControl: '3600',
      });
    if (error) throw new Error(`upload failed: ${error.message}`);
    ok++;
    console.log(`  ✓ @${handle} (${bytes.byteLength}b)`);
  } catch (e) {
    fail++;
    console.error(`  ✗ @${handle}: ${e.message}`);
  }
}

// Simple fixed-size worker pool.
const queue = [...handles];
await Promise.all(
  Array.from({ length: Math.max(1, CONCURRENCY) }, async () => {
    while (queue.length > 0) {
      const h = queue.shift();
      if (h) await regen(h);
    }
  }),
);

console.log(`done: ${ok} ok, ${fail} failed`);
process.exit(fail > 0 ? 1 : 0);
