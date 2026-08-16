import { DatabaseClient } from '@/lib/db/client';
import { authorizeInternal } from '@/lib/internal/auth';

const ALLOWED_CONFLICTS: Record<string, string> = {
  llm_model_daily: 'date,source,model',
  llm_project_model_daily: 'date,project,source,model',
  llm_hourly: 'date,hour,source,model',
  repo_ships_daily: 'date,repo',
};

type UpsertBody = {
  table?: string;
  conflict?: string;
  rows?: Array<Record<string, unknown>>;
};

export async function POST(request: Request): Promise<Response> {
  const authorized = await authorizeInternal(request);
  if (!authorized.ok) return authorized.response;

  let body: UpsertBody;
  try {
    body = (await request.json()) as UpsertBody;
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const table = body.table ?? '';
  const expectedConflict = ALLOWED_CONFLICTS[table];
  if (!expectedConflict || body.conflict !== expectedConflict) {
    return Response.json({ error: 'table or conflict key not allowed' }, { status: 400 });
  }
  if (!Array.isArray(body.rows) || body.rows.length > 2_000) {
    return Response.json({ error: 'rows must be an array of at most 2000 objects' }, { status: 400 });
  }
  if (body.rows.length === 0) return Response.json({ ok: true, rows: 0 });

  const database = new DatabaseClient(authorized.bindings.DB);
  const { error } = await database
    .from(table)
    .upsert(body.rows, { onConflict: expectedConflict });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true, rows: body.rows.length });
}
