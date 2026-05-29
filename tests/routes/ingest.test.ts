import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Minimal valid payload ───────────────────────────────────────────────────
const VALID_PAYLOAD = {
  github_handle: 'holden',
  machine: 'macbook-pro',
  date: '2026-05-20',
  tokens_total: 1000,
  tokens_by_model: { 'claude-sonnet': 1000 },
  sessions: 5,
  deep_work_minutes: 120,
  projects_touched: { 'cc-dashboard': 3 },
  ships: { commits: 2, repos: 1 },
  hourly_tokens: { '09': 500, '10': 500 },
};

// ─── Supabase mock factory ────────────────────────────────────────────────────
// We build a chainable mock that supports the query patterns in the route:
//   .from(t).select(c).eq(k,v).maybeSingle()
//   .from(t).upsert(...)
//   .from(t).select(c).eq(k1,v1).eq(k2,v2)
function makeSupabaseMock({
  tokenUserId,
  tokenLookupError,
  machineRows,
  upsertError,
}: {
  tokenUserId?: string | null;
  tokenLookupError?: boolean;
  machineRows?: object[];
  upsertError?: boolean;
} = {}) {
  // Track upserted data for assertions
  const upserted: { table: string; data: unknown }[] = [];

  const makeMaybeSingle = (data: unknown, error: unknown = null) =>
    vi.fn(async () => ({ data, error }));

  // Chainable .eq() mock — distinguishes ingest_token lookup from
  // multi-.eq() chains used by machine_daily_stats select.
  const fromMock = vi.fn((table: string) => {
    const selectMock = vi.fn((_cols?: string) => {
      // Returns an object with .eq() that returns another .eq() / .maybeSingle() / direct data
      let eqCount = 0;

      const eqChain: Record<string, unknown> = {};

      const eqFn: ReturnType<typeof vi.fn> = vi.fn((field: string, _value: unknown) => {
        eqCount++;

        if (eqCount === 1) {
          if (field === 'ingest_token') {
            const userData = tokenLookupError
              ? null
              : tokenUserId === undefined
                ? null
                : tokenUserId
                  ? { id: tokenUserId }
                  : null;
            const err = tokenLookupError ? new Error('db error') : null;
            eqChain['maybySingle'] = makeMaybeSingle(userData, err);
            return {
              maybeSingle: eqChain['maybySingle'],
              eq: eqFn,
            };
          }
          if (field === 'user_id') {
            // machine_daily_stats select: .eq('user_id').eq('date')
            return {
              eq: vi.fn(async () => ({
                data: machineRows ?? [
                  {
                    machine: 'macbook-pro',
                    tokens_total: 1000,
                    tokens_by_model: { 'claude-sonnet': 1000 },
                    sessions: 5,
                    deep_work_minutes: 120,
                    projects_touched: { 'cc-dashboard': 3 },
                    ships: { commits: 2, repos: 1 },
                    hourly_tokens: { '09': 500, '10': 500 },
                  },
                ],
                error: null,
              })),
            };
          }
        }
        return eqChain;
      });

      return { eq: eqFn };
    });

    const upsertMock = vi.fn(async (data: unknown) => {
      upserted.push({ table, data });
      return { error: upsertError ? new Error('upsert error') : null };
    });

    return { select: selectMock, upsert: upsertMock };
  });

  return { client: { from: fromMock }, upserted };
}

// ─── Supabase client mock ─────────────────────────────────────────────────────
// We mock @supabase/supabase-js so createClient returns our controlled mock.
// We use a module-level variable that each test overwrites before importing the route.
let _currentSupabaseMock: ReturnType<typeof makeSupabaseMock>;

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => _currentSupabaseMock.client),
}));

// Set env vars before any test runs
beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'service-role-key');
  vi.resetModules();
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

// ─── Tests ────────────────────────────────────────────────────────────────────
describe('POST /api/ingest', () => {
  describe('Bearer token path (preferred)', () => {
    it('returns 200 and uses the token-resolved user_id when token is valid', async () => {
      _currentSupabaseMock = makeSupabaseMock({ tokenUserId: 'user-abc-123' });
      const { POST } = await import('../../app/api/ingest/route');

      const req = makeRequest(VALID_PAYLOAD, {
        authorization: 'Bearer valid-token-xyz',
      });
      const res = await POST(req as any);
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.ok).toBe(true);

      // Verify the upsert calls used the token-resolved user_id
      const machineUpsert = _currentSupabaseMock.upserted.find(
        (u) => u.table === 'machine_daily_stats',
      );
      expect(machineUpsert).toBeDefined();
      expect((machineUpsert!.data as any).user_id).toBe('user-abc-123');

      const dailyUpsert = _currentSupabaseMock.upserted.find(
        (u) => u.table === 'daily_stats',
      );
      expect(dailyUpsert).toBeDefined();
      expect((dailyUpsert!.data as any).user_id).toBe('user-abc-123');
    });

    it('returns 401 when the Bearer token is not found in the DB', async () => {
      _currentSupabaseMock = makeSupabaseMock({ tokenUserId: null });
      const { POST } = await import('../../app/api/ingest/route');

      const req = makeRequest(VALID_PAYLOAD, {
        authorization: 'Bearer wrong-token',
      });
      const res = await POST(req as any);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('invalid token');
    });

    it('returns 401 when Authorization header is present but token lookup DB errors', async () => {
      _currentSupabaseMock = makeSupabaseMock({ tokenLookupError: true });
      const { POST } = await import('../../app/api/ingest/route');

      const req = makeRequest(VALID_PAYLOAD, {
        authorization: 'Bearer some-token',
      });
      const res = await POST(req as any);
      expect(res.status).toBe(500);
    });
  });

  describe('No auth', () => {
    it('returns 401 when Authorization header is absent', async () => {
      _currentSupabaseMock = makeSupabaseMock({});
      const { POST } = await import('../../app/api/ingest/route');

      const req = makeRequest(VALID_PAYLOAD);
      const res = await POST(req as any);
      expect(res.status).toBe(401);
      const json = await res.json();
      expect(json.error).toBe('missing auth');
    });
  });
});
