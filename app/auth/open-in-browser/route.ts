// Static HTML interstitial for in-app browser users. Implemented as a route
// handler (not a Server Component page) because the page form pulled in the
// full React Server Component runtime — adding 1.28 MB to the Cloudflare
// Pages bundle and tipping the project over the 25 MB function-size limit,
// which silently failed every deploy. A plain HTML response keeps the route
// under 10 KB and rebuilds cleanly.

import { detectInAppBrowser, detectPlatform } from '@/lib/auth/in-app-browser';


function escape(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

export function GET(request: Request): Response {
  const url = new URL(request.url);
  const next = url.searchParams.get('next') ?? '/me';
  const from = url.searchParams.get('from') ?? '';
  const ua = request.headers.get('user-agent');

  const detected = detectInAppBrowser(ua);
  const platform = detectPlatform(ua);
  const appLabel =
    detected?.label ??
    (from === 'twitter' ? 'X (Twitter)' :
     from === 'facebook' ? 'Facebook' :
     from === 'instagram' ? 'Instagram' :
     from === 'linkedin' ? 'LinkedIn' :
     from === 'tiktok' ? 'TikTok' :
     'this app');

  const siteUrl = 'https://vibecodestats.dev/';
  const browserName = platform === 'ios' ? 'Safari' : platform === 'android' ? 'Chrome' : 'your default browser';
  const platformHint =
    platform === 'ios'
      ? 'Tap the share icon ⎙ at the bottom (or ⋯ in the corner) and choose "Open in Safari".'
      : platform === 'android'
      ? 'Tap the three-dot menu ⋮ in the corner and choose "Open in Chrome" (or "Open in browser").'
      : 'Open this URL in your default browser to continue.';

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Open in your real browser — vibecodestats.dev</title>
<style>
  :root {
    --bg: #0a0a0c;
    --bg2: #15151a;
    --border: #2a2a32;
    --text: #e8e8ed;
    --dim: #8a8a92;
    --accent: #d97757;
  }
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; background: var(--bg); color: var(--text); font-family: ui-monospace, SFMono-Regular, Menlo, monospace; line-height: 1.55; }
  main { max-width: 560px; margin: 0 auto; padding: 48px 20px 80px; }
  .eyebrow { font-size: 11px; opacity: 0.6; text-transform: uppercase; letter-spacing: 0.15em; color: var(--accent); }
  h1 { font-size: 1.5rem; font-weight: 700; margin: 8px 0 16px; letter-spacing: -0.01em; line-height: 1.15; }
  p { font-size: 0.95rem; margin: 0 0 16px; opacity: 0.9; }
  .card { border: 1px solid var(--border); background: var(--bg2); border-radius: 3px; padding: 16px 18px; margin-bottom: 20px; }
  .card-label { font-size: 11px; opacity: 0.55; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 6px; }
  .url-row { display: flex; align-items: center; gap: 8px; padding: 8px 10px; background: var(--bg); border: 1px solid var(--border); border-radius: 2px; font-size: 0.85rem; word-break: break-all; margin-top: 6px; }
  .url-row span { flex: 1; }
  button { background: transparent; border: 1px solid var(--border); color: var(--accent); padding: 4px 10px; border-radius: 2px; font-family: inherit; font-size: 0.7rem; cursor: pointer; white-space: nowrap; }
  button:active { opacity: 0.6; }
  details { font-size: 0.78rem; opacity: 0.7; margin-top: 16px; }
  summary { cursor: pointer; user-select: none; }
  details p { margin-top: 8px; }
  .footer { margin-top: 36px; font-size: 0.78rem; opacity: 0.6; }
  .footer a { color: var(--accent); }
</style>
</head>
<body>
<main>
  <div class="eyebrow">sign-in</div>
  <h1>Open in your real browser to sign in</h1>
  <p>GitHub doesn't allow OAuth sign-in from <strong>${escape(appLabel)}'s</strong> in-app browser — the session cookies get blocked on the way back. You'll need to open vibecodestats.dev in ${escape(browserName)} to sign in.</p>

  <div class="card">
    <div class="card-label">how</div>
    <p>${escape(platformHint)}</p>
    <div class="card-label" style="margin-top:14px">the URL</div>
    <div class="url-row">
      <span id="site-url">${escape(siteUrl)}</span>
      <button onclick="navigator.clipboard.writeText('${escape(siteUrl)}').then(()=>{this.textContent='copied';setTimeout(()=>this.textContent='copy',1500);}).catch(()=>{})">copy</button>
    </div>
  </div>

  <details>
    <summary>Why doesn't this just work?</summary>
    <p>In-app browsers (the embedded ones inside X, Facebook, Instagram, etc.) don't share cookies with your real browser, often block third-party cookies entirely, and sometimes get killed mid-OAuth. GitHub also actively rejects some in-app browsers for security reasons. The result is a sign-in flow that looks like it's working but silently fails on the way back. Opening vibecodestats.dev in your real browser bypasses all of that and takes about 5 seconds.</p>
  </details>

  <div class="footer">
    Headed there in ${escape(browserName)}? <a href="/auth/signin?next=${encodeURIComponent(next)}">continue sign-in →</a>
  </div>
</main>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store, max-age=0',
      'X-Robots-Tag': 'noindex, nofollow',
    },
  });
}
