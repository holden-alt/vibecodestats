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
  hourly_tokens: Record<string, number>;
};

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');
  const signatureHeader = request.headers.get('x-cc-signature');

  // Must have at least one auth method present
  const hasBearerToken = authHeader?.startsWith('Bearer ');
  const hasHmacSignature = !!signatureHeader;

  if (!hasBearerToken && !hasHmacSignature) {
    return Response.json({ error: 'missing auth' }, { status: 401 });
  }

  const rawBody = await request.text();

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  let authenticatedUserId: string;

  if (hasBearerToken) {
    // --- Token path (preferred) ---
    const token = authHeader!.slice('Bearer '.length).trim();

    const { data: tokenUser, error: tokenError } = await supabase
      .from('users')
      .select('id')
      .eq('ingest_token', token)
      .maybeSingle();

    if (tokenError) {
      return Response.json({ error: 'user lookup failed' }, { status: 500 });
    }
    if (!tokenUser) {
      return Response.json({ error: 'invalid token' }, { status: 401 });
    }

    authenticatedUserId = tokenUser.id;
  } else {
    // --- HMAC fallback (legacy, transitional) ---
    const secret = process.env.INGEST_HMAC_SECRET;
    if (!secret) {
      return Response.json({ error: 'server misconfigured' }, { status: 500 });
    }

    if (!(await verifyPayload(rawBody, signatureHeader!, secret))) {
      return Response.json({ error: 'invalid signature' }, { status: 401 });
    }

    // Parse payload early enough to do the github_handle lookup
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      return Response.json({ error: 'invalid json' }, { status: 400 });
    }

    const preValidation = validateIngestPayload(parsed);
    if (!preValidation.ok) {
      return Response.json({ error: preValidation.error }, { status: 400 });
    }

    const { data: handleUser, error: handleError } = await supabase
      .from('users')
      .select('id')
      .eq('github_handle', preValidation.value.github_handle)
      .maybeSingle();

    if (handleError) {
      return Response.json({ error: 'user lookup failed' }, { status: 500 });
    }
    if (!handleUser) {
      return Response.json({ error: 'unknown github_handle' }, { status: 404 });
    }

    authenticatedUserId = handleUser.id;
  }

  // Parse and validate the payload (may have already been parsed in HMAC branch, but
  // we re-parse for the token branch; JSON.parse on the same string is cheap and safe).
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

  // 1. Replace this machine's sub-total for the day (repeated pushes just overwrite).
  const { error: machineUpsertError } = await supabase.from('machine_daily_stats').upsert(
    {
      user_id: authenticatedUserId,
      date: payload.date,
      machine: payload.machine,
      tokens_total: payload.tokens_total,
      tokens_by_model: payload.tokens_by_model,
      sessions: payload.sessions,
      deep_work_minutes: payload.deep_work_minutes,
      projects_touched: payload.projects_touched,
      ships: payload.ships,
      hourly_tokens: payload.hourly_tokens,
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
    .select('machine, tokens_total, tokens_by_model, sessions, deep_work_minutes, projects_touched, ships, hourly_tokens')
    .eq('user_id', authenticatedUserId)
    .eq('date', payload.date);
  if (rollupSelectError || !machineRows) {
    return Response.json({ error: 'rollup select failed' }, { status: 500 });
  }
  const rows = machineRows as MachineRow[];

  // 3. Roll up across machines and upsert daily_stats.
  const rollup = {
    user_id: authenticatedUserId,
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
    hourly_tokens: rows.reduce<Record<string, number>>(
      (acc, r) => mergeNumberRecords(acc, r.hourly_tokens),
      {},
    ),
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
