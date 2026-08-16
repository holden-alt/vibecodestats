import { describe, it, expect, vi } from 'vitest';

function mockDatabase(handle: string | null, team: 'claude_code' | 'codex' | null = 'claude_code') {
  return {
    auth: { getUser: vi.fn(async () => ({ data: { user: handle ? { id: 'u1' } : null }, error: null })) },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: handle ? { github_handle: handle, team } : null,
            error: handle ? null : new Error('not found'),
          })),
        })),
      })),
    })),
  };
}

describe('GET /me', () => {
  it('redirects signed-in user with a team to their /:handle', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db/server', () => ({ createClient: vi.fn(async () => mockDatabase('holden', 'claude_code')) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/\/holden$/);
    vi.doUnmock('@/lib/db/server');
  });

  it('redirects a team-null user to /onboarding', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db/server', () => ({ createClient: vi.fn(async () => mockDatabase('newuser', null)) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/\/onboarding$/);
    vi.doUnmock('@/lib/db/server');
  });

  it('redirects unsigned visitors to /', async () => {
    vi.resetModules();
    vi.doMock('@/lib/db/server', () => ({ createClient: vi.fn(async () => mockDatabase(null)) }));
    const mod = await import('../../app/me/route');
    const res = await mod.GET(new Request('http://localhost:3000/me'));
    expect(res.status).toBe(302);
    expect(res.headers.get('location')).toMatch(/\/$/);
    vi.doUnmock('@/lib/db/server');
  });
});
