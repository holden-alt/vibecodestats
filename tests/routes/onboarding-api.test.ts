import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Supabase service-role mock ───────────────────────────────────────────────
const svcUpdate = vi.fn(async () => ({ error: null }));
const svcUpsert = vi.fn(async () => ({ error: null }));
const svcEq = vi.fn(() => ({ error: null, data: null }));

function makeSvcClient() {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          update: vi.fn(() => ({ eq: vi.fn(svcUpdate) })),
        };
      }
      if (table === 'user_private') {
        return {
          upsert: vi.fn(svcUpsert),
        };
      }
      return { update: vi.fn(() => ({ eq: svcEq })), upsert: vi.fn(svcUpsert) };
    }),
  };
}

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => makeSvcClient()),
}));

// ── SSR client mock helpers ──────────────────────────────────────────────────
function mockSsrClient(
  authId: string | null,
  publicUser: { id: string; github_handle: string; team?: string | null } | null,
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

// ── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(body: unknown) {
  return new Request('http://localhost:3000/api/onboarding', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/onboarding', () => {
  beforeEach(() => {
    vi.resetModules();
    svcUpdate.mockResolvedValue({ error: null });
    svcUpsert.mockResolvedValue({ error: null });
  });

  it('returns 401 when no session', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () => mockSsrClient(null, null)),
    }));
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(makeRequest({ team: 'claude_code' }) as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid team value', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-1', { id: 'user-1', github_handle: 'bob', team: null }),
      ),
    }));
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(makeRequest({ team: 'vscode' }) as any);
    expect(res.status).toBe(400);
  });

  it('returns 409 when user already has a team (already onboarded)', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-1', { id: 'user-1', github_handle: 'bob', team: 'claude_code' }),
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
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(makeRequest({ team: 'codex' }) as any);
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.error).toBe('already onboarded');
    // The service-role update must NOT have been called.
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('sets team=claude_code and redirects-compatible — returns ok + handle', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-1', { id: 'user-1', github_handle: 'bob', team: null }),
      ),
    }));
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(makeRequest({ team: 'claude_code', email_opt_in: false }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.handle).toBe('bob');
  });

  it('sets team=codex', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-2', { id: 'user-2', github_handle: 'alice', team: null }),
      ),
    }));
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(makeRequest({ team: 'codex', email_opt_in: false }) as any);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.handle).toBe('alice');
  });

  it('writes user_private when opt-in=true and email is non-empty; email_saved=true', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-3', { id: 'user-3', github_handle: 'carol', team: null }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const upsertSpy = vi.fn(async () => ({ error: null }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) };
        if (table === 'user_private') return { upsert: upsertSpy };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(
      makeRequest({ team: 'claude_code', email: 'carol@test.com', email_opt_in: true }) as any,
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.email_saved).toBe(true);
    expect(upsertSpy).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'user-3', email: 'carol@test.com', email_opt_in: true }),
      expect.objectContaining({ onConflict: 'user_id' }),
    );
  });

  it('returns email_saved=false (still 200) when opt-in=true but upsert fails', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-6', { id: 'user-6', github_handle: 'frank', team: null }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const upsertSpy = vi.fn(async () => ({ error: { message: 'db error' } }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) };
        if (table === 'user_private') return { upsert: upsertSpy };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(
      makeRequest({ team: 'claude_code', email: 'frank@test.com', email_opt_in: true }) as any,
    );
    // Team was saved — still 200.
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.email_saved).toBe(false);
  });

  it('does NOT write user_private when opt-in=false', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-4', { id: 'user-4', github_handle: 'dave', team: null }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const upsertSpy = vi.fn(async () => ({ error: null }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) };
        if (table === 'user_private') return { upsert: upsertSpy };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(
      makeRequest({ team: 'codex', email: 'dave@test.com', email_opt_in: false }) as any,
    );
    expect(res.status).toBe(200);
    expect(upsertSpy).not.toHaveBeenCalled();
  });

  it('does NOT write user_private when opt-in=true but email is empty', async () => {
    vi.doMock('@/lib/supabase/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient('auth-5', { id: 'user-5', github_handle: 'eve', team: null }),
      ),
    }));
    const svcModule = await import('@supabase/supabase-js');
    const upsertSpy = vi.fn(async () => ({ error: null }));
    (svcModule.createClient as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      from: vi.fn((table: string) => {
        if (table === 'users') return { update: vi.fn(() => ({ eq: vi.fn(async () => ({ error: null })) })) };
        if (table === 'user_private') return { upsert: upsertSpy };
        return {};
      }),
    });
    const { POST } = await import('../../app/api/onboarding/route');
    const res = await POST(
      makeRequest({ team: 'claude_code', email: '   ', email_opt_in: true }) as any,
    );
    expect(res.status).toBe(200);
    expect(upsertSpy).not.toHaveBeenCalled();
  });
});
