import type { ResponseCookie } from 'next/dist/compiled/@edge-runtime/cookies';
import type { D1Database } from '@/lib/db/cloudflare';

export type AppUser = {
  id: string;
  email: string | null;
  user_metadata: Record<string, unknown>;
  last_sign_in_at: string;
};

export type CookieAdapter = {
  get(name: string): { value: string } | undefined;
  set(name: string, value: string, options: Partial<ResponseCookie>): void;
};

type AuthError = { message: string };

const SESSION_COOKIE = 'cc_session';
const STATE_COOKIE = 'cc_oauth_state';
const SESSION_SECONDS = 30 * 24 * 60 * 60;

function randomHex(bytes: number): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(bytes)))
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('');
}

async function sha256(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((part) => part.toString(16).padStart(2, '0'))
    .join('');
}

function cookieOptions(maxAge: number): Partial<ResponseCookie> {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  };
}

function authError(error: unknown): { data: { user: null }; error: AuthError } {
  return {
    data: { user: null },
    error: { message: error instanceof Error ? error.message : String(error) },
  };
}

export class GithubAuth {
  constructor(
    private readonly db: D1Database,
    private readonly cookies: CookieAdapter,
    private readonly githubClientId: string,
    private readonly githubClientSecret: string,
  ) {}

  async getUser(): Promise<{ data: { user: AppUser | null }; error: AuthError | null }> {
    try {
      const token = this.cookies.get(SESSION_COOKIE)?.value;
      if (!token) return { data: { user: null }, error: null };
      const tokenHash = await sha256(token);
      const row = await this.db
        .prepare(
          `SELECT auth_id, email, user_metadata, last_sign_in_at
             FROM auth_sessions
            WHERE token_hash = ? AND expires_at > ?`,
        )
        .bind(tokenHash, new Date().toISOString())
        .first<{
          auth_id: string;
          email: string | null;
          user_metadata: string;
          last_sign_in_at: string;
        }>();
      if (!row) return { data: { user: null }, error: null };
      return {
        data: {
          user: {
            id: row.auth_id,
            email: row.email,
            user_metadata: JSON.parse(row.user_metadata) as Record<string, unknown>,
            last_sign_in_at: row.last_sign_in_at,
          },
        },
        error: null,
      };
    } catch (error) {
      return authError(error);
    }
  }

  async signInWithOAuth(args: {
    provider: 'github';
    options: { scopes: string; redirectTo: string };
  }): Promise<{ data: { url: string | null }; error: AuthError | null }> {
    try {
      if (args.provider !== 'github') throw new Error('only GitHub OAuth is supported');
      if (!this.githubClientId) throw new Error('GitHub OAuth client is not configured');
      const state = randomHex(24);
      this.cookies.set(STATE_COOKIE, state, cookieOptions(10 * 60));
      const url = new URL('https://github.com/login/oauth/authorize');
      url.searchParams.set('client_id', this.githubClientId);
      url.searchParams.set('redirect_uri', args.options.redirectTo);
      url.searchParams.set('scope', args.options.scopes);
      url.searchParams.set('state', state);
      return { data: { url: url.toString() }, error: null };
    } catch (error) {
      return {
        data: { url: null },
        error: { message: error instanceof Error ? error.message : String(error) },
      };
    }
  }

  async exchangeCodeForSession(
    code: string,
    state: string | null,
  ): Promise<{ data: { user: AppUser | null }; error: AuthError | null }> {
    try {
      const expectedState = this.cookies.get(STATE_COOKIE)?.value;
      this.cookies.set(STATE_COOKIE, '', cookieOptions(0));
      if (!expectedState || !state || expectedState !== state) {
        throw new Error('OAuth state mismatch; please start sign-in again');
      }

      const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': 'vibecodestats.dev',
        },
        body: JSON.stringify({
          client_id: this.githubClientId,
          client_secret: this.githubClientSecret,
          code,
        }),
      });
      const tokenBody = (await tokenResponse.json()) as {
        access_token?: string;
        error?: string;
        error_description?: string;
      };
      if (!tokenResponse.ok || !tokenBody.access_token) {
        throw new Error(tokenBody.error_description ?? tokenBody.error ?? 'GitHub token exchange failed');
      }

      const githubHeaders = {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${tokenBody.access_token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'vibecodestats.dev',
      };
      const profileResponse = await fetch('https://api.github.com/user', { headers: githubHeaders });
      if (!profileResponse.ok) throw new Error('GitHub profile lookup failed');
      const profile = (await profileResponse.json()) as {
        id: number;
        login: string;
        name: string | null;
        avatar_url: string | null;
        email: string | null;
      };

      let email = profile.email;
      if (!email) {
        const emailResponse = await fetch('https://api.github.com/user/emails', { headers: githubHeaders });
        if (emailResponse.ok) {
          const emails = (await emailResponse.json()) as Array<{
            email: string;
            primary: boolean;
            verified: boolean;
          }>;
          email = emails.find((item) => item.primary && item.verified)?.email ?? null;
        }
      }

      const authId = `github:${profile.id}`;
      const now = new Date();
      const nowIso = now.toISOString();
      const metadata = {
        user_name: profile.login,
        preferred_username: profile.login,
        full_name: profile.name,
        avatar_url: profile.avatar_url,
        email,
      };

      let publicUser = await this.db
        .prepare('SELECT id, created_at FROM users WHERE github_id = ? LIMIT 1')
        .bind(profile.id)
        .first<{ id: string; created_at: string }>();
      if (!publicUser) {
        publicUser = await this.db
          .prepare('SELECT id, created_at FROM users WHERE github_handle = ? COLLATE NOCASE LIMIT 1')
          .bind(profile.login)
          .first<{ id: string; created_at: string }>();
      }

      if (publicUser) {
        await this.db
          .prepare(
            `UPDATE users
                SET github_id = ?, github_handle = ?, display_name = ?, avatar_url = ?,
                    auth_id = ?, updated_at = ?
              WHERE id = ?`,
          )
          .bind(
            profile.id,
            profile.login,
            profile.name,
            profile.avatar_url,
            authId,
            nowIso,
            publicUser.id,
          )
          .run();
      } else {
        publicUser = { id: crypto.randomUUID(), created_at: nowIso };
        await this.db
          .prepare(
            `INSERT INTO users
              (id, github_id, github_handle, display_name, avatar_url, secondary_personas,
               created_at, updated_at, auth_id, ingest_token, private_project_names, timezone)
             VALUES (?, ?, ?, ?, ?, '[]', ?, ?, ?, ?, 0, 'America/New_York')`,
          )
          .bind(
            publicUser.id,
            profile.id,
            profile.login,
            profile.name,
            profile.avatar_url,
            nowIso,
            nowIso,
            authId,
            randomHex(24),
          )
          .run();
      }

      const sessionToken = randomHex(32);
      const tokenHash = await sha256(sessionToken);
      const expiresAt = new Date(now.getTime() + SESSION_SECONDS * 1000).toISOString();
      await this.db
        .prepare('DELETE FROM auth_sessions WHERE auth_id = ? OR expires_at <= ?')
        .bind(authId, nowIso)
        .run();
      await this.db
        .prepare(
          `INSERT INTO auth_sessions
            (token_hash, auth_id, email, user_metadata, created_at, last_sign_in_at, expires_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(tokenHash, authId, email, JSON.stringify(metadata), nowIso, nowIso, expiresAt)
        .run();
      this.cookies.set(SESSION_COOKIE, sessionToken, cookieOptions(SESSION_SECONDS));

      return {
        data: {
          user: {
            id: authId,
            email,
            user_metadata: metadata,
            last_sign_in_at: nowIso,
          },
        },
        error: null,
      };
    } catch (error) {
      return authError(error);
    }
  }

  async signOut(): Promise<{ error: AuthError | null }> {
    try {
      const token = this.cookies.get(SESSION_COOKIE)?.value;
      if (token) {
        await this.db.prepare('DELETE FROM auth_sessions WHERE token_hash = ?').bind(await sha256(token)).run();
      }
      this.cookies.set(SESSION_COOKIE, '', cookieOptions(0));
      return { error: null };
    } catch (error) {
      return { error: { message: error instanceof Error ? error.message : String(error) } };
    }
  }
}
