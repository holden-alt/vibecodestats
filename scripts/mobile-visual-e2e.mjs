#!/usr/bin/env node
// Mobile-viewport visual + structural verification.
// Confirms the six mobile bugs from screenshots are actually fixed live.

import { chromium, devices } from '@playwright/test';
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { createChunks } = require('@supabase/ssr/dist/main/utils/chunker.js');
const { stringToBase64URL } = require('@supabase/ssr/dist/main/utils/base64url.js');

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SVC = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SVC) { console.error('missing env'); process.exit(2); }
const BASE = 'https://vibecodestats.dev';
const OUT = '/tmp/mobile-shots';
mkdirSync(OUT, { recursive: true });

let pass = 0, fail = 0;
const check = (label, ok, detail = '') => {
  if (ok) { console.log(`  ✓ ${label}`); pass++; }
  else { console.log(`  ✗ ${label}${detail ? '  — ' + detail : ''}`); fail++; }
};

async function mintMagicLink(email) {
  const r = await fetch(`${SUPA_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: { 'apikey': SVC, 'Authorization': `Bearer ${SVC}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'magiclink', email, options: { redirect_to: BASE } }),
  });
  const j = await r.json();
  if (!j.action_link) throw new Error('no action_link: ' + JSON.stringify(j));
  return j.action_link;
}
function extractHash(url) {
  const u = new URL(url);
  const params = new URLSearchParams(u.hash.startsWith('#') ? u.hash.slice(1) : u.hash);
  return {
    access_token: params.get('access_token'),
    refresh_token: params.get('refresh_token'),
    expires_in: Number(params.get('expires_in') || 3600),
  };
}
function buildAuthCookies(name, session) {
  const raw = JSON.stringify(session);
  const encoded = 'base64-' + stringToBase64URL(raw);
  return createChunks(name, encoded);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ ...devices['iPhone 14 Pro'] });
  const page = await ctx.newPage();

  // Inject a real session so we can see the signed-in AuthWidget + profile
  const action = await mintMagicLink('holden@realsavvy.com');
  await page.goto(action, { waitUntil: 'load' });
  const tokens = extractHash(page.url());
  const projectRef = new URL(SUPA_URL).host.split('.')[0];
  const jwtPayload = JSON.parse(Buffer.from(tokens.access_token.split('.')[1], 'base64url').toString('utf8'));
  const session = {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    expires_in: tokens.expires_in,
    expires_at: jwtPayload.exp,
    token_type: 'bearer',
    user: {
      id: jwtPayload.sub, aud: jwtPayload.aud, email: jwtPayload.email,
      phone: '', app_metadata: jwtPayload.app_metadata || {},
      user_metadata: jwtPayload.user_metadata || {},
      created_at: new Date(jwtPayload.iat * 1000).toISOString(),
    },
  };
  const cookieParts = buildAuthCookies(`sb-${projectRef}-auth-token`, session);
  await ctx.addCookies(cookieParts.map((c) => ({
    name: c.name, value: c.value, domain: 'vibecodestats.dev',
    path: '/', httpOnly: false, secure: true, sameSite: 'Lax',
    expires: jwtPayload.exp,
  })));

  // Visit the profile page
  await page.goto(`${BASE}/holden-alt`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);  // let charts paint

  // Viewport width
  const vp = await page.viewportSize();
  console.log(`\n=== iPhone 14 Pro viewport: ${vp.width}×${vp.height} ===\n`);

  // ── Check 1: page doesn't horizontally scroll ──
  const docInfo = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));
  const horizScroll = docInfo.scrollWidth > docInfo.clientWidth + 1;
  check(`no horizontal page scroll (scrollWidth ${docInfo.scrollWidth} vs viewport ${docInfo.clientWidth})`, !horizScroll);

  // ── Check 2: AuthWidget fits within viewport ──
  const awBox = await page.locator('[data-auth]').first().boundingBox();
  if (awBox) {
    check(`AuthWidget right edge inside viewport (right=${Math.round(awBox.x + awBox.width)} ≤ ${vp.width})`, (awBox.x + awBox.width) <= vp.width + 1);
  } else {
    check('AuthWidget visible', false, 'no [data-auth] found');
  }

  // ── Check 3: Hero token number fully visible (no clipping) ──
  await page.evaluate(() => window.scrollTo(0, 200));
  await page.waitForTimeout(500);
  const heroBox = await page.locator('.hero-token').first().boundingBox().catch(() => null);
  if (heroBox) {
    const heroRight = heroBox.x + heroBox.width;
    check(`hero token fits in viewport (right=${Math.round(heroRight)} ≤ ${vp.width})`, heroRight <= vp.width + 1);
    // Also check the actual rendered text is the full number, not cut
    const heroText = await page.locator('.hero-token').first().innerText();
    check(`hero text has no trailing comma (full number rendered)`, !/,$/.test(heroText.trim()), `text=${heroText}`);
  } else {
    check('hero-token visible', false);
  }

  // ── Check 4: IdentityStrip badges all fit ──
  const identityStrip = page.locator('[class*=""], [data-now]').first();  // fallback selector
  // Look for the "now:" badge by text
  const nowBadge = page.locator('span').filter({ hasText: /^now:/ }).first();
  if (await nowBadge.count() > 0) {
    const box = await nowBadge.boundingBox();
    if (box) {
      check(`"now:" badge fits in viewport (right=${Math.round(box.x + box.width)} ≤ ${vp.width})`, (box.x + box.width) <= vp.width + 1);
    }
  }

  // ── Check 5: PersonalBests 3 tiles all visible and fit ──
  // Look for "best day" / "most ships" / "most sessions" labels
  for (const label of ['best day', 'most ships', 'most sessions']) {
    const el = page.locator('div').filter({ hasText: new RegExp(`^${label}$`, 'i') }).first();
    if (await el.count() > 0) {
      const box = await el.boundingBox();
      if (box) {
        check(`PersonalBests "${label}" tile fits (right=${Math.round(box.x + box.width)} ≤ ${vp.width})`,
          (box.x + box.width) <= vp.width + 1);
      } else {
        check(`PersonalBests "${label}" visible`, false, 'no bounding box');
      }
    }
  }

  // ── Check 6: Heatmap has colored cells (not just grid lines) ──
  // Scroll to the 52-week section
  await page.evaluate(() => {
    const el = Array.from(document.querySelectorAll('*')).find((e) => e.textContent?.trim() === '52-week activity');
    el?.scrollIntoView();
  });
  await page.waitForTimeout(1500);
  const cellInfo = await page.evaluate(() => {
    // Find all SVG <rect> elements inside the heatmap (those with a fill that
    // is NOT pure transparent / pure black)
    const heatmapContainer = document.querySelector('.cc-heatmap-wrap');
    if (!heatmapContainer) return { found: false };
    const rects = heatmapContainer.querySelectorAll('rect');
    let colored = 0;
    let total = 0;
    for (const r of rects) {
      total++;
      const fill = r.getAttribute('fill') || window.getComputedStyle(r).fill || '';
      // Cells should have rgba(...) or rgb(...) fills — anything but transparent / none
      if (fill && fill !== 'none' && fill !== 'transparent' && !fill.match(/rgba?\(0,\s*0,\s*0,\s*0/)) {
        colored++;
      }
    }
    return { found: true, total, colored };
  });
  if (cellInfo.found) {
    check(`heatmap container present (.cc-heatmap-wrap)`, true);
    check(`heatmap rendered cells (total=${cellInfo.total})`, cellInfo.total > 100);
    check(`heatmap has colored cells (colored=${cellInfo.colored})`, cellInfo.colored > 50);
  } else {
    check('heatmap container present', false);
  }

  // ── Screenshots ──
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/profile-mobile-top.png`, fullPage: false });
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/profile-mobile-mid.png`, fullPage: false });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight - 800));
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/profile-mobile-bottom.png`, fullPage: false });
  console.log(`\nScreenshots: ${OUT}/profile-mobile-{top,mid,bottom}.png`);

  await browser.close();
  console.log(`\n==========================================`);
  console.log(`  PASS: ${pass}   FAIL: ${fail}`);
  console.log(`==========================================`);
  process.exit(fail === 0 ? 0 : 1);
})();
