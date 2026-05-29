/**
 * Tests for /admin — the main admin page.
 *
 * Covers:
 * - Unauthenticated user is redirected to /auth/signin
 * - Non-owner authenticated user sees 403
 * - Owner sees the OG images section (team URL, site-OG URL, per-handle card URL)
 * - Owner sees the signup funnel section
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// --- Mocks ---

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

// Stable env values used throughout
const SITE_URL = 'https://vibecodestats.dev';
const SUPABASE_URL = 'https://srexmxntzjdhbuicqvso.supabase.co';

// Helper: build a mock SSR client.
function mockSsrClient(
  authUser: { id: string } | null,
  profile: { github_handle: string } | null,
) {
  return {
    auth: {
      getUser: vi.fn(async () => ({ data: { user: authUser } })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({ data: profile })),
        })),
      })),
    })),
  };
}

// Helper: build a mock service-role client with users + signup_events.
function mockSvcClient(
  handles: string[],
  signupEvents: object[] = [],
) {
  return vi.fn(() => ({
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn(() => ({
            order: vi.fn(() => Promise.resolve({
              data: handles.map((h) => ({ github_handle: h })),
              error: null,
            })),
          })),
        };
      }
      // signup_events
      return {
        select: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => Promise.resolve({ data: signupEvents, error: null })),
          })),
        })),
      };
    }),
  }));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('NEXT_PUBLIC_SITE_URL', SITE_URL);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', SUPABASE_URL);
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'svc-key-test');
  vi.stubEnv('OWNER_HANDLES', 'holden-alt,realholdengr');
});

describe('GET /admin — unauthenticated', () => {
  it('redirects to /auth/signin when not logged in', async () => {
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () => mockSsrClient(null, null)),
    }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockSvcClient([]),
    }));

    const { default: AdminPage } = await import('../../app/admin/page');
    await expect(AdminPage()).rejects.toThrow(/NEXT_REDIRECT:\/auth\/signin\?next=\/admin/);
  });
});

describe('GET /admin — non-owner authenticated user', () => {
  it('renders 403 for a non-owner handle', async () => {
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient(
          { id: 'auth-99' },
          { github_handle: 'random-user' },
        ),
      ),
    }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockSvcClient([]),
    }));

    const { default: AdminPage } = await import('../../app/admin/page');
    const ui = await AdminPage();
    render(ui as React.ReactElement);
    expect(screen.getByText('403')).toBeTruthy();
    expect(screen.getByText(/@random-user/)).toBeTruthy();
    // Sensitive admin content must not be rendered to non-owners.
    expect(screen.queryByText(/OG images/i)).toBeNull();
    expect(screen.queryByText(/Signup funnel/i)).toBeNull();
  });
});

describe('GET /admin — owner', () => {
  it('renders team-scoreboard OG URL', async () => {
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient({ id: 'auth-1' }, { github_handle: 'holden-alt' }),
      ),
    }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockSvcClient(['holden-alt', 'alice']),
    }));

    const { default: AdminPage } = await import('../../app/admin/page');
    const ui = await AdminPage();
    render(ui as React.ReactElement);

    // Team scoreboard URL
    const teamUrl = `${SITE_URL}/api/og/team`;
    expect(screen.getByText(teamUrl)).toBeTruthy();
  });

  it('renders site-OG storage URL', async () => {
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient({ id: 'auth-1' }, { github_handle: 'holden-alt' }),
      ),
    }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockSvcClient(['holden-alt']),
    }));

    const { default: AdminPage } = await import('../../app/admin/page');
    const ui = await AdminPage();
    render(ui as React.ReactElement);

    // Site OG URL from ogImageUrl('_root')
    const siteOgUrl = `${SUPABASE_URL}/storage/v1/object/public/og/_root.png`;
    expect(screen.getByText(siteOgUrl)).toBeTruthy();
  });

  it('renders per-handle card URLs for all users', async () => {
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient({ id: 'auth-1' }, { github_handle: 'holden-alt' }),
      ),
    }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockSvcClient(['holden-alt', 'alice']),
    }));

    const { default: AdminPage } = await import('../../app/admin/page');
    const ui = await AdminPage();
    render(ui as React.ReactElement);

    expect(screen.getByText(`${SITE_URL}/holden-alt/opengraph-image`)).toBeTruthy();
    expect(screen.getByText(`${SITE_URL}/alice/opengraph-image`)).toBeTruthy();
  });

  it('renders the signup funnel section heading', async () => {
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient({ id: 'auth-1' }, { github_handle: 'holden-alt' }),
      ),
    }));
    vi.doMock('@supabase/supabase-js', () => ({
      createClient: mockSvcClient(['holden-alt']),
    }));

    const { default: AdminPage } = await import('../../app/admin/page');
    const ui = await AdminPage();
    render(ui as React.ReactElement);

    expect(screen.getByText('Signup funnel')).toBeTruthy();
  });
});
