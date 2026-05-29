#!/usr/bin/env node
/**
 * Render the site-level OG card (vibecodestats.dev / /leaderboard / etc.)
 * and upload as the static _root.png in Supabase Storage.
 *
 * Usage: node scripts/generate-site-og.mjs
 *
 * Env required:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Run periodically (cron, GitHub Action, manual) — every share of the
 * site/* surface pulls whatever PNG is currently at og/_root.png.
 *
 * Built with Playwright (already a dev dep for e2e tests) rather than
 * Satori/@vercel/og — same result, but those libs together push the CF
 * Pages bundle past its 25 MiB limit when imported into an edge route.
 * This script runs OUT-OF-BAND so the bundle stays slim.
 */
import { chromium } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('FATAL: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
const today = new Date().toISOString().slice(0, 10);

// Pull the three aggregate stats we want on the card.
const [usersRes, todayRes, peakRes] = await Promise.all([
  supabase.from('users').select('id', { count: 'exact', head: true }),
  supabase.from('daily_stats').select('user_id, tokens_total').eq('date', today),
  supabase
    .from('daily_stats')
    .select('user_id, tokens_total, users:user_id (github_handle)')
    .eq('date', today)
    .order('tokens_total', { ascending: false })
    .limit(1)
    .maybeSingle(),
]);

const totalUsers = usersRes.count ?? 0;
const todayRows = todayRes.data ?? [];
const tokensToday = todayRows.reduce((s, r) => s + Number(r.tokens_total ?? 0), 0);
const activeToday = todayRows.filter((r) => Number(r.tokens_total ?? 0) > 0).length;
const peak = peakRes.data;
const peakTokens = peak?.tokens_total ?? 0;
const peakHandle = peak?.users?.github_handle ?? null;

function compact(n) {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(1).replace(/\.0$/, '') + 'B';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

const html = `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1200px; height: 630px; }
  body {
    background: #0d0d0d; color: #ece6dc;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    padding: 64px 72px; display: flex; flex-direction: column;
  }
  .brand { font-size: 32px; color: #d97757; letter-spacing: 5px; }
  .tag { font-size: 72px; font-weight: 700; margin-top: 16px; line-height: 1.1; max-width: 85%; }
  .sub { font-size: 26px; opacity: 0.65; margin-top: 14px; max-width: 85%; line-height: 1.4; }
  .stats { display: flex; gap: 28px; border-top: 1px solid rgba(217,119,87,0.25);
           padding-top: 28px; margin-top: auto; }
  .stat { flex: 1; display: flex; flex-direction: column; }
  .stat-label { font-size: 16px; opacity: 0.6; letter-spacing: 2px; }
  .stat-value { font-size: 52px; font-weight: 700; margin-top: 6px;
                font-variant-numeric: tabular-nums; line-height: 1.1; }
  .stat-sub { font-size: 18px; opacity: 0.55; margin-top: 2px; }
  .c1 { color: #d97757; } .c2 { color: #6bbfd9; }
  .c3 { color: #8fbc8f; } .c5 { color: #e3c466; }
</style></head><body>
  <div class="brand">VIBECODESTATS.DEV</div>
  <div class="tag">the tokenmaxxing leaderboard</div>
  <div class="sub">Claude Code + Codex token usage, ranked. Find out where you rank.</div>
  <div class="stats">
    <div class="stat"><div class="stat-label">DEVELOPERS</div>
      <div class="stat-value c1">${totalUsers}</div></div>
    <div class="stat"><div class="stat-label">ACTIVE TODAY</div>
      <div class="stat-value c2">${activeToday}</div></div>
    <div class="stat"><div class="stat-label">TOKENS TODAY</div>
      <div class="stat-value c3">${tokensToday > 0 ? compact(tokensToday) : '-'}</div></div>
    <div class="stat"><div class="stat-label">TOP TOKENS TODAY</div>
      <div class="stat-value c5">${peakTokens > 0 ? compact(peakTokens) : '-'}</div>
      ${peakHandle ? `<div class="stat-sub">@${peakHandle}</div>` : ''}
    </div>
  </div>
</body></html>`;

console.log(`stats: users=${totalUsers} active=${activeToday} tokens=${tokensToday} peakTokens=${peakTokens} (@${peakHandle ?? 'none'})`);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(html, { waitUntil: 'load' });
const png = await page.screenshot({ type: 'png', omitBackground: false });
await browser.close();

console.log(`rendered PNG: ${png.length} bytes`);

const { error } = await supabase.storage
  .from('og')
  .upload('_root.png', png, { contentType: 'image/png', upsert: true, cacheControl: '300' });

if (error) {
  console.error('upload failed:', error.message);
  process.exit(1);
}

console.log(`uploaded to ${SUPABASE_URL}/storage/v1/object/public/og/_root.png`);
