# cc-dashboard Plan 2 — Ingestion Pipeline + Realtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real Claude Code stats flow from Holden's Macs into the dashboard after every CC turn, and the profile page updates live — token counter ticks up, today's heatmap cell fills, all without a page refresh.

**Architecture:** A local Python script (`dashboard-push.py`) parses today's `~/.claude/projects/*/*.jsonl` session files incrementally, computes a `daily_stats` row (tokens, sessions, deep-work minutes, projects touched, ships), HMAC-signs it, and POSTs to a `/api/ingest` edge route on the deployed app. The route verifies the HMAC, upserts into Supabase via the service-role key. The profile page becomes a client component that subscribes to Supabase Realtime on `daily_stats` and re-renders live. A `Stop` hook in `~/.claude/settings.json` runs the push script (backgrounded, debounced) after every CC turn.

**Tech Stack:** Python 3 (stdlib only — no pip deps), Next.js edge route, Web Crypto API for HMAC, Supabase Realtime, `@supabase/supabase-js` realtime channels.

**Spec reference:** `docs/superpowers/specs/2026-05-13-cc-dashboard-design.md` §8, §10

**Prereqs from Plan 1:** Deployed at `https://cc-dashboard-qab.pages.dev`. Supabase project `zhumaztwplxrzsdsabtp` live with `users` + `daily_stats` tables. `INGEST_HMAC_SECRET` already set as a CF Pages env var (a random hex string) — Plan 2 Task 3 reads the same value into the local script's environment.

---

## Key engineering decisions (made during planning — Holden can veto)

1. **Incremental parse, not full re-parse.** The Stop hook fires after *every* turn. Re-parsing 117+ project dirs each time is wasteful. `dashboard-push.py` (default mode) only parses JSONL files modified since local midnight, computes *today's* row, and POSTs that single row. A separate `--backfill` mode parses everything once for history.

2. **Backgrounded + debounced hook.** The `Stop` hook launches the script with `&` (non-blocking — never adds latency to Holden's CC session). The script itself debounces: if it pushed < 90 seconds ago (tracked in `~/.claude/.cc-dashboard-last-push`), it exits immediately.

3. **Deep-work definition.** Within a session, consecutive message timestamps less than 15 minutes apart form a "work block." `deep_work_minutes` = sum of all block spans for the day. A lone message is a 0-minute block.

4. **Ships = today's commits across `~/Claude` repos.** The script runs `git log --since=midnight --author=<git user.email> --oneline` in every git repo found under `~/Claude/*` and `~/Claude/*/*`, sums the commit counts. Stored as `{"commits": N, "repos": M}` in the `ships` jsonb column. PR/release detection is deferred to a later plan.

5. **Single shared HMAC secret for v1.** Both of Holden's Macs use the same `INGEST_HMAC_SECRET`. Per-user / per-machine secrets are a v2 concern (when other vibecoders join). The `machine` field in the payload is still sent (so the dashboard can show per-machine breakdown) but isn't individually authenticated in v1.

6. **POST target is the deployed URL.** `https://cc-dashboard-qab.pages.dev/api/ingest` for now. When the custom domain lands (Plan 7), it becomes `https://vibecodestats.dev/api/ingest` — the script reads the target from its own env/config so it's a one-line change.

---

## File Structure (after Plan 2)

```
cc-dashboard/
  scripts/
    dashboard-push.py            Local stats parser + pusher (stdlib only)
    install-hook.sh              Idempotently adds the Stop hook to ~/.claude/settings.json
  app/
    api/
      ingest/
        route.ts                 Edge route: HMAC verify + upsert daily_stats
  lib/
    ingest/
      payload.ts                 Shared IngestPayload type + zod-free validator
      hmac.ts                    Web Crypto HMAC sign/verify helpers
    stats/
      profile-data.ts            Server-side fetch of a user's daily_stats rows
  components/
    ProfileLive.tsx              Client component — subscribes to Realtime, holds live state
    BuildsPane.tsx               (MODIFIED — accepts real props)
    ActivityPane.tsx             (MODIFIED — accepts real props, live token tick)
    PersonaPane.tsx              (unchanged this plan)
    StatusBar.tsx                (MODIFIED — accepts real props)
    Heatmap.tsx                  (MODIFIED — today cell pulse animation)
  supabase/
    migrations/
      20260514000002_machine_stats.sql           Per-machine sub-totals table
      20260514000003_realtime.sql                Enable realtime publication on daily_stats
  tests/
    db/
      machine-stats-schema.test.ts
    ingest/
      hmac.test.ts
      payload.test.ts
      route.test.ts
    stats/
      profile-data.test.ts
    components/
      ProfileLive.test.tsx
    python/
      test_dashboard_push.py     Python unittest for the parser logic
      test_install_hook.py       Python unittest for the hook installer
  app/[handle]/page.tsx          (MODIFIED — server-fetches real data, renders ProfileLive)
```

---

## Phase 0 — Shared ingest contract

### Task 0.1: `IngestPayload` type + validator

**Files:** `lib/ingest/payload.ts`, `tests/ingest/payload.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/ingest/payload.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { validateIngestPayload } from '@/lib/ingest/payload';

const valid = {
  github_handle: 'holden-alt',
  machine: 'iMac',
  date: '2026-05-14',
  tokens_total: 487231,
  tokens_by_model: { 'claude-opus-4-7': 480000, 'claude-sonnet-4-6': 7231 },
  sessions: 6,
  deep_work_minutes: 240,
  projects_touched: { 'holden-alt/cc-dashboard': 300000, 'realsavvy/agnt-portal': 187231 },
  ships: { commits: 12, repos: 3 },
};

describe('validateIngestPayload', () => {
  it('accepts a well-formed payload', () => {
    const result = validateIngestPayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.github_handle).toBe('holden-alt');
  });

  it('rejects a missing github_handle', () => {
    const { github_handle, ...rest } = valid;
    const result = validateIngestPayload(rest);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed date', () => {
    const result = validateIngestPayload({ ...valid, date: '05/14/2026' });
    expect(result.ok).toBe(false);
  });

  it('rejects negative tokens_total', () => {
    const result = validateIngestPayload({ ...valid, tokens_total: -5 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateIngestPayload(null).ok).toBe(false);
    expect(validateIngestPayload('hello').ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/ingest/payload.test.ts`
Expected: FAIL — `Cannot find module '@/lib/ingest/payload'`.

- [ ] **Step 3: Write the implementation**

`lib/ingest/payload.ts`:

```ts
export type IngestPayload = {
  github_handle: string;
  machine: string;
  date: string; // YYYY-MM-DD
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
};

export type ValidationResult =
  | { ok: true; value: IngestPayload }
  | { ok: false; error: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isNonNegNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v) && v >= 0;
}

function isNumberRecord(v: unknown): v is Record<string, number> {
  return isPlainObject(v) && Object.values(v).every(isNonNegNumber);
}

export function validateIngestPayload(body: unknown): ValidationResult {
  if (!isPlainObject(body)) {
    return { ok: false, error: 'body must be an object' };
  }
  if (typeof body.github_handle !== 'string' || body.github_handle.length === 0) {
    return { ok: false, error: 'github_handle required' };
  }
  if (typeof body.machine !== 'string' || body.machine.length === 0) {
    return { ok: false, error: 'machine required' };
  }
  if (typeof body.date !== 'string' || !DATE_RE.test(body.date)) {
    return { ok: false, error: 'date must be YYYY-MM-DD' };
  }
  if (!isNonNegNumber(body.tokens_total)) {
    return { ok: false, error: 'tokens_total must be a non-negative number' };
  }
  if (!isNumberRecord(body.tokens_by_model)) {
    return { ok: false, error: 'tokens_by_model must be a record of non-negative numbers' };
  }
  if (!isNonNegNumber(body.sessions)) {
    return { ok: false, error: 'sessions must be a non-negative number' };
  }
  if (!isNonNegNumber(body.deep_work_minutes)) {
    return { ok: false, error: 'deep_work_minutes must be a non-negative number' };
  }
  if (!isNumberRecord(body.projects_touched)) {
    return { ok: false, error: 'projects_touched must be a record of non-negative numbers' };
  }
  if (
    !isPlainObject(body.ships) ||
    !isNonNegNumber(body.ships.commits) ||
    !isNonNegNumber(body.ships.repos)
  ) {
    return { ok: false, error: 'ships must be { commits, repos }' };
  }

  return {
    ok: true,
    value: {
      github_handle: body.github_handle,
      machine: body.machine,
      date: body.date,
      tokens_total: body.tokens_total,
      tokens_by_model: body.tokens_by_model,
      sessions: body.sessions,
      deep_work_minutes: body.deep_work_minutes,
      projects_touched: body.projects_touched,
      ships: { commits: body.ships.commits, repos: body.ships.repos },
    },
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test tests/ingest/payload.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```sh
git add lib/ingest/payload.ts tests/ingest/payload.test.ts
git commit -m "feat(ingest): IngestPayload type + validator"
```

---

### Task 0.2: HMAC sign/verify helpers (Web Crypto)

**Files:** `lib/ingest/hmac.ts`, `tests/ingest/hmac.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/ingest/hmac.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { signPayload, verifyPayload } from '@/lib/ingest/hmac';

const secret = 'test-secret-abc123';
const body = '{"github_handle":"holden-alt","date":"2026-05-14"}';

describe('hmac sign/verify', () => {
  it('a signature it produced verifies true', async () => {
    const sig = await signPayload(body, secret);
    expect(await verifyPayload(body, sig, secret)).toBe(true);
  });

  it('a tampered body fails verification', async () => {
    const sig = await signPayload(body, secret);
    expect(await verifyPayload(body + 'x', sig, secret)).toBe(false);
  });

  it('a wrong secret fails verification', async () => {
    const sig = await signPayload(body, secret);
    expect(await verifyPayload(body, sig, 'wrong-secret')).toBe(false);
  });

  it('a malformed signature fails verification, does not throw', async () => {
    expect(await verifyPayload(body, 'not-hex!!', secret)).toBe(false);
    expect(await verifyPayload(body, '', secret)).toBe(false);
  });

  it('signature is lowercase hex', async () => {
    const sig = await signPayload(body, secret);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/ingest/hmac.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/ingest/hmac.ts`:

```ts
// HMAC-SHA256 using Web Crypto — works on the edge runtime AND in Node 20+ test env.

function hexToBytes(hex: string): Uint8Array | null {
  if (hex.length === 0 || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    return null;
  }
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify'],
  );
}

export async function signPayload(body: string, secret: string): Promise<string> {
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body));
  return bytesToHex(sig);
}

export async function verifyPayload(
  body: string,
  signatureHex: string,
  secret: string,
): Promise<boolean> {
  const sigBytes = hexToBytes(signatureHex);
  if (!sigBytes) return false;
  const key = await importKey(secret);
  return crypto.subtle.verify('HMAC', key, sigBytes, new TextEncoder().encode(body));
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test tests/ingest/hmac.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```sh
git add lib/ingest/hmac.ts tests/ingest/hmac.test.ts
git commit -m "feat(ingest): Web Crypto HMAC sign/verify helpers"
```

---

## Phase 1 — `/api/ingest` edge route

> **Data model note:** `dashboard-push.py` sends each machine's *cumulative* total for the day, re-sent on every CC turn. So the route must NOT blindly sum — a repeated push from the same machine would double-count. The model: a `machine_daily_stats` table holds each machine's own latest cumulative number (upsert replaces it), and `daily_stats` is the cross-machine rollup recomputed on every push. This is built correctly from the start — no naive-merge intermediate step.

### Task 1.1: `machine_daily_stats` table

**Files:** `supabase/migrations/20260514000002_machine_stats.sql`, `lib/types/database.ts` (MODIFY), `tests/db/machine-stats-schema.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/db/machine-stats-schema.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('machine_daily_stats migration', () => {
  const sql = readFileSync(
    resolve(__dirname, '../../supabase/migrations/20260514000002_machine_stats.sql'),
    'utf8',
  );
  it('creates public.machine_daily_stats with a (user_id, date, machine) primary key', () => {
    expect(sql).toMatch(/create table public\.machine_daily_stats/i);
    expect(sql).toMatch(/primary key\s*\(user_id, date, machine\)/i);
  });
  it('enables RLS and a public select policy', () => {
    expect(sql).toMatch(/alter table public\.machine_daily_stats enable row level security/i);
    expect(sql).toMatch(/machine_daily_stats_select_all/);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/db/machine-stats-schema.test.ts`
Expected: FAIL — migration file missing.

- [ ] **Step 3: Write the migration + apply it + update types**

`supabase/migrations/20260514000002_machine_stats.sql`:

```sql
-- 20260514000002_machine_stats.sql
-- Per-machine daily sub-totals. daily_stats stays the cross-machine rollup;
-- machine_daily_stats holds each machine's own latest cumulative number for the day.

create table public.machine_daily_stats (
  user_id uuid not null references public.users (id) on delete cascade,
  date date not null,
  machine text not null,
  tokens_total bigint not null default 0,
  tokens_by_model jsonb not null default '{}'::jsonb,
  sessions integer not null default 0,
  deep_work_minutes integer not null default 0,
  projects_touched jsonb not null default '{}'::jsonb,
  ships jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, date, machine)
);

create index machine_daily_stats_user_date_idx
  on public.machine_daily_stats (user_id, date desc);

alter table public.machine_daily_stats enable row level security;
create policy machine_daily_stats_select_all
  on public.machine_daily_stats for select using (true);
-- writes via service_role only.
```

Apply it to the live project (from `~/Claude/holden-alt/cc-dashboard`):

```sh
curl -s -w "\nHTTP:%{http_code}\n" -X POST "https://api.supabase.com/v1/projects/zhumaztwplxrzsdsabtp/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: cc-dashboard-setup/1.0" \
  --data-raw "$(jq -Rs '{query: .}' < supabase/migrations/20260514000002_machine_stats.sql)"
```

Expected: `[]` with `HTTP:201`.

Then add a `machine_daily_stats` block to `lib/types/database.ts` (inside `Database['public']['Tables']`), mirroring the `daily_stats` shape but with an added `machine: string` column and `updated_at: string`. Include `Relationships: []`. Row/Insert/Update all present.

- [ ] **Step 4: Run test + typecheck**

Run: `pnpm test tests/db/machine-stats-schema.test.ts && pnpm typecheck`
Expected: PASS, clean.

- [ ] **Step 5: Commit**

```sh
git add supabase/migrations/20260514000002_machine_stats.sql lib/types/database.ts tests/db/machine-stats-schema.test.ts
git commit -m "feat(db): machine_daily_stats per-machine sub-totals table"
```

---

### Task 1.2: The `/api/ingest` edge route

**Files:** `app/api/ingest/route.ts`, `tests/ingest/route.test.ts`

Built correct from the start: HMAC verify → validate → look up user → upsert this machine's sub-total → re-read all machines for the day → roll up into `daily_stats`.

- [ ] **Step 1: Write the failing test**

`tests/ingest/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signPayload } from '@/lib/ingest/hmac';

const SECRET = 'test-ingest-secret';

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
};

type MachineRowT = {
  machine: string;
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
};

// Store-backed mock so repeated/multi-machine pushes behave realistically.
let machineStore: Record<string, MachineRowT> = {};
const dailyUpsertMock = vi.fn(async () => ({ error: null }));
const userSelectSingle = vi.fn(async () => ({ data: { id: 'user-uuid-1' }, error: null }));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: (table: string) => {
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ maybeSingle: userSelectSingle }) }) };
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
      // daily_stats
      return { upsert: dailyUpsertMock };
    },
  })),
}));

beforeEach(() => {
  vi.clearAllMocks();
  machineStore = {};
  process.env.INGEST_HMAC_SECRET = SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-test';
});

async function makeRequest(body: object, sig?: string) {
  const raw = JSON.stringify(body);
  const signature = sig ?? (await signPayload(raw, SECRET));
  return new Request('http://localhost:3000/api/ingest', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-cc-signature': signature },
    body: raw,
  });
}

describe('POST /api/ingest — auth + validation', () => {
  it('accepts a valid signed payload, rolls up into daily_stats', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(await makeRequest(validBody));
    expect(res.status).toBe(200);
    expect(userSelectSingle).toHaveBeenCalled();
    expect(dailyUpsertMock).toHaveBeenCalledOnce();
    const rollup = dailyUpsertMock.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(rollup.user_id).toBe('user-uuid-1');
    expect(rollup.tokens_total).toBe(1000);
    expect(rollup.machines).toEqual(['iMac']);
  });

  it('rejects a bad signature with 401', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(await makeRequest(validBody, 'deadbeef'));
    expect(res.status).toBe(401);
    expect(dailyUpsertMock).not.toHaveBeenCalled();
  });

  it('rejects a missing signature header with 401', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const raw = JSON.stringify(validBody);
    const req = new Request('http://localhost:3000/api/ingest', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: raw,
    });
    expect((await POST(req)).status).toBe(401);
  });

  it('rejects a malformed payload with 400', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(await makeRequest({ ...validBody, date: 'nope' }));
    expect(res.status).toBe(400);
  });

  it('returns 404 when github_handle has no user row', async () => {
    userSelectSingle.mockResolvedValueOnce({ data: null, error: null });
    const { POST } = await import('../../app/api/ingest/route');
    const res = await POST(await makeRequest(validBody));
    expect(res.status).toBe(404);
    expect(dailyUpsertMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/ingest — rollup semantics', () => {
  it('repeated same-machine push does not double-count', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    await POST(await makeRequest({ ...validBody, machine: 'iMac', tokens_total: 500 }));
    await POST(await makeRequest({ ...validBody, machine: 'iMac', tokens_total: 700 }));
    // last daily_stats upsert reflects iMac's LATEST number, not the sum
    const last = dailyUpsertMock.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(last.tokens_total).toBe(700);
    expect(last.machines).toEqual(['iMac']);
  });

  it('two machines roll up to the cross-machine sum', async () => {
    const { POST } = await import('../../app/api/ingest/route');
    await POST(await makeRequest({
      ...validBody, machine: 'iMac', tokens_total: 500,
      tokens_by_model: { 'claude-opus-4-7': 500 },
      sessions: 1, deep_work_minutes: 20,
      projects_touched: { 'holden-alt/cc-dashboard': 500 },
      ships: { commits: 1, repos: 1 },
    }));
    await POST(await makeRequest({
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
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/ingest/route.test.ts`
Expected: FAIL — route module not found.

- [ ] **Step 3: Write the implementation**

`app/api/ingest/route.ts`:

```ts
import { createClient } from '@supabase/supabase-js';
import { verifyPayload } from '@/lib/ingest/hmac';
import { validateIngestPayload } from '@/lib/ingest/payload';
import type { Database } from '@/lib/types/database';

export const runtime = 'edge';

function mergeNumberRecords(
  a: Record<string, number>,
  b: Record<string, number>,
): Record<string, number> {
  const out: Record<string, number> = { ...a };
  for (const [k, v] of Object.entries(b)) {
    out[k] = (out[k] ?? 0) + v;
  }
  return out;
}

type MachineRow = {
  machine: string;
  tokens_total: number;
  tokens_by_model: Record<string, number>;
  sessions: number;
  deep_work_minutes: number;
  projects_touched: Record<string, number>;
  ships: { commits: number; repos: number };
};

export async function POST(request: Request): Promise<Response> {
  const signature = request.headers.get('x-cc-signature');
  if (!signature) {
    return Response.json({ error: 'missing signature' }, { status: 401 });
  }

  const rawBody = await request.text();
  const secret = process.env.INGEST_HMAC_SECRET;
  if (!secret) {
    return Response.json({ error: 'server misconfigured' }, { status: 500 });
  }

  if (!(await verifyPayload(rawBody, signature, secret))) {
    return Response.json({ error: 'invalid signature' }, { status: 401 });
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const validation = validateIngestPayload(parsed);
  if (!validation.ok) {
    return Response.json({ error: validation.error }, { status: 400 });
  }
  const payload = validation.value;

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('github_handle', payload.github_handle)
    .maybeSingle();

  if (userError) {
    return Response.json({ error: 'user lookup failed' }, { status: 500 });
  }
  if (!user) {
    return Response.json({ error: 'unknown github_handle' }, { status: 404 });
  }

  // 1. Replace this machine's sub-total for the day (repeated pushes just overwrite).
  const { error: machineUpsertError } = await supabase.from('machine_daily_stats').upsert(
    {
      user_id: user.id,
      date: payload.date,
      machine: payload.machine,
      tokens_total: payload.tokens_total,
      tokens_by_model: payload.tokens_by_model,
      sessions: payload.sessions,
      deep_work_minutes: payload.deep_work_minutes,
      projects_touched: payload.projects_touched,
      ships: payload.ships,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,date,machine' },
  );
  if (machineUpsertError) {
    return Response.json(
      { error: 'machine upsert failed', detail: machineUpsertError.message },
      { status: 500 },
    );
  }

  // 2. Read every machine's sub-total for the day.
  const { data: machineRows, error: rollupSelectError } = await supabase
    .from('machine_daily_stats')
    .select('machine, tokens_total, tokens_by_model, sessions, deep_work_minutes, projects_touched, ships')
    .eq('user_id', user.id)
    .eq('date', payload.date);
  if (rollupSelectError || !machineRows) {
    return Response.json({ error: 'rollup select failed' }, { status: 500 });
  }
  const rows = machineRows as MachineRow[];

  // 3. Roll up across machines and upsert daily_stats.
  const rollup = {
    user_id: user.id,
    date: payload.date,
    tokens_total: rows.reduce((s, r) => s + r.tokens_total, 0),
    tokens_by_model: rows.reduce<Record<string, number>>(
      (acc, r) => mergeNumberRecords(acc, r.tokens_by_model),
      {},
    ),
    sessions: rows.reduce((s, r) => s + r.sessions, 0),
    deep_work_minutes: rows.reduce((s, r) => s + r.deep_work_minutes, 0),
    machines: rows.map((r) => r.machine).sort(),
    projects_touched: rows.reduce<Record<string, number>>(
      (acc, r) => mergeNumberRecords(acc, r.projects_touched),
      {},
    ),
    ships: {
      commits: rows.reduce((s, r) => s + r.ships.commits, 0),
      repos: rows.reduce((m, r) => Math.max(m, r.ships.repos), 0),
    },
    source_synced_at: new Date().toISOString(),
  };

  const { error: upsertError } = await supabase
    .from('daily_stats')
    .upsert(rollup, { onConflict: 'user_id,date' });
  if (upsertError) {
    return Response.json({ error: 'upsert failed', detail: upsertError.message }, { status: 500 });
  }

  return Response.json({ ok: true }, { status: 200 });
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test tests/ingest/route.test.ts && pnpm typecheck`
Expected: PASS — auth/validation + both rollup-semantics tests.

- [ ] **Step 5: Commit**

```sh
git add app/api/ingest/route.ts tests/ingest/route.test.ts
git commit -m "feat(ingest): /api/ingest edge route with per-machine rollup"
```

---

## Phase 2 — `dashboard-push.py` local script

### Task 2.1: JSONL parser — today's per-machine stats

**Files:** `scripts/dashboard-push.py`, `tests/python/test_dashboard_push.py`

The script is stdlib-only Python 3. This task builds the parsing core: given a set of JSONL paths and a target date, produce the token / session / project aggregates.

- [ ] **Step 1: Write the failing test**

`tests/python/test_dashboard_push.py`:

```python
import json
import os
import tempfile
import unittest
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'scripts'))
import dashboard_push  # noqa: E402


def write_jsonl(path, records):
    with open(path, 'w') as f:
        for r in records:
            f.write(json.dumps(r) + '\n')


class TestParseSessions(unittest.TestCase):
    def test_aggregates_tokens_sessions_projects_for_target_date(self):
        with tempfile.TemporaryDirectory() as d:
            proj = os.path.join(d, '-Users-holden-Claude-cc')
            os.makedirs(proj)
            write_jsonl(os.path.join(proj, 'sess-1.jsonl'), [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 100, 'output_tokens': 200,
                                       'cache_read_input_tokens': 9999}}},
                {'type': 'assistant', 'timestamp': '2026-05-14T10:05:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 50, 'output_tokens': 50}}},
                # different day — must be ignored
                {'type': 'assistant', 'timestamp': '2026-05-13T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/holden-alt/cc-dashboard', 'sessionId': 'sess-1',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1, 'output_tokens': 1}}},
            ])
            write_jsonl(os.path.join(proj, 'sess-2.jsonl'), [
                {'type': 'assistant', 'timestamp': '2026-05-14T12:00:00.000Z',
                 'cwd': '/Users/holden/Claude/realsavvy/agnt-portal', 'sessionId': 'sess-2',
                 'message': {'model': 'claude-sonnet-4-6',
                             'usage': {'input_tokens': 10, 'output_tokens': 5}}},
            ])

            result = dashboard_push.parse_day(
                [os.path.join(proj, 'sess-1.jsonl'), os.path.join(proj, 'sess-2.jsonl')],
                target_date='2026-05-14',
                home='/Users/holden',
            )

            # fresh tokens only: (100+200) + (50+50) = 400 opus, (10+5)=15 sonnet
            self.assertEqual(result['tokens_total'], 415)
            self.assertEqual(result['tokens_by_model'], {
                'claude-opus-4-7': 400,
                'claude-sonnet-4-6': 15,
            })
            # two distinct session ids active on the target date
            self.assertEqual(result['sessions'], 2)
            # project labels are home-relative under ~/Claude
            self.assertEqual(result['projects_touched'], {
                'holden-alt/cc-dashboard': 400,
                'realsavvy/agnt-portal': 15,
            })

    def test_synthetic_model_is_skipped(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': '<synthetic>',
                             'usage': {'input_tokens': 999, 'output_tokens': 999}}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            self.assertEqual(result['tokens_total'], 0)


class TestDeepWork(unittest.TestCase):
    def test_continuous_block_under_15min_gap(self):
        # three messages 5 min apart -> one 10-minute block
        timestamps = [
            '2026-05-14T10:00:00.000Z',
            '2026-05-14T10:05:00.000Z',
            '2026-05-14T10:10:00.000Z',
        ]
        self.assertEqual(dashboard_push.deep_work_minutes(timestamps), 10)

    def test_gap_over_15min_splits_blocks(self):
        # block 1: 10:00-10:05 (5 min). gap 30 min. block 2: 10:35-10:40 (5 min). total 10.
        timestamps = [
            '2026-05-14T10:00:00.000Z',
            '2026-05-14T10:05:00.000Z',
            '2026-05-14T10:35:00.000Z',
            '2026-05-14T10:40:00.000Z',
        ]
        self.assertEqual(dashboard_push.deep_work_minutes(timestamps), 10)

    def test_single_message_is_zero(self):
        self.assertEqual(dashboard_push.deep_work_minutes(['2026-05-14T10:00:00.000Z']), 0)

    def test_empty_is_zero(self):
        self.assertEqual(dashboard_push.deep_work_minutes([]), 0)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run test — verify it fails**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: FAIL — `ModuleNotFoundError: No module named 'dashboard_push'`.

- [ ] **Step 3: Write the implementation**

`scripts/dashboard-push.py` (parsing core — the CLI wiring comes in Task 2.4):

```python
#!/usr/bin/env python3
"""
dashboard-push.py — push today's Claude Code stats to the cc-dashboard ingest API.

Stdlib only. Parses ~/.claude/projects/*/*.jsonl for the target date, computes a
per-machine daily stats payload, HMAC-signs it, and POSTs to /api/ingest.

Default mode parses only files modified today (fast — runs after every CC turn
via the Stop hook). --backfill parses everything for a one-time history load.

Env vars required:
  CC_DASHBOARD_URL          e.g. https://cc-dashboard-qab.pages.dev
  CC_DASHBOARD_HMAC_SECRET  same value as the deploy's INGEST_HMAC_SECRET
  CC_DASHBOARD_HANDLE       the GitHub handle whose profile this machine feeds
"""

import glob
import hashlib
import hmac
import json
import os
import socket
import subprocess
import sys
import time
import urllib.request
from collections import defaultdict
from datetime import datetime, timezone

HOME = os.path.expanduser('~')
PROJECTS_DIR = os.path.join(HOME, '.claude', 'projects')
LAST_PUSH_FILE = os.path.join(HOME, '.claude', '.cc-dashboard-last-push')
DEBOUNCE_SECONDS = 90
DEEP_WORK_GAP_SECONDS = 15 * 60


def short_project(cwd, home):
    """Absolute cwd -> short label. /Users/x/Claude/realsavvy/p -> realsavvy/p."""
    if not cwd:
        return 'unknown'
    claude_root = os.path.join(home, 'Claude') + '/'
    if cwd.startswith(claude_root):
        return cwd[len(claude_root):]
    if cwd == home:
        return '~'
    if cwd.startswith(home + '/'):
        return cwd[len(home) + 1:]
    return cwd


def parse_day(jsonl_paths, target_date, home):
    """Parse the given JSONL files, return aggregates for target_date (YYYY-MM-DD)."""
    tokens_by_model = defaultdict(int)
    tokens_by_project = defaultdict(int)
    sessions = set()
    for path in jsonl_paths:
        session_id = os.path.basename(path).replace('.jsonl', '')
        session_cwd = None
        try:
            with open(path) as f:
                for line in f:
                    try:
                        d = json.loads(line)
                    except json.JSONDecodeError:
                        continue
                    if session_cwd is None and d.get('cwd'):
                        session_cwd = d['cwd']
                    ts = d.get('timestamp')
                    if not ts or ts[:10] != target_date:
                        continue
                    if d.get('type') in ('user', 'assistant'):
                        sessions.add(session_id)
                    msg = d.get('message')
                    if not isinstance(msg, dict):
                        continue
                    usage = msg.get('usage')
                    if not isinstance(usage, dict):
                        continue
                    model = msg.get('model') or 'unknown'
                    if model == '<synthetic>':
                        continue
                    fresh = (usage.get('input_tokens') or 0) + (usage.get('output_tokens') or 0)
                    tokens_by_model[model] += fresh
                    label = short_project(session_cwd, home)
                    tokens_by_project[label] += fresh
        except OSError:
            continue
    return {
        'tokens_total': sum(tokens_by_model.values()),
        'tokens_by_model': dict(tokens_by_model),
        'sessions': len(sessions),
        'projects_touched': dict(tokens_by_project),
    }


def deep_work_minutes(timestamps):
    """Sum of continuous-block spans (gaps < 15min keep a block alive), in whole minutes."""
    if len(timestamps) < 2:
        return 0
    parsed = sorted(
        datetime.fromisoformat(t.replace('Z', '+00:00')) for t in timestamps
    )
    total_seconds = 0
    block_start = parsed[0]
    prev = parsed[0]
    for cur in parsed[1:]:
        gap = (cur - prev).total_seconds()
        if gap > DEEP_WORK_GAP_SECONDS:
            total_seconds += (prev - block_start).total_seconds()
            block_start = cur
        prev = cur
    total_seconds += (prev - block_start).total_seconds()
    return int(total_seconds // 60)
```

- [ ] **Step 4: Run test — verify it passes**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: PASS — all `TestParseSessions` + `TestDeepWork` cases.

- [ ] **Step 5: Commit**

```sh
git add scripts/dashboard-push.py tests/python/test_dashboard_push.py
git commit -m "feat(push): JSONL parser core + deep-work calculator"
```

---

### Task 2.2: Deep-work timestamp collection + ships scanner

**Files:** `scripts/dashboard-push.py` (MODIFY), `tests/python/test_dashboard_push.py` (MODIFY)

`parse_day` currently computes tokens/sessions/projects. It also needs to collect per-day message timestamps (to feed `deep_work_minutes`). And we need `count_ships` — today's commit count across `~/Claude` git repos.

- [ ] **Step 1: Write the failing test (add to `test_dashboard_push.py`)**

```python
class TestParseDayTimestamps(unittest.TestCase):
    def test_parse_day_returns_timestamps_for_deep_work(self):
        with tempfile.TemporaryDirectory() as d:
            p = os.path.join(d, 'sess.jsonl')
            write_jsonl(p, [
                {'type': 'assistant', 'timestamp': '2026-05-14T10:00:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's',
                 'message': {'model': 'claude-opus-4-7',
                             'usage': {'input_tokens': 1, 'output_tokens': 1}}},
                {'type': 'user', 'timestamp': '2026-05-14T10:05:00.000Z',
                 'cwd': '/Users/holden/Claude/x', 'sessionId': 's', 'message': {}},
            ])
            result = dashboard_push.parse_day([p], target_date='2026-05-14', home='/Users/holden')
            self.assertIn('timestamps', result)
            self.assertEqual(sorted(result['timestamps']), [
                '2026-05-14T10:00:00.000Z',
                '2026-05-14T10:05:00.000Z',
            ])


class TestCountShips(unittest.TestCase):
    def test_counts_commits_today_across_repos(self):
        with tempfile.TemporaryDirectory() as d:
            # make a git repo with a commit "today"
            repo = os.path.join(d, 'Claude', 'demo-repo')
            os.makedirs(repo)
            env = {**os.environ, 'GIT_AUTHOR_NAME': 'Holden', 'GIT_AUTHOR_EMAIL': 'h@x.com',
                   'GIT_COMMITTER_NAME': 'Holden', 'GIT_COMMITTER_EMAIL': 'h@x.com'}
            subprocess.run(['git', 'init', '-q'], cwd=repo, check=True, env=env)
            with open(os.path.join(repo, 'f.txt'), 'w') as f:
                f.write('hi')
            subprocess.run(['git', 'add', '.'], cwd=repo, check=True, env=env)
            subprocess.run(['git', 'commit', '-q', '-m', 'today commit'], cwd=repo, check=True, env=env)

            today = datetime.now(timezone.utc).strftime('%Y-%m-%d')
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date=today,
                author_email='h@x.com',
            )
            self.assertEqual(result['repos'], 1)
            self.assertEqual(result['commits'], 1)

    def test_no_repos_returns_zero(self):
        with tempfile.TemporaryDirectory() as d:
            os.makedirs(os.path.join(d, 'Claude'))
            result = dashboard_push.count_ships(
                claude_dir=os.path.join(d, 'Claude'),
                target_date='2026-05-14',
                author_email='h@x.com',
            )
            self.assertEqual(result, {'commits': 0, 'repos': 0})
```

- [ ] **Step 2: Run test — verify it fails**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: FAIL — `parse_day` result has no `timestamps` key; `count_ships` undefined.

- [ ] **Step 3: Write the implementation**

In `parse_day`, collect timestamps. Add a `timestamps` list, append `ts` for every user/assistant record on the target date, and include `'timestamps': timestamps` in the returned dict.

Add `count_ships` to `scripts/dashboard-push.py`:

```python
def count_ships(claude_dir, target_date, author_email):
    """Count commits authored by author_email on target_date across git repos
    directly under claude_dir and one level deeper (claude_dir/*/  and claude_dir/*/*/)."""
    candidates = []
    for depth1 in glob.glob(os.path.join(claude_dir, '*')):
        if os.path.isdir(os.path.join(depth1, '.git')):
            candidates.append(depth1)
        for depth2 in glob.glob(os.path.join(depth1, '*')):
            if os.path.isdir(os.path.join(depth2, '.git')):
                candidates.append(depth2)

    commits = 0
    repos_with_commits = 0
    since = target_date + 'T00:00:00'
    until = target_date + 'T23:59:59'
    for repo in candidates:
        try:
            out = subprocess.run(
                ['git', 'log', '--author=' + author_email,
                 '--since=' + since, '--until=' + until, '--oneline'],
                cwd=repo, capture_output=True, text=True, timeout=10,
            )
        except (subprocess.SubprocessError, OSError):
            continue
        if out.returncode != 0:
            continue
        n = len([ln for ln in out.stdout.splitlines() if ln.strip()])
        if n > 0:
            commits += n
            repos_with_commits += 1
    return {'commits': commits, 'repos': repos_with_commits}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add scripts/dashboard-push.py tests/python/test_dashboard_push.py
git commit -m "feat(push): timestamp collection + git ships scanner"
```

---

### Task 2.3: HMAC signing + POST + payload assembly

**Files:** `scripts/dashboard-push.py` (MODIFY), `tests/python/test_dashboard_push.py` (MODIFY)

- [ ] **Step 1: Write the failing test (add to `test_dashboard_push.py`)**

```python
class TestSignAndPayload(unittest.TestCase):
    def test_sign_body_matches_known_hmac(self):
        # HMAC-SHA256 of 'hello' with key 'k' — precomputed.
        import hmac as _hmac, hashlib as _hashlib
        expected = _hmac.new(b'k', b'hello', _hashlib.sha256).hexdigest()
        self.assertEqual(dashboard_push.sign_body('hello', 'k'), expected)

    def test_build_payload_shape(self):
        day = {
            'tokens_total': 415,
            'tokens_by_model': {'claude-opus-4-7': 400, 'claude-sonnet-4-6': 15},
            'sessions': 2,
            'projects_touched': {'holden-alt/cc-dashboard': 400},
            'timestamps': ['2026-05-14T10:00:00.000Z', '2026-05-14T10:05:00.000Z'],
        }
        ships = {'commits': 3, 'repos': 2}
        payload = dashboard_push.build_payload(
            day, ships, github_handle='holden-alt', machine='iMac', target_date='2026-05-14',
        )
        self.assertEqual(payload['github_handle'], 'holden-alt')
        self.assertEqual(payload['machine'], 'iMac')
        self.assertEqual(payload['date'], '2026-05-14')
        self.assertEqual(payload['tokens_total'], 415)
        self.assertEqual(payload['deep_work_minutes'], 5)  # two ts 5 min apart
        self.assertEqual(payload['ships'], {'commits': 3, 'repos': 2})
        self.assertNotIn('timestamps', payload)  # internal-only, not sent
```

- [ ] **Step 2: Run test — verify it fails**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: FAIL — `sign_body` / `build_payload` undefined.

- [ ] **Step 3: Write the implementation**

Add to `scripts/dashboard-push.py`:

```python
def sign_body(body, secret):
    """HMAC-SHA256 hex digest — must match lib/ingest/hmac.ts signPayload()."""
    return hmac.new(secret.encode(), body.encode(), hashlib.sha256).hexdigest()


def build_payload(day, ships, github_handle, machine, target_date):
    """Assemble the IngestPayload dict the /api/ingest route expects."""
    return {
        'github_handle': github_handle,
        'machine': machine,
        'date': target_date,
        'tokens_total': day['tokens_total'],
        'tokens_by_model': day['tokens_by_model'],
        'sessions': day['sessions'],
        'deep_work_minutes': deep_work_minutes(day.get('timestamps', [])),
        'projects_touched': day['projects_touched'],
        'ships': ships,
    }


def post_payload(url, payload, secret):
    """Sign and POST the payload. Returns (status_code, response_text)."""
    body = json.dumps(payload, separators=(',', ':'), sort_keys=True)
    signature = sign_body(body, secret)
    req = urllib.request.Request(
        url.rstrip('/') + '/api/ingest',
        data=body.encode(),
        headers={'Content-Type': 'application/json', 'X-CC-Signature': signature},
        method='POST',
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()
```

> **Critical:** `post_payload` serializes with `separators=(',', ':')` and `sort_keys=True`. The `/api/ingest` route signs over the **raw request body bytes** it receives — so the bytes the script signs must be the exact bytes it sends. `json.dumps` with fixed separators + sorted keys guarantees a deterministic body. The route does NOT re-serialize before verifying — it calls `verifyPayload(rawBody, ...)` on `await request.text()`. This is consistent. Do not change one side without the other.

- [ ] **Step 4: Run test — verify it passes**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add scripts/dashboard-push.py tests/python/test_dashboard_push.py
git commit -m "feat(push): HMAC signing + payload assembly + POST"
```

---

### Task 2.4: CLI wiring — default mode, --backfill, debounce

**Files:** `scripts/dashboard-push.py` (MODIFY), `tests/python/test_dashboard_push.py` (MODIFY)

- [ ] **Step 1: Write the failing test (add to `test_dashboard_push.py`)**

```python
class TestFileSelection(unittest.TestCase):
    def test_today_files_only_picks_recently_modified(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            recent = os.path.join(proj, 'recent.jsonl')
            old = os.path.join(proj, 'old.jsonl')
            open(recent, 'w').close()
            open(old, 'w').close()
            # set 'old' mtime to 3 days ago
            old_time = time.time() - 3 * 86400
            os.utime(old, (old_time, old_time))

            picked = dashboard_push.today_jsonl_files(projects)
            self.assertIn(recent, picked)
            self.assertNotIn(old, picked)

    def test_all_files_picks_everything(self):
        with tempfile.TemporaryDirectory() as d:
            projects = os.path.join(d, 'projects')
            proj = os.path.join(projects, 'p')
            os.makedirs(proj)
            a = os.path.join(proj, 'a.jsonl')
            b = os.path.join(proj, 'b.jsonl')
            open(a, 'w').close()
            open(b, 'w').close()
            old_time = time.time() - 30 * 86400
            os.utime(b, (old_time, old_time))
            picked = dashboard_push.all_jsonl_files(projects)
            self.assertEqual(sorted(picked), sorted([a, b]))


class TestDebounce(unittest.TestCase):
    def test_debounced_when_recent(self):
        with tempfile.TemporaryDirectory() as d:
            marker = os.path.join(d, 'last-push')
            with open(marker, 'w') as f:
                f.write(str(time.time()))  # just now
            self.assertTrue(dashboard_push.is_debounced(marker, window=90))

    def test_not_debounced_when_stale(self):
        with tempfile.TemporaryDirectory() as d:
            marker = os.path.join(d, 'last-push')
            with open(marker, 'w') as f:
                f.write(str(time.time() - 200))
            self.assertFalse(dashboard_push.is_debounced(marker, window=90))

    def test_not_debounced_when_missing(self):
        self.assertFalse(dashboard_push.is_debounced('/nonexistent/marker', window=90))
```

- [ ] **Step 2: Run test — verify it fails**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: FAIL — `today_jsonl_files` / `all_jsonl_files` / `is_debounced` undefined.

- [ ] **Step 3: Write the implementation**

Add to `scripts/dashboard-push.py`:

```python
def today_jsonl_files(projects_dir):
    """JSONL files modified since local midnight."""
    midnight = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
    cutoff = midnight.timestamp()
    out = []
    for path in glob.glob(os.path.join(projects_dir, '*', '*.jsonl')):
        try:
            if os.path.getmtime(path) >= cutoff:
                out.append(path)
        except OSError:
            continue
    return out


def all_jsonl_files(projects_dir):
    return glob.glob(os.path.join(projects_dir, '*', '*.jsonl'))


def is_debounced(marker_path, window):
    """True if the last push was less than `window` seconds ago."""
    try:
        with open(marker_path) as f:
            last = float(f.read().strip())
    except (OSError, ValueError):
        return False
    return (time.time() - last) < window


def git_author_email():
    try:
        out = subprocess.run(['git', 'config', 'user.email'],
                             capture_output=True, text=True, timeout=5)
        return out.stdout.strip() or 'unknown@local'
    except (subprocess.SubprocessError, OSError):
        return 'unknown@local'


def main():
    backfill = '--backfill' in sys.argv

    url = os.environ.get('CC_DASHBOARD_URL')
    secret = os.environ.get('CC_DASHBOARD_HMAC_SECRET')
    handle = os.environ.get('CC_DASHBOARD_HANDLE')
    if not url or not secret or not handle:
        print('dashboard-push: missing CC_DASHBOARD_URL / CC_DASHBOARD_HMAC_SECRET / '
              'CC_DASHBOARD_HANDLE — skipping', file=sys.stderr)
        return 0

    if not backfill and is_debounced(LAST_PUSH_FILE, DEBOUNCE_SECONDS):
        return 0  # pushed recently — skip silently

    machine = socket.gethostname().split('.')[0]
    claude_dir = os.path.join(HOME, 'Claude')
    author_email = git_author_email()

    if backfill:
        # one row per date present across all sessions
        all_files = all_jsonl_files(PROJECTS_DIR)
        dates = set()
        for path in all_files:
            try:
                with open(path) as f:
                    for line in f:
                        try:
                            ts = json.loads(line).get('timestamp')
                        except json.JSONDecodeError:
                            continue
                        if ts:
                            dates.add(ts[:10])
            except OSError:
                continue
        for target_date in sorted(dates):
            day = parse_day(all_files, target_date, HOME)
            if day['tokens_total'] == 0:
                continue
            ships = count_ships(claude_dir, target_date, author_email)
            payload = build_payload(day, ships, handle, machine, target_date)
            status, text = post_payload(url, payload, secret)
            print(f'  {target_date}: {status} {text[:80]}')
        return 0

    # default: today only, incremental
    target_date = datetime.now().strftime('%Y-%m-%d')
    files = today_jsonl_files(PROJECTS_DIR)
    day = parse_day(files, target_date, HOME)
    ships = count_ships(claude_dir, target_date, author_email)
    payload = build_payload(day, ships, handle, machine, target_date)
    status, text = post_payload(url, payload, secret)

    if status == 200:
        with open(LAST_PUSH_FILE, 'w') as f:
            f.write(str(time.time()))
    else:
        print(f'dashboard-push: ingest returned {status}: {text[:200]}', file=sys.stderr)
    return 0 if status == 200 else 1


if __name__ == '__main__':
    sys.exit(main())
```

- [ ] **Step 4: Run test — verify it passes**

Run: `python3 tests/python/test_dashboard_push.py`
Expected: PASS — all classes.

- [ ] **Step 5: Commit**

```sh
git add scripts/dashboard-push.py tests/python/test_dashboard_push.py
git commit -m "feat(push): CLI — default/backfill modes, debounce, file selection"
```

---

## Phase 3 — Stop hook installation

### Task 3.1: `install-hook.sh` — idempotent Stop hook installer

**Files:** `scripts/install-hook.sh`

The hook must be added to `~/.claude/settings.json` **without destroying** the existing `SessionStart` / `UserPromptSubmit` hooks. The installer uses `python3` to do a safe JSON merge.

- [ ] **Step 1: Write the failing test**

There's no unit-test harness for a shell installer; the test is a manual dry-run on a copy. Create `tests/python/test_install_hook.py`:

```python
import json
import os
import subprocess
import tempfile
import unittest


class TestInstallHook(unittest.TestCase):
    SCRIPT = os.path.join(os.path.dirname(__file__), '..', '..', 'scripts', 'install-hook.sh')

    def test_adds_stop_hook_preserving_existing(self):
        with tempfile.TemporaryDirectory() as d:
            settings = os.path.join(d, 'settings.json')
            with open(settings, 'w') as f:
                json.dump({
                    'hooks': {
                        'SessionStart': [{'hooks': [{'type': 'command', 'command': 'echo hi'}]}],
                    },
                    'theme': 'dark',
                }, f)
            subprocess.run(['bash', self.SCRIPT, settings, '/tmp/fake-push.py'], check=True)
            with open(settings) as f:
                result = json.load(f)
            # existing hooks + top-level keys preserved
            self.assertIn('SessionStart', result['hooks'])
            self.assertEqual(result['theme'], 'dark')
            # Stop hook added, pointing at the script
            stop = result['hooks']['Stop']
            self.assertEqual(len(stop), 1)
            cmd = stop[0]['hooks'][0]['command']
            self.assertIn('/tmp/fake-push.py', cmd)

    def test_idempotent_second_run_does_not_duplicate(self):
        with tempfile.TemporaryDirectory() as d:
            settings = os.path.join(d, 'settings.json')
            with open(settings, 'w') as f:
                json.dump({'hooks': {}}, f)
            subprocess.run(['bash', self.SCRIPT, settings, '/tmp/fake-push.py'], check=True)
            subprocess.run(['bash', self.SCRIPT, settings, '/tmp/fake-push.py'], check=True)
            with open(settings) as f:
                result = json.load(f)
            self.assertEqual(len(result['hooks']['Stop']), 1)


if __name__ == '__main__':
    unittest.main()
```

- [ ] **Step 2: Run test — verify it fails**

Run: `python3 tests/python/test_install_hook.py`
Expected: FAIL — `scripts/install-hook.sh` does not exist.

- [ ] **Step 3: Write the implementation**

`scripts/install-hook.sh`:

```bash
#!/usr/bin/env bash
# install-hook.sh — idempotently add the cc-dashboard Stop hook to a Claude settings.json.
# Usage: install-hook.sh <settings.json path> <absolute path to dashboard-push.py>
set -euo pipefail

SETTINGS="${1:?settings.json path required}"
PUSH_SCRIPT="${2:?dashboard-push.py path required}"

if [ ! -f "$SETTINGS" ]; then
  echo '{}' > "$SETTINGS"
fi

python3 - "$SETTINGS" "$PUSH_SCRIPT" <<'PY'
import json, sys

settings_path, push_script = sys.argv[1], sys.argv[2]
with open(settings_path) as f:
    cfg = json.load(f)

cfg.setdefault('hooks', {})
# Background the push so it never adds latency to a CC turn.
command = f'nohup python3 {push_script} >/dev/null 2>&1 &'

stop_hooks = cfg['hooks'].get('Stop', [])
# Idempotency: drop any prior cc-dashboard Stop entry before re-adding.
stop_hooks = [
    group for group in stop_hooks
    if not any('dashboard-push.py' in h.get('command', '')
               for h in group.get('hooks', []))
]
stop_hooks.append({'hooks': [{'type': 'command', 'command': command}]})
cfg['hooks']['Stop'] = stop_hooks

with open(settings_path, 'w') as f:
    json.dump(cfg, f, indent=2)
    f.write('\n')
print(f'Stop hook installed -> {push_script}')
PY
```

Make it executable: `chmod +x scripts/install-hook.sh scripts/dashboard-push.py`

- [ ] **Step 4: Run test — verify it passes**

Run: `python3 tests/python/test_install_hook.py`
Expected: PASS — both cases.

- [ ] **Step 5: Commit**

```sh
git add scripts/install-hook.sh tests/python/test_install_hook.py
chmod +x scripts/install-hook.sh scripts/dashboard-push.py
git update-index --chmod=+x scripts/install-hook.sh scripts/dashboard-push.py
git commit -m "feat(push): idempotent Stop-hook installer"
```

---

### Task 3.2: Manual — install the hook + env on Holden's Mac

> **Manual step.** No code. Holden runs this on each Mac (iMac + MacBook-Air). Write the steps into the report; do NOT attempt to edit Holden's real `~/.claude/settings.json` from a test or subagent.

The implementer dispatched for this plan should STOP at this task and surface the checklist to the controller, who relays to Holden:

1. Add three env vars to the shell profile (`~/.zshrc`) on **each** Mac:
   ```sh
   export CC_DASHBOARD_URL="https://cc-dashboard-qab.pages.dev"
   export CC_DASHBOARD_HANDLE="holden-alt"
   export CC_DASHBOARD_HMAC_SECRET="<the INGEST_HMAC_SECRET value from CF Pages env vars>"
   ```
   The `CC_DASHBOARD_HMAC_SECRET` value must exactly equal the `INGEST_HMAC_SECRET` set on the Cloudflare Pages project. Retrieve it from the CF dashboard → cc-dashboard → Settings → Environment variables (it's a secret, so it may need to be re-revealed or rotated — if rotated, update both places).

2. Install the Stop hook on **each** Mac:
   ```sh
   bash ~/Claude/holden-alt/cc-dashboard/scripts/install-hook.sh \
     ~/.claude/settings.json \
     ~/Claude/holden-alt/cc-dashboard/scripts/dashboard-push.py
   ```

3. Verify the hook entry landed: `python3 -c "import json; print(json.load(open('$HOME/.claude/settings.json'))['hooks']['Stop'])"`

4. Restart Claude Code (or start a new session) so the new hook is picked up.

---

## Phase 4 — Realtime + wire the UI to real data

### Task 4.1: Enable Realtime on `daily_stats`

**Files:** `supabase/migrations/20260514000003_realtime.sql`

- [ ] **Step 1: Write the migration**

`supabase/migrations/20260514000003_realtime.sql`:

```sql
-- 20260514000003_realtime.sql
-- Add daily_stats to the realtime publication so the profile page gets live updates.
alter publication supabase_realtime add table public.daily_stats;
```

- [ ] **Step 2: Apply it to the live project**

```sh
curl -s -X POST "https://api.supabase.com/v1/projects/zhumaztwplxrzsdsabtp/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: cc-dashboard-setup/1.0" \
  --data-raw "$(jq -Rs '{query: .}' < supabase/migrations/20260514000003_realtime.sql)"
```

Expected: `[]`, HTTP 201. (If it errors "table is already member of publication", that's fine — treat as success.)

- [ ] **Step 3: Verify**

```sh
curl -s -X POST "https://api.supabase.com/v1/projects/zhumaztwplxrzsdsabtp/database/query" \
  -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -H "User-Agent: cc-dashboard-setup/1.0" \
  --data-raw '{"query":"select tablename from pg_publication_tables where pubname = '"'"'supabase_realtime'"'"'"}'
```

Expected: the result includes `daily_stats`.

- [ ] **Step 4: Commit**

```sh
git add supabase/migrations/20260514000003_realtime.sql
git commit -m "feat(realtime): add daily_stats to realtime publication"
```

- [ ] **Step 5: (no test — DB config change; covered by the E2E in Task 5.2)**

---

### Task 4.2: `profile-data.ts` — server fetch of a user's stats

**Files:** `lib/stats/profile-data.ts`, `tests/stats/profile-data.test.ts`

- [ ] **Step 1: Write the failing test**

`tests/stats/profile-data.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { getProfileData } from '@/lib/stats/profile-data';

function mockSupabase(userRow: unknown, statsRows: unknown[]) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: vi.fn(async () => ({ data: userRow, error: null })) }) }),
        };
      }
      // daily_stats
      return {
        select: () => ({
          eq: () => ({
            order: () => ({
              limit: vi.fn(async () => ({ data: statsRows, error: null })),
            }),
          }),
        }),
      };
    }),
  };
}

describe('getProfileData', () => {
  it('returns null when the user does not exist', async () => {
    const supabase = mockSupabase(null, []);
    const result = await getProfileData(supabase as never, 'ghost');
    expect(result).toBeNull();
  });

  it('returns the user and their daily_stats rows', async () => {
    const user = { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
      avatar_url: null, primary_persona: null, secondary_personas: [] };
    const stats = [
      { date: '2026-05-14', tokens_total: 487231, tokens_by_model: { 'claude-opus-4-7': 487231 },
        sessions: 6, deep_work_minutes: 240, machines: ['iMac'],
        projects_touched: {}, ships: { commits: 12, repos: 3 }, source_synced_at: null },
    ];
    const supabase = mockSupabase(user, stats);
    const result = await getProfileData(supabase as never, 'holden-alt');
    expect(result).not.toBeNull();
    expect(result?.user.github_handle).toBe('holden-alt');
    expect(result?.dailyStats).toHaveLength(1);
    expect(result?.dailyStats[0]?.tokens_total).toBe(487231);
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/stats/profile-data.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Write the implementation**

`lib/stats/profile-data.ts`:

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export type ProfileUser = {
  id: string;
  github_handle: string;
  display_name: string | null;
  avatar_url: string | null;
  primary_persona: string | null;
  secondary_personas: string[];
};

export type DailyStat = Database['public']['Tables']['daily_stats']['Row'];

export type ProfileData = {
  user: ProfileUser;
  dailyStats: DailyStat[];
};

const HISTORY_DAYS = 366;

export async function getProfileData(
  supabase: SupabaseClient<Database>,
  handle: string,
): Promise<ProfileData | null> {
  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name, avatar_url, primary_persona, secondary_personas')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) return null;

  const { data: dailyStats } = await supabase
    .from('daily_stats')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: false })
    .limit(HISTORY_DAYS);

  return {
    user,
    dailyStats: dailyStats ?? [],
  };
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test tests/stats/profile-data.test.ts && pnpm typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add lib/stats/profile-data.ts tests/stats/profile-data.test.ts
git commit -m "feat(stats): server-side profile data fetch"
```

---

### Task 4.3: `ProfileLive` client component — Realtime subscription

**Files:** `components/ProfileLive.tsx`, `tests/components/ProfileLive.test.tsx`

- [ ] **Step 1: Write the failing test**

`tests/components/ProfileLive.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { ProfileLive } from '@/components/ProfileLive';
import type { ProfileData } from '@/lib/stats/profile-data';

// Capture the realtime callback so the test can fire a fake update.
let realtimeCallback: ((payload: unknown) => void) | null = null;
const channelMock = {
  on: vi.fn((_evt: string, _filter: unknown, cb: (p: unknown) => void) => {
    realtimeCallback = cb;
    return channelMock;
  }),
  subscribe: vi.fn(() => channelMock),
};
vi.mock('@/lib/supabase/browser', () => ({
  createClient: vi.fn(() => ({
    channel: vi.fn(() => channelMock),
    removeChannel: vi.fn(),
  })),
}));

const baseData: ProfileData = {
  user: {
    id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
    avatar_url: null, primary_persona: null, secondary_personas: [],
  },
  dailyStats: [
    {
      date: '2026-05-14', user_id: 'u1', tokens_total: 100000,
      tokens_by_model: { 'claude-opus-4-7': 100000 }, sessions: 2,
      deep_work_minutes: 60, machines: ['iMac'], projects_touched: {},
      ships: { commits: 1, repos: 1 }, source_synced_at: null,
    },
  ],
};

beforeEach(() => {
  realtimeCallback = null;
  vi.clearAllMocks();
});

describe('ProfileLive', () => {
  it('renders the StatusBar with the initial token total', () => {
    render(<ProfileLive initialData={baseData} today="2026-05-14" />);
    // 100000 -> "100K tokens"
    expect(screen.getByText(/100K tokens/)).toBeInTheDocument();
  });

  it('updates the token total when a realtime event for today arrives', () => {
    render(<ProfileLive initialData={baseData} today="2026-05-14" />);
    expect(realtimeCallback).not.toBeNull();
    act(() => {
      realtimeCallback!({
        new: {
          date: '2026-05-14', user_id: 'u1', tokens_total: 487000,
          tokens_by_model: { 'claude-opus-4-7': 487000 }, sessions: 6,
          deep_work_minutes: 240, machines: ['iMac'], projects_touched: {},
          ships: { commits: 12, repos: 3 }, source_synced_at: null,
        },
      });
    });
    expect(screen.getByText(/487K tokens/)).toBeInTheDocument();
  });

  it('ignores realtime events for other dates', () => {
    render(<ProfileLive initialData={baseData} today="2026-05-14" />);
    act(() => {
      realtimeCallback!({
        new: { date: '2026-05-13', user_id: 'u1', tokens_total: 999999,
          tokens_by_model: {}, sessions: 0, deep_work_minutes: 0, machines: [],
          projects_touched: {}, ships: { commits: 0, repos: 0 }, source_synced_at: null },
      });
    });
    expect(screen.getByText(/100K tokens/)).toBeInTheDocument();
    expect(screen.queryByText(/999/)).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/components/ProfileLive.test.tsx`
Expected: FAIL — component not found.

- [ ] **Step 3: Write the implementation**

`components/ProfileLive.tsx`:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/browser';
import { StatusBar } from '@/components/StatusBar';
import { BuildsPane } from '@/components/BuildsPane';
import { ActivityPane } from '@/components/ActivityPane';
import { PersonaPane } from '@/components/PersonaPane';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';

type ProfileLiveProps = {
  initialData: ProfileData;
  today: string; // YYYY-MM-DD, computed server-side for hydration stability
};

export function ProfileLive({ initialData, today }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user } = initialData;

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`daily_stats:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'daily_stats', filter: `user_id=eq.${user.id}` },
        (payload: { new?: DailyStat }) => {
          const row = payload.new;
          if (!row) return;
          setDailyStats((prev) => {
            const without = prev.filter((r) => r.date !== row.date);
            return [row, ...without].sort((a, b) => (a.date < b.date ? 1 : -1));
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const todayStat = useMemo(
    () => dailyStats.find((r) => r.date === today) ?? null,
    [dailyStats, today],
  );

  const tokensToday = todayStat?.tokens_total ?? 0;
  const sessionsToday = todayStat?.sessions ?? 0;
  const machinesToday = todayStat?.machines ?? [];
  const deepWorkToday = todayStat?.deep_work_minutes ?? 0;
  const tokensByModel = (todayStat?.tokens_by_model ?? {}) as Record<string, number>;
  const projectsToday = (todayStat?.projects_touched ?? {}) as Record<string, number>;

  const streakDays = computeStreak(dailyStats, today);

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1400px] mx-auto">
      <StatusBar
        handle={user.github_handle}
        primaryPersona={user.primary_persona ?? null}
        streakDays={streakDays}
        tokensToday={tokensToday}
      />
      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.2fr] gap-3 mt-4">
        <BuildsPane projects={projectsToday} />
        <ActivityPane
          tokensToday={tokensToday}
          sessionsToday={sessionsToday}
          machinesCount={machinesToday.length}
          deepWorkMinutes={deepWorkToday}
          tokensByModel={tokensByModel}
          dailyStats={dailyStats}
          today={today}
        />
        <PersonaPane
          primary={user.primary_persona ?? null}
          secondary={user.secondary_personas ?? []}
        />
      </section>
    </main>
  );
}

function computeStreak(stats: DailyStat[], today: string): number {
  const active = new Set(stats.filter((s) => s.tokens_total > 0).map((s) => s.date));
  let streak = 0;
  const cursor = new Date(today + 'T00:00:00Z');
  // Walk backwards day by day while the date is active.
  // Today not yet active still allows the streak to count from yesterday.
  if (!active.has(today)) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  while (active.has(cursor.toISOString().slice(0, 10))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }
  return streak;
}
```

> Note: `BuildsPane` and `ActivityPane` are modified to accept these props in Tasks 4.4 and 4.5. This component won't typecheck until those land — write it now, expect the typecheck failure, and let 4.4/4.5 resolve it. (Same staged pattern as Plan 1's Task 3.2.)

- [ ] **Step 4: Run test — expect it to still fail on prop mismatch**

Run: `pnpm test tests/components/ProfileLive.test.tsx`
Expected: FAIL — `BuildsPane`/`ActivityPane` don't accept these props yet. That's expected; Tasks 4.4/4.5 fix it. Do not fix here.

- [ ] **Step 5: Commit**

```sh
git add components/ProfileLive.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat(realtime): ProfileLive client component (panes updated next)"
```

---

### Task 4.4: `ActivityPane` accepts real props

**Files:** `components/ActivityPane.tsx` (MODIFY), `tests/components/ActivityPane.test.tsx` (MODIFY)

- [ ] **Step 1: Update the test**

Replace `tests/components/ActivityPane.test.tsx` with prop-driven assertions:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityPane } from '@/components/ActivityPane';
import type { DailyStat } from '@/lib/stats/profile-data';

const stats: DailyStat[] = [
  {
    date: '2026-05-14', user_id: 'u1', tokens_total: 487231,
    tokens_by_model: { 'claude-opus-4-7': 480000, 'claude-sonnet-4-6': 7231 },
    sessions: 6, deep_work_minutes: 240, machines: ['iMac', 'MacBook-Air'],
    projects_touched: {}, ships: { commits: 1, repos: 1 }, source_synced_at: null,
  },
];

const baseProps = {
  tokensToday: 487231,
  sessionsToday: 6,
  machinesCount: 2,
  deepWorkMinutes: 240,
  tokensByModel: { 'claude-opus-4-7': 480000, 'claude-sonnet-4-6': 7231 },
  dailyStats: stats,
  today: '2026-05-14',
};

describe('ActivityPane', () => {
  it('renders the real token total', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByText('487K')).toBeInTheDocument();
  });
  it('renders the machines count', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByText('2')).toBeInTheDocument();
  });
  it('renders the model stack legend', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByText(/opus/i)).toBeInTheDocument();
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
  });
  it('embeds the heatmap', () => {
    render(<ActivityPane {...baseProps} />);
    expect(screen.getByRole('img', { name: /52-week activity heatmap/i })).toBeInTheDocument();
  });
  it('renders 0 gracefully when there is no data today', () => {
    render(<ActivityPane {...baseProps} tokensToday={0} sessionsToday={0} machinesCount={0}
      deepWorkMinutes={0} tokensByModel={{}} dailyStats={[]} />);
    expect(screen.getByText('0')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/components/ActivityPane.test.tsx`
Expected: FAIL — `ActivityPane` takes no props yet.

- [ ] **Step 3: Rewrite `components/ActivityPane.tsx`**

```tsx
import { Heatmap } from '@/components/Heatmap';
import type { DailyStat } from '@/lib/stats/profile-data';

type ActivityPaneProps = {
  tokensToday: number;
  sessionsToday: number;
  machinesCount: number;
  deepWorkMinutes: number;
  tokensByModel: Record<string, number>;
  dailyStats: DailyStat[];
  today: string;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

function modelPct(tokensByModel: Record<string, number>): { opus: number; sonnet: number; haiku: number } {
  const total = Object.values(tokensByModel).reduce((s, n) => s + n, 0) || 1;
  let opus = 0, sonnet = 0, haiku = 0;
  for (const [model, n] of Object.entries(tokensByModel)) {
    if (model.includes('opus')) opus += n;
    else if (model.includes('sonnet')) sonnet += n;
    else if (model.includes('haiku')) haiku += n;
  }
  return {
    opus: Math.round((opus / total) * 100),
    sonnet: Math.round((sonnet / total) * 100),
    haiku: Math.round((haiku / total) * 100),
  };
}

export function ActivityPane({
  tokensToday,
  sessionsToday,
  machinesCount,
  deepWorkMinutes,
  tokensByModel,
  dailyStats,
  today,
}: ActivityPaneProps) {
  const pct = modelPct(tokensByModel);
  const heatmapDays = dailyStats.map((s) => ({ date: s.date, tokens: s.tokens_total }));

  const stats = [
    { n: formatTokens(tokensToday), l: 'tokens today', color: 'var(--color-orange)' },
    { n: String(sessionsToday), l: 'sessions', color: 'var(--color-green)' },
    { n: `${Math.round(deepWorkMinutes / 60)}h`, l: 'deep work', color: 'var(--color-yellow)' },
    { n: String(machinesCount), l: 'machines', color: 'var(--color-cyan)' },
  ];

  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-orange)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-orange)' }}>
        · activity
      </h4>

      <div className="flex gap-4 my-1.5">
        {stats.map((s) => (
          <div key={s.l} className="flex flex-col">
            <span className="text-[1.1rem] font-semibold leading-none" style={{ color: s.color }}>
              {s.n}
            </span>
            <span className="text-[0.58rem] uppercase tracking-[0.08em]" style={{ color: 'var(--color-dim)' }}>
              {s.l}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex h-[18px] rounded-[3px] overflow-hidden">
        <div style={{ background: 'var(--color-orange)', width: `${pct.opus}%` }} />
        <div style={{ background: 'var(--color-cyan)', width: `${pct.sonnet}%` }} />
        <div style={{ background: 'var(--color-green)', width: `${pct.haiku}%` }} />
      </div>
      <div className="flex gap-3 text-[0.6rem] mt-1" style={{ color: 'var(--color-dim)' }}>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-orange)' }} />
          opus {pct.opus}%
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-cyan)' }} />
          sonnet {pct.sonnet}%
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-green)' }} />
          haiku {pct.haiku}%
        </span>
      </div>

      <div className="mt-2.5">
        <div className="text-[0.55rem] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-dim)' }}>
          52w activity
        </div>
        <Heatmap days={heatmapDays} today={new Date(today + 'T00:00:00Z')} />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test tests/components/ActivityPane.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```sh
git add components/ActivityPane.tsx tests/components/ActivityPane.test.tsx
git commit -m "feat(ui): ActivityPane renders real stats props"
```

---

### Task 4.5: `BuildsPane` accepts real projects + `StatusBar` cleanup

**Files:** `components/BuildsPane.tsx` (MODIFY), `tests/components/BuildsPane.test.tsx` (MODIFY)

- [ ] **Step 1: Update the test**

Replace `tests/components/BuildsPane.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuildsPane } from '@/components/BuildsPane';

describe('BuildsPane', () => {
  it('renders the "· builds" header', () => {
    render(<BuildsPane projects={{}} />);
    expect(screen.getByText(/· builds/i)).toBeInTheDocument();
  });
  it('renders a row per project, sorted by tokens descending', () => {
    render(<BuildsPane projects={{
      'realsavvy/agnt-portal': 50000,
      'holden-alt/cc-dashboard': 300000,
      'holdengr': 10000,
    }} />);
    const rows = screen.getAllByTestId('build-row');
    expect(rows).toHaveLength(3);
    // first row is the highest-token project
    expect(rows[0]).toHaveTextContent('holden-alt/cc-dashboard');
  });
  it('shows an empty hint when there are no projects today', () => {
    render(<BuildsPane projects={{}} />);
    expect(screen.getByText(/no builds yet today/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/components/BuildsPane.test.tsx`
Expected: FAIL — `BuildsPane` takes no props.

- [ ] **Step 3: Rewrite `components/BuildsPane.tsx`**

```tsx
type BuildsPaneProps = {
  projects: Record<string, number>;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

export function BuildsPane({ projects }: BuildsPaneProps) {
  const sorted = Object.entries(projects).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-cyan)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-cyan)' }}>
        · builds
      </h4>
      {sorted.length === 0 ? (
        <div className="text-[0.6rem]" style={{ color: 'var(--color-dim)' }}>
          no builds yet today — start a session
        </div>
      ) : (
        sorted.map(([name, tokens]) => (
          <div key={name} data-testid="build-row" className="flex items-center gap-2 py-0.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-orange)' }} />
            <span className="text-[0.7rem]">{name}</span>
            <span className="text-[0.6rem] ml-auto" style={{ color: 'var(--color-dim)' }}>
              {formatTokens(tokens)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test tests/components/BuildsPane.test.tsx && pnpm typecheck`
Expected: PASS, and `ProfileLive` now typechecks (its prop usage matches).

- [ ] **Step 5: Commit**

```sh
git add components/BuildsPane.tsx tests/components/BuildsPane.test.tsx
git commit -m "feat(ui): BuildsPane renders real projects-touched data"
```

---

### Task 4.6: Wire `/[handle]` page to `ProfileLive`

**Files:** `app/[handle]/page.tsx` (MODIFY), `tests/routes/profile-page.test.tsx` (MODIFY)

- [ ] **Step 1: Update the test**

Replace `tests/routes/profile-page.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

const getProfileDataMock = vi.fn();
vi.mock('@/lib/stats/profile-data', () => ({
  getProfileData: (...args: unknown[]) => getProfileDataMock(...args),
}));
vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));

describe('GET /[handle]', () => {
  it('renders ProfileLive when the user exists', async () => {
    getProfileDataMock.mockResolvedValueOnce({
      user: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden',
        avatar_url: null, primary_persona: null, secondary_personas: [] },
      dailyStats: [],
    });
    const { default: Page } = await import('../../app/[handle]/page');
    const ui = await Page({ params: Promise.resolve({ handle: 'holden-alt' }) });
    render(ui as React.ReactElement);
    expect(screen.getByText(/\$ holden-alt/)).toBeInTheDocument();
  });

  it('calls notFound when the user is missing', async () => {
    getProfileDataMock.mockResolvedValueOnce(null);
    const { default: Page } = await import('../../app/[handle]/page');
    await expect(Page({ params: Promise.resolve({ handle: 'ghost' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `pnpm test tests/routes/profile-page.test.tsx`
Expected: FAIL — the page still renders the old static panes directly.

- [ ] **Step 3: Rewrite `app/[handle]/page.tsx`**

```tsx
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfileData } from '@/lib/stats/profile-data';
import { ProfileLive } from '@/components/ProfileLive';

export const runtime = 'edge';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const data = await getProfileData(supabase, handle);
  if (!data) {
    notFound();
  }

  // Server-compute "today" so SSR and client hydration agree.
  const today = new Date().toISOString().slice(0, 10);

  return <ProfileLive initialData={data} today={today} />;
}
```

- [ ] **Step 4: Run test — verify it passes**

Run: `pnpm test && pnpm typecheck`
Expected: full suite PASS, typecheck clean. (This is the integration moment — `ProfileLive`, `ActivityPane`, `BuildsPane` all line up now.)

- [ ] **Step 5: Commit**

```sh
git add app/[handle]/page.tsx tests/routes/profile-page.test.tsx
git commit -m "feat(profile): wire /[handle] to ProfileLive with real data"
```

---

## Phase 5 — Deploy, backfill, verify

### Task 5.1: Deploy + smoke the build

**Files:** none (deploy operation)

- [ ] **Step 1: Push and trigger deploy**

```sh
git push
curl -s -X POST "https://api.cloudflare.com/client/v4/accounts/aa799e6f6a410deff0b83c4d5e0823f6/pages/projects/cc-dashboard/deployments" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN"
```

- [ ] **Step 2: Poll the deployment to success**

Poll `GET /accounts/{acct}/pages/projects/cc-dashboard/deployments/{id}` until `latest_stage` is `deploy/success` (same polling pattern used in Plan 1's deploy).

- [ ] **Step 3: Smoke the ingest route is reachable**

```sh
# Unsigned request must be rejected 401 — proves the route is live and HMAC-gated.
curl -s -o /dev/null -w "%{http_code}\n" -X POST https://cc-dashboard-qab.pages.dev/api/ingest \
  -H 'content-type: application/json' -d '{}'
```

Expected: `401`.

- [ ] **Step 4: (no commit — deploy only)**

- [ ] **Step 5: Note the deployment short-id in the report**

---

### Task 5.2: Backfill + live verification (manual, Holden)

> **Manual step.** Holden runs the backfill from one Mac after Task 3.2's env vars + hook are installed.

The implementer should STOP and surface this checklist:

1. Confirm env vars are exported in the current shell:
   ```sh
   echo "$CC_DASHBOARD_URL / $CC_DASHBOARD_HANDLE / ${CC_DASHBOARD_HMAC_SECRET:0:6}..."
   ```
2. Run the one-time backfill:
   ```sh
   python3 ~/Claude/holden-alt/cc-dashboard/scripts/dashboard-push.py --backfill
   ```
   Expect one `YYYY-MM-DD: 200 {"ok":true}` line per active day.
3. Open `https://cc-dashboard-qab.pages.dev/holden-alt` — the heatmap should now show real history, today's token count should be populated, BuildsPane should list real projects.
4. Leave the profile page open in a browser. Start a Claude Code session on the Mac, do one turn, and wait ~10 seconds. The Stop hook fires `dashboard-push.py`, which POSTs today's updated total. The open page should update the token counter **without a refresh** (Supabase Realtime).
5. If the live update doesn't appear:
   - Check `daily_stats` is in the realtime publication (Task 4.1 Step 3 query).
   - Check the browser console for a Supabase channel subscription error.
   - Check `~/.claude/.cc-dashboard-last-push` exists and is recent (proves the hook ran).
   - Manually run `python3 .../dashboard-push.py` and watch for a non-200.

- [ ] **Step (single manual gate):** report back the result of steps 3 + 4 — does real history render, and does the live update land.

---

## End-of-plan checklist

- [ ] `pnpm test` passes (all Vitest suites)
- [ ] `python3 tests/python/test_dashboard_push.py` passes
- [ ] `python3 tests/python/test_install_hook.py` passes
- [ ] `pnpm typecheck` clean
- [ ] `pnpm pages:build` succeeds
- [ ] Deployed: `/api/ingest` returns 401 for unsigned requests
- [ ] Backfill loaded real history into `daily_stats`
- [ ] Opening `/holden-alt` shows real tokens + heatmap + projects
- [ ] A live CC turn updates the open profile page without a refresh

## What this plan does NOT cover (next plans)

- 30-day trend chart, model donut, time-of-day histogram, day-of-week, stacked area — **Plan 3**
- Leaderboard with filters + group bar comparison + head-to-head — **Plan 4**
- Stats explorer tabbed view — **Plan 4**
- Badge engine + persona inference — **Plan 5**
- Skills / Notes / Goals sections — **Plan 6**
- SSR/OG/AEO polish + custom domain `vibecodestats.dev` — **Plan 7**
