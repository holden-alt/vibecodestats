import { describe, it, expect, vi } from 'vitest';

function mockSupabase(handle: string | null) {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: handle ? { id: 'u1' } : null }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: handle ? { github_handle: handle } : null,
            error: handle ? null : new Error('not found'),
          })),
        })),
      })),
    })),
  };
}

describe('GET /me', () => {
  it('redirects signed-in user to their /:handle', async () => {
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase('holden')) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me') as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/\/holden$/);
    vi.doUnmock('@/lib/supabase/server');
  });

  it('redirects unsigned visitors to /', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase(null)) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me') as any);
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/\/$/);
    vi.doUnmock('@/lib/supabase/server');
  });
});
