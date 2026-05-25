import { createClient } from '@supabase/supabase-js';
import { validateIngestPayload } from '@/lib/ingest/payload';
import { regenerateOgImage } from '@/lib/og/regenerate';
import { computeVbw, DEFAULT_ANCHORS, type AnchorsByDim, type DimKey } from '@/lib/stats/vbw';
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
  tool_calls: number;
  ship_quality: number;
  output_tokens: number;
  cache_creation_tokens: number;
};

// Fetch the platform-wide dim anchors from the DB. Falls back to DEFAULT_ANCHORS
// if the table is missing, errors out, or returns no rows. Defensive: in test
// environments the supabase mock typically only stubs the tables under test.
async function fetchAnchors(
  supabase: ReturnType<typeof createClient<Database>>,
): Promise<AnchorsByDim> {
  try {
    const { data } = await supabase.from('dim_anchor').select('dim, anchor, k');
    if (!data || data.length === 0) return DEFAULT_ANCHORS;
    const out = { ...DEFAULT_ANCHORS };
    for (const row of data as { dim: string; anchor: number; k: number }[]) {
      if (row.dim in out) {
        out[row.dim as DimKey] = { anchor: row.anchor, k: row.k };
      }
    }
    return out;
  } catch {
    return DEFAULT_ANCHORS;
  }
}

// Count consecutive prior days (excluding `date` itself) where the user had any
// activity. Used as the streak multiplier input for VBW. Looks back 14 days max.
async function streakBefore(
  supabase: ReturnType<typeof createClient<Database>>,
  userId: string,
  date: string,
): Promise<number> {
  const { data } = await supabase
    .from('daily_stats')
    .select('date,tokens_total')
    .eq('user_id', userId)
    .lt('date', date)
    .gte('date', new Date(Date.parse(date + 'T00:00:00Z') - 14 * 86400_000).toISOString().slice(0, 10))
    .order('date', { ascending: false })
    .limit(14);
  if (!data || data.length === 0) return 0;

  const targetMs = Date.parse(date + 'T00:00:00Z');
  let streak = 0;
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    if (!row || row.tokens_total <= 0) break;
    const expected = new Date(targetMs - (i + 1) * 86400_000).toISOString().slice(0, 10);
    if (row.date !== expected) break;
    streak++;
  }
  return streak;
}

export async function POST(request: Request): Promise<Response> {
  const authHeader = request.headers.get('authorization');

  if (!authHeader?.startsWith('Bearer ')) {
    return Response.json({ error: 'missing auth' }, { status: 401 });
  }

  const rawBody = await request.text();

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // --- Token auth (only supported path) ---
  const token = authHeader.slice('Bearer '.length).trim();

  const { data: tokenUser, error: tokenError } = await supabase
    .from('users')
    .select('id, github_handle')
    .eq('ingest_token', token)
    .maybeSingle();

  if (tokenError) {
    return Response.json({ error: 'user lookup failed' }, { status: 500 });
  }
  if (!tokenUser) {
    return Response.json({ error: 'invalid token' }, { status: 401 });
  }

  const authenticatedUserId = tokenUser.id;
  const authenticatedHandle = tokenUser.github_handle;

  // Parse and validate the payload.
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
      tool_calls: payload.tool_calls,
      ship_quality: payload.ship_quality,
      output_tokens: payload.output_tokens,
      cache_creation_tokens: payload.cache_creation_tokens,
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
    .select(
      'machine, tokens_total, tokens_by_model, sessions, deep_work_minutes, projects_touched, ships, hourly_tokens, tool_calls, ship_quality, output_tokens, cache_creation_tokens',
    )
    .eq('user_id', authenticatedUserId)
    .eq('date', payload.date);
  if (rollupSelectError || !machineRows) {
    return Response.json({ error: 'rollup select failed' }, { status: 500 });
  }
  const rows = machineRows as MachineRow[];

  // 3. Roll up across machines.
  const summed = {
    tokens_total: rows.reduce((s, r) => s + r.tokens_total, 0),
    sessions: rows.reduce((s, r) => s + r.sessions, 0),
    deep_work_minutes: rows.reduce((s, r) => s + r.deep_work_minutes, 0),
    tool_calls: rows.reduce((s, r) => s + (r.tool_calls ?? 0), 0),
    ship_quality: rows.reduce((s, r) => s + (r.ship_quality ?? 0), 0),
    output_tokens: rows.reduce((s, r) => s + (r.output_tokens ?? 0), 0),
    cache_creation_tokens: rows.reduce((s, r) => s + (r.cache_creation_tokens ?? 0), 0),
  };

  // 4. Compute VBW from the rolled-up inputs + streak. Anchors come from the
  //    dim_anchor table so they can be retuned without a redeploy.
  const [streak, anchors] = await Promise.all([
    streakBefore(supabase, authenticatedUserId, payload.date),
    fetchAnchors(supabase),
  ]);
  const vbw = computeVbw(
    {
      output_tokens: summed.output_tokens,
      cache_creation_tokens: summed.cache_creation_tokens,
      tool_calls: summed.tool_calls,
      ship_quality: summed.ship_quality,
      deep_work_minutes: summed.deep_work_minutes,
    },
    streak,
    anchors,
  );

  // 5. Upsert daily_stats with the new VBW columns.
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
    tool_calls: summed.tool_calls,
    ship_quality: summed.ship_quality,
    output_tokens: summed.output_tokens,
    cache_creation_tokens: summed.cache_creation_tokens,
    vbw_total: vbw.total,
    vbw_components: vbw.components,
  };

  const { error: upsertError } = await supabase
    .from('daily_stats')
    .upsert(rollup, { onConflict: 'user_id,date' });
  if (upsertError) {
    return Response.json({ error: 'upsert failed', detail: upsertError.message }, { status: 500 });
  }

  // Fire-and-forget: regenerate the static OG share-card after a successful
  // push. Awaited via waitUntil-style pattern so the response returns fast
  // and X bots always see a fresh PNG when they unfurl a profile share.
  // Errors are swallowed — a failed regen never blocks a successful ingest.
  if (authenticatedHandle) {
    void regenerateOgImage(authenticatedHandle, supabase).catch(() => {});
  }

  return Response.json({ ok: true, vbw: vbw.total }, { status: 200 });
}
