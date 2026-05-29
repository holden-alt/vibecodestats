import { describe, it, expect, vi, beforeEach } from 'vitest';

const VALID_TOKEN = 'test-bearer-token';
const USER_ID = 'user-uuid-1';

const validBody = {
  github_handle: 'holden-alt',
  machine: 'iMac',
  date: '2026-05-14',
  tokens_total: 1000,
  tokens_by_model: { 'claude-opus-4-7': 1000 },
  sessions: 2,
  deep_work_minutes: 30,
  projects_touched: { 'holden-alt/cc-dashboard': 1000 },
  ships: { commits: 1, repos: 1 },
  hourly_tokens: { '09': 500, '10': 500 },
};

type MachineRowT = {
  machine: string;
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
  hourly_tokens: Record<string, number>;
};

// Store-backed mock so repeated/multi-machine pushes behave realistically.
let machineStore: Record<string, MachineRowT> = {};
const dailyUpsertMock = vi.fn(async (_row: Record<string, unknown>) => ({ error: null }));
const tokenSelectSingle = vi.fn(
  async (): Promise<{ data: { id: string } | null; error: null }> => ({
    data: { id: USER_ID },
    error: null,
  }),
);

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: tokenSelectSingle }) }) };
      }
      if (table === 'machine_daily_stats') {
        return {
          upsert: vi.fn(async (rowArg: MachineRowT) => {
            machineStore[rowArg.machine] = rowArg;
            return { error: null };
          }),
          select: () => ({
            eq: () => ({
              eq: async () => ({ data: Object.values(machineStore), error: null }),
            }),
          }),
        };
      }
      if (table === 'daily_stats') {
        return { upsert: dailyUpsertMock };
      }
      return { upsert: dailyUpsertMock };
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  machineStore = {};
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
});

function makeRequest(body: object, token = VALID_TOKEN) {
  const raw = JSON.stringify(body);
  return new Request('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: raw,
  });
}

describe('POST /api/ingest — auth + validation', () => {
  it('accepts a valid token payload, rolls up into daily_stats', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(tokenSelectSingle).toHaveBeenCalled();
    expect(dailyUpsertMock).toHaveBeenCalledOnce();
    const rollup = dailyUpsertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(rollup.user_id).toBe(USER_ID);
    expect(rollup.tokens_total).toBe(1000);
    expect(rollup.machines).toEqual(['iMac']);
  });

  it('rejects a missing Authorization header with 401', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const raw = JSON.stringify(validBody);
    const req = new Request('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('rejects an invalid token with 401', async () => {
    tokenSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(makeRequest(validBody, 'wrong-token'));
    expect(res.status).toBe(401);
    expect(dailyUpsertMock).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload with 400', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(makeRequest({ ...validBody, date: 'nope' }));
    expect(res.status).toBe(400);
  });
});

describe('POST /api/ingest — rollup semantics', () => {
  it('repeated same-machine push does not double-count', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    await POST(makeRequest({ ...validBody, machine: 'iMac', tokens_total: 500 }));
    await POST(makeRequest({ ...validBody, machine: 'iMac', tokens_total: 700 }));
    // last daily_stats upsert reflects iMac's LATEST number, not the sum
    const last = dailyUpsertMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(last.tokens_total).toBe(700);
    expect(last.machines).toEqual(['iMac']);
  });

  it('two machines roll up to the cross-machine sum', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    await POST(makeRequest({
      ...validBody, machine: 'iMac', tokens_total: 500,
      tokens_by_model: { 'claude-opus-4-7': 500 },
      sessions: 1, deep_work_minutes: 20,
      projects_touched: { 'holden-alt/cc-dashboard': 500 },
      ships: { commits: 1, repos: 1 },
    }));
    await POST(makeRequest({
      ...validBody, machine: 'MacBook-Air', tokens_total: 300,
      tokens_by_model: { 'claude-opus-4-7': 200, 'claude-sonnet-4-6': 100 },
      sessions: 2, deep_work_minutes: 15,
      projects_touched: { 'holden-alt/cc-dashboard': 300 },
      ships: { commits: 2, repos: 1 },
    }));
    const rollup = dailyUpsertMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(rollup.tokens_total).toBe(800);
    expect((rollup.machines as string[]).slice().sort()).toEqual(['MacBook-Air', 'iMac']);
    expect(rollup.tokens_by_model).toEqual({
      'claude-opus-4-7': 700, 'claude-sonnet-4-6': 100,
    });
    expect(rollup.sessions).toBe(3);
    expect(rollup.deep_work_minutes).toBe(35);
    expect(rollup.projects_touched).toEqual({ 'holden-alt/cc-dashboard': 800 });
    expect(rollup.ships).toEqual({ commits: 3, repos: 1 }); // commits sum, repos max
  });

  it('merges hourly_tokens across machines', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    await POST(makeRequest({
      ...validBody, machine: 'iMac', tokens_total: 500,
      hourly_tokens: { '9': 300, '10': 200 },
    }));
    await POST(makeRequest({
      ...validBody, machine: 'MacBook-Air', tokens_total: 300,
      hourly_tokens: { '10': 100, '22': 200 },
    }));
    const rollup = dailyUpsertMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(rollup.hourly_tokens).toEqual({ '9': 300, '10': 300, '22': 200 });
  });
});
