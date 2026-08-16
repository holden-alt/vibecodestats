import { createServiceClient } from '@/lib/db/server';
import { validateIngestPayload } from '@/lib/ingest/payload';
import { regenerateOgImage } from '@/lib/og/regenerate';
import { logIngestEvent } from '@/lib/ingest/events';


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
  const userAgent = request.headers.get('user-agent');

  if (!authHeader?.startsWith('Bearer ')) {
    await logIngestEvent({ outcome: 'missing_auth', userAgent });
    return Response.json({ error: 'missing auth' }, { status: 401 });
  }

  const rawBody = await request.text();

  const database = await createServiceClient();

  // --- Token auth (only supported path) ---
  const token = authHeader.slice('Bearer '.length).trim();

  const { data: tokenUser, error: tokenError } = await database
    .from('users')
    .select('id, github_handle')
    .eq('ingest_token', token)
    .maybeSingle();

  if (tokenError) {
    await logIngestEvent({ outcome: 'error', detail: 'user lookup failed', userAgent });
    return Response.json({ error: 'user lookup failed' }, { status: 500 });
  }
  if (!tokenUser) {
    await logIngestEvent({ outcome: 'invalid_token', userAgent });
    return Response.json({ error: 'invalid token' }, { status: 401 });
  }

  const authenticatedUserId = tokenUser.id;
  const authenticatedHandle = tokenUser.github_handle;

  // Parse and validate the payload.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    await logIngestEvent({
      outcome: 'bad_payload',
      userId: authenticatedUserId,
      githubHandle: authenticatedHandle,
      detail: 'invalid json',
      userAgent,
    });
    return Response.json({ error: 'invalid json' }, { status: 400 });
  }

  const validation = validateIngestPayload(parsed);
  if (!validation.ok) {
    await logIngestEvent({
      outcome: 'bad_payload',
      userId: authenticatedUserId,
      githubHandle: authenticatedHandle,
      detail: validation.error,
      userAgent,
    });
    return Response.json({ error: validation.error }, { status: 400 });
  }
  const payload = validation.value;

  // 1. Replace this machine's sub-total for the day (repeated pushes just overwrite).
  const { error: machineUpsertError } = await database.from('machine_daily_stats').upsert(
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
    await logIngestEvent({
      outcome: 'error',
      userId: authenticatedUserId,
      githubHandle: authenticatedHandle,
      machine: payload.machine,
      detail: `machine upsert: ${machineUpsertError.message}`,
      userAgent,
    });
    return Response.json(
      { error: 'machine upsert failed', detail: machineUpsertError.message },
      { status: 500 },
    );
  }

  // 2. Read every machine's sub-total for the day.
  const { data: machineRows, error: rollupSelectError } = await database
    .from('machine_daily_stats')
    .select(
      'machine, tokens_total, tokens_by_model, sessions, deep_work_minutes, projects_touched, ships, hourly_tokens',
    )
    .eq('user_id', authenticatedUserId)
    .eq('date', payload.date);
  if (rollupSelectError || !machineRows) {
    await logIngestEvent({
      outcome: 'error',
      userId: authenticatedUserId,
      githubHandle: authenticatedHandle,
      detail: 'rollup select failed',
      userAgent,
    });
    return Response.json({ error: 'rollup select failed' }, { status: 500 });
  }
  const rows = machineRows as MachineRow[];

  // 3. Roll up across machines.
  const summed = {
    tokens_total: rows.reduce((s, r) => s + r.tokens_total, 0),
    sessions: rows.reduce((s, r) => s + r.sessions, 0),
    deep_work_minutes: rows.reduce((s, r) => s + r.deep_work_minutes, 0),
  };

  // 4. Upsert daily_stats rollup.
  const rollup = {
    user_id: authenticatedUserId,
    date: payload.date,
    tokens_total: summed.tokens_total,
    tokens_by_model: rows.reduce<Record<string, number>>(
      (acc, r) => mergeNumberRecords(acc, r.tokens_by_model),
      {},
    ),
    sessions: summed.sessions,
    deep_work_minutes: summed.deep_work_minutes,
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

  const { error: upsertError } = await database
    .from('daily_stats')
    .upsert(rollup, { onConflict: 'user_id,date' });
  if (upsertError) {
    await logIngestEvent({
      outcome: 'error',
      userId: authenticatedUserId,
      githubHandle: authenticatedHandle,
      machine: payload.machine,
      detail: `daily upsert: ${upsertError.message}`,
      userAgent,
    });
    return Response.json({ error: 'upsert failed', detail: upsertError.message }, { status: 500 });
  }

  // Fire-and-forget: regenerate the static OG share-card after a successful
  // push. Awaited via waitUntil-style pattern so the response returns fast
  // and X bots always see a fresh PNG when they unfurl a profile share.
  // Errors are swallowed — a failed regen never blocks a successful ingest.
  await logIngestEvent({
    outcome: 'success',
    userId: authenticatedUserId,
    githubHandle: authenticatedHandle,
    machine: payload.machine,
    payloadDate: payload.date,
    tokensTotal: payload.tokens_total,
    userAgent,
  });

  if (authenticatedHandle) {
    void regenerateOgImage(authenticatedHandle).catch(() => {});
  }

  return Response.json({ ok: true }, { status: 200 });
}
