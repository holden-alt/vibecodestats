import { authorizeInternal } from '@/lib/internal/auth';

export async function GET(request: Request): Promise<Response> {
  const authorized = await authorizeInternal(request);
  if (!authorized.ok) return authorized.response;
  const today = new URL(request.url).searchParams.get('date') ?? new Date().toISOString().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
    return Response.json({ error: 'invalid date' }, { status: 400 });
  }

  const [users, totals, peak] = await authorized.bindings.DB.batch([
    authorized.bindings.DB.prepare('SELECT count(*) AS total FROM users WHERE auth_id IS NOT NULL'),
    authorized.bindings.DB
      .prepare(
        `SELECT count(*) AS active, coalesce(sum(tokens_total), 0) AS tokens
           FROM daily_stats WHERE date = ? AND tokens_total > 0`,
      )
      .bind(today),
    authorized.bindings.DB
      .prepare(
        `SELECT d.tokens_total, u.github_handle
           FROM daily_stats d JOIN users u ON u.id = d.user_id
          WHERE d.date = ? ORDER BY d.tokens_total DESC LIMIT 1`,
      )
      .bind(today),
  ]);
  const userRow = users?.results[0] as { total?: number } | undefined;
  const totalRow = totals?.results[0] as { active?: number; tokens?: number } | undefined;
  const peakRow = peak?.results[0] as { tokens_total?: number; github_handle?: string } | undefined;
  return Response.json({
    totalUsers: Number(userRow?.total ?? 0),
    activeToday: Number(totalRow?.active ?? 0),
    tokensToday: Number(totalRow?.tokens ?? 0),
    peakTokens: Number(peakRow?.tokens_total ?? 0),
    peakHandle: peakRow?.github_handle ?? null,
  });
}

export async function PUT(request: Request): Promise<Response> {
  const authorized = await authorizeInternal(request);
  if (!authorized.ok) return authorized.response;
  const contentType = request.headers.get('content-type');
  if (contentType !== 'image/png') {
    return Response.json({ error: 'content-type must be image/png' }, { status: 415 });
  }
  const bytes = await request.arrayBuffer();
  if (bytes.byteLength < 1024 || bytes.byteLength > 5_000_000) {
    return Response.json({ error: 'invalid image size' }, { status: 400 });
  }
  await authorized.bindings.OG_IMAGES.put('_root.png', bytes, {
    httpMetadata: { contentType: 'image/png', cacheControl: 'public, max-age=300' },
  });
  return Response.json({ ok: true, bytes: bytes.byteLength });
}
