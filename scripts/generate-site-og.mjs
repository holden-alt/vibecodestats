#!/usr/bin/env node
/**
 * Render the site-level OG card (vibecodestats.dev / /leaderboard / etc.)
 * and upload as the static _root.png in Cloudflare R2 through the app's
 * authenticated internal endpoint.
 *
 * Usage: node scripts/generate-site-og.mjs
 *
 * Env required:
 *   CC_DASHBOARD_URL (defaults to https://www.vibecodestats.dev)
 *   CC_INTERNAL_TOKEN
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

const SITE_URL = (process.env.CC_DASHBOARD_URL ?? 'https://www.vibecodestats.dev').replace(/\/$/, '');
const INTERNAL_TOKEN = process.env.CC_INTERNAL_TOKEN;

if (!INTERNAL_TOKEN) {
  console.error('FATAL: set CC_INTERNAL_TOKEN');
  process.exit(1);
}

const today = new Date().toISOString().slice(0, 10);

const statsResponse = await fetch(`${SITE_URL}/api/internal/site-og?date=${today}`, {
  headers: { Authorization: `Bearer ${INTERNAL_TOKEN}` },
});
if (!statsResponse.ok) {
  console.error(`stats fetch failed: HTTP ${statsResponse.status}`);
  process.exit(1);
}
const { totalUsers, activeToday, tokensToday, peakTokens, peakHandle } = await statsResponse.json();

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

const uploadResponse = await fetch(`${SITE_URL}/api/internal/site-og`, {
  method: 'PUT',
  headers: {
    Authorization: `Bearer ${INTERNAL_TOKEN}`,
    'Content-Type': 'image/png',
  },
  body: png,
});
if (!uploadResponse.ok) {
  console.error(`upload failed: HTTP ${uploadResponse.status}`);
  process.exit(1);
}

console.log(`uploaded to ${SITE_URL}/api/og/static/_root.png`);
