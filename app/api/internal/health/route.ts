import { authorizeInternal } from '@/lib/internal/auth';

type HealthRow = { system?: string; state?: string };

export async function POST(request: Request): Promise<Response> {
  const authorized = await authorizeInternal(request);
  if (!authorized.ok) return authorized.response;

  let body: { date?: string; rows?: HealthRow[] };
  try {
    body = (await request.json()) as { date?: string; rows?: HealthRow[] };
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }
  if (!body.date || !/^\d{4}-\d{2}-\d{2}$/.test(body.date) || !Array.isArray(body.rows)) {
    return Response.json({ error: 'invalid date or rows' }, { status: 400 });
  }
  if (body.rows.length > 200) {
    return Response.json({ error: 'too many health rows' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const statements = body.rows.flatMap((row) => {
    if (!row.system || !['green', 'amber', 'red'].includes(row.state ?? '')) return [];
    const ok = row.state === 'green' ? 1 : 0;
    const amber = row.state === 'amber' ? 1 : 0;
    const red = row.state === 'red' ? 1 : 0;
    return [
      authorized.bindings.DB.prepare(
        `INSERT INTO system_health_daily (date, system, checks, ok, amber, red, updated_at)
         VALUES (?, ?, 1, ?, ?, ?, ?)
         ON CONFLICT (date, system) DO UPDATE SET
           checks = system_health_daily.checks + 1,
           ok = system_health_daily.ok + excluded.ok,
           amber = system_health_daily.amber + excluded.amber,
           red = system_health_daily.red + excluded.red,
           updated_at = excluded.updated_at`,
      ).bind(body.date!, row.system, ok, amber, red, now),
    ];
  });
  for (let index = 0; index < statements.length; index += 100) {
    await authorized.bindings.DB.batch(statements.slice(index, index + 100));
  }
  return Response.json({ ok: true, rows: statements.length });
}

export async function GET(request: Request): Promise<Response> {
  const authorized = await authorizeInternal(request);
  if (!authorized.ok) return authorized.response;
  const url = new URL(request.url);
  const end = url.searchParams.get('end') ?? new Date().toISOString().slice(0, 10);
  const startDate = new Date(`${end}T00:00:00Z`);
  startDate.setUTCDate(startDate.getUTCDate() - 1);
  const start = url.searchParams.get('start') ?? startDate.toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return Response.json({ error: 'invalid date range' }, { status: 400 });
  }
  const result = await authorized.bindings.DB
    .prepare(
      `SELECT date, system, checks, ok, amber, red
         FROM system_health_daily
        WHERE date >= ? AND date <= ?
        ORDER BY date DESC, red DESC, amber DESC, system ASC`,
    )
    .bind(start, end)
    .all();
  return Response.json(result.results, {
    headers: { 'cache-control': 'private, no-store' },
  });
}
