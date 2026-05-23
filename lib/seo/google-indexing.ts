/**
 * Google Indexing API client for Cloudflare Pages edge runtime.
 *
 * No external dependencies — uses Web Crypto for JWT signing (RS256) and
 * fetch for OAuth token exchange + indexing API publish. Service account
 * credentials are read from the GOOGLE_SERVICE_ACCOUNT_JSON env var (set
 * once in CF Pages → cc-dashboard → Production env vars).
 *
 * Caveat: Google's Indexing API is officially restricted to JobPosting
 * and BroadcastEvent schema types. Submitting other URL types is a
 * common SEO practice (RankMath, SEOPress, etc) and works in practice
 * but Google can ignore the requests with no warning. We accept that
 * gray-area tradeoff in exchange for faster indexing on new pages.
 *
 * Quotas: 200 publish requests/day, 600 metadata gets/day (free).
 */

export type ServiceAccount = {
  type: 'service_account';
  project_id: string;
  private_key_id: string;
  private_key: string;
  client_email: string;
  client_id: string;
  token_uri: string;
};

export type IndexingResult = {
  url: string;
  ok: boolean;
  status: number;
  error?: string;
};

/** Parse the SA JSON env var. Throws if missing or malformed. */
export function parseServiceAccount(): ServiceAccount {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) {
    throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON env var is not set');
  }
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    if (sa.type !== 'service_account' || !sa.private_key || !sa.client_email) {
      throw new Error('SA JSON is missing required fields');
    }
    return sa;
  } catch (e) {
    throw new Error(`SA JSON parse failed: ${(e as Error).message}`);
  }
}

/* ---------- base64url helpers (Web-Crypto edge compatible) ---------- */

function bytesToBase64Url(bytes: Uint8Array): string {
  let str = '';
  for (let i = 0; i < bytes.length; i++) {
    str += String.fromCharCode(bytes[i]!);
  }
  return btoa(str).replace(/=+$/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function stringToBase64Url(input: string): string {
  return bytesToBase64Url(new TextEncoder().encode(input));
}

/* ---------- private key import ---------- */

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const cleaned = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '');
  const binary = new Uint8Array(
    atob(cleaned)
      .split('')
      .map((c) => c.charCodeAt(0)),
  );
  return crypto.subtle.importKey(
    'pkcs8',
    binary.buffer as ArrayBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/* ---------- JWT + OAuth token exchange ---------- */

async function createSignedJWT(sa: ServiceAccount): Promise<string> {
  const headerB64 = stringToBase64Url(
    JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: sa.private_key_id }),
  );
  const now = Math.floor(Date.now() / 1000);
  const claimsB64 = stringToBase64Url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/indexing',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const unsigned = `${headerB64}.${claimsB64}`;
  const key = await importPrivateKey(sa.private_key);
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  );
  return `${unsigned}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/** Mint an access token. Valid for ~1 hour. */
export async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const jwt = await createSignedJWT(sa);
  const resp = await fetch(sa.token_uri ?? 'https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }).toString(),
  });
  if (!resp.ok) {
    throw new Error(
      `OAuth token fetch failed (${resp.status}): ${await resp.text()}`,
    );
  }
  const json = (await resp.json()) as { access_token: string };
  return json.access_token;
}

/* ---------- Indexing API publish ---------- */

/** Submit one URL to the Google Indexing API. */
export async function submitUrl(
  url: string,
  type: 'URL_UPDATED' | 'URL_DELETED',
  accessToken: string,
): Promise<IndexingResult> {
  const resp = await fetch(
    'https://indexing.googleapis.com/v3/urlNotifications:publish',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url, type }),
    },
  );
  if (!resp.ok) {
    return {
      url,
      ok: false,
      status: resp.status,
      error: await resp.text(),
    };
  }
  return { url, ok: true, status: resp.status };
}

/**
 * Submit a batch of URLs. Mints one access token, reuses it for all calls.
 * Returns per-URL results so we can render success/fail per row in the
 * admin UI.
 */
export async function submitUrls(
  urls: string[],
  type: 'URL_UPDATED' | 'URL_DELETED' = 'URL_UPDATED',
): Promise<IndexingResult[]> {
  const sa = parseServiceAccount();
  const accessToken = await getAccessToken(sa);
  // Sequential to avoid hammering quota / accidental throttling. With at
  // most ~100 URLs total this is fast enough (~3-5s for the full sitemap).
  const results: IndexingResult[] = [];
  for (const url of urls) {
    try {
      results.push(await submitUrl(url, type, accessToken));
    } catch (e) {
      results.push({
        url,
        ok: false,
        status: 0,
        error: (e as Error).message,
      });
    }
  }
  return results;
}
