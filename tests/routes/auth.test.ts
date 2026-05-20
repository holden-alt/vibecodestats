import { describe, it, expect, vi } from 'vitest';

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: () => [],
    get: () => undefined,
    set: vi.fn(),
  })),
}));

vi.mock('@supabase/ssr', () => ({
  createServerClient: vi.fn(() => ({
    auth: { signOut: vi.fn(async () => ({ error: null })) },
  })),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    auth: {
      signInWithOAuth: vi.fn(async () => ({
        data: { url: 'https://github.com/login/oauth/authorize?...' },
        error: null,
      })),
      exchangeCodeForSession: vi.fn(async () => ({ error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
  })),
}));

describe('auth routes', () => {
  it('signin → 302 to a github.com authorize URL', async () => {
    const mod = await import('../../app/auth/signin/route');
    const req = new Request('http://localhost:3000/auth/signin');
    const res = await mod.GET(req as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/github\.com\/login\/oauth/);
  });
  it('callback handles missing code with 400', async () => {
    const mod = await import('../../app/auth/callback/route');
    const req = new Request('http://localhost:3000/auth/callback');
    const res = await mod.GET(req as any);
    expect(res.status).toBe(400);
  });
  it('signout redirects to /', async () => {
    const mod = await import('../../app/auth/signout/route');
    const req = new Request('http://localhost:3000/auth/signout', { method: 'POST' });
    const res = await mod.POST(req as any);
    expect(res.status).toBe(302);
    // NextResponse.redirect(new URL('/', request.url)) yields a fully-qualified URL.
    expect(res.headers.get('location')).toMatch(/\/$/);
  });
});
