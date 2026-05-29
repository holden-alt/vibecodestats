import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase service-role mock ───────────────────────────────────────────────
const svcUpdate = vi.fn(async () => ({ error: null }));

function makeSvcClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          update: vi.fn(() => ({ eq: vi.fn(svcUpdate) })),
        };
      }
      return { update: vi.fn(() => ({ eq: vi.fn(svcUpdate) })) };
    }),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => makeSvcClient()),
}));

// ── SSR client mock helpers ──────────────────────────────────────────────────
function mockSsrClient(
  authId: string | null,
  publicUser: {
    id: string;
    github_handle: string;
    team: string | null;
    team_switched_at: string | null;
  } | null,
) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authId ? { id: authId } : null },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({
            data: publicUser,
            error: publicUser ? null : new Error('not found'),
          })),
        })),
      })),
    })),
  };
}

// ── Request helper ───────────────────────────────────────────────────────────
function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/team', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// ── Date helpers ─────────────────────────────────────────────────────────────
const daysAgoIso = (n: number) =>
  new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();

describe('POST /api/team', () => {
  beforeEach(() => {
    vi.resetModules();
    svcUpdate.mockResolvedValue({ error: null });
  });

  it('returns 401 when unauthenticated', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () => mockSsrClient(null, null)),
    }));
    const { POST } = await import('../../app/api/team/route');
    const res = await POST(makeRequest({ team: 'claude_code' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid team value', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-1', {
          id: 'user-1',
          github_handle: 'bob',
          team: 'claude_code',
          team_switched_at: null,
        }),
      ),
    }));
    const { POST } = await import('../../app/api/team/route');
    const res = await POST(makeRequest({ team: 'vscode' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when switching to the same team', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-2', {
          id: 'user-2',
          github_handle: 'alice',
          team: 'codex',
          team_switched_at: null,
        }),
      ),
    }));
    const { POST } = await import('../../app/api/team/route');
    const res = await POST(makeRequest({ team: 'codex' }) as any);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('already on that team');
    expect(svcUpdate).not.toHaveBeenCalled();
  });

  it('allows switch when team_switched_at is null — update called, returns defector:true', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-3', {
          id: 'user-3',
          github_handle: 'carol',
          team: 'claude_code',
          team_switched_at: null,
        }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const updateSpy = vi.fn(async () => ({ error: null }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: updateSpy })) };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/team/route');
    const res = await POST(makeRequest({ team: 'codex' }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.team).toBe('codex');
    expect(json.defector).toBe(true);
    expect(updateSpy).toHaveBeenCalledOnce();
    // eq('id', publicUser.id) — updateSpy is the fn passed to eq, so first arg is the column name.
    expect(updateSpy).toHaveBeenCalledWith('id', 'user-3');
  });

  it('allows switch when team_switched_at is old (31 days) — update called, returns defector:true', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-4', {
          id: 'user-4',
          github_handle: 'dave',
          team: 'claude_code',
          team_switched_at: daysAgoIso(31),
        }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const updateSpy = vi.fn(async () => ({ error: null }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: updateSpy })) };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/team/route');
    const res = await POST(makeRequest({ team: 'codex' }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.defector).toBe(true);
    expect(updateSpy).toHaveBeenCalledOnce();
  });

  it('blocks switch when team_switched_at is recent (10 days) — 409 switch_cooldown, update NOT called', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-5', {
          id: 'user-5',
          github_handle: 'eve',
          team: 'codex',
          team_switched_at: daysAgoIso(10),
        }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const updateSpy = vi.fn(async () => ({ error: null }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: updateSpy })) };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/team/route');
    const res = await POST(makeRequest({ team: 'claude_code' }) as any);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('switch_cooldown');
    expect(typeof json.daysLeft).toBe('number');
    expect(json.daysLeft).toBeGreaterThan(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });
});
