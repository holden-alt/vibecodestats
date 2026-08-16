import { createServiceClient } from '@/lib/db/server';

export async function GET(request: Request): Promise<Response> {
  const handle = new URL(request.url).searchParams.get('handle')?.trim() ?? '';
  if (!/^[A-Za-z0-9-]{1,39}$/.test(handle)) {
    return Response.json({ error: 'invalid handle' }, { status: 400 });
  }
  const database = await createServiceClient();
  const { data: user, error: userError } = await database
    .from('users')
    .select('id')
    .eq('github_handle', handle)
    .maybeSingle();
  if (userError) return Response.json({ error: userError.message }, { status: 500 });
  if (!user) return Response.json([], { headers: { 'cache-control': 'public, max-age=30' } });
  const { data, error } = await database
    .from('daily_stats')
    .select('date, tokens_total')
    .eq('user_id', user.id)
    .order('date', { ascending: true });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? [], {
    headers: { 'cache-control': 'public, max-age=30, s-maxage=30' },
  });
}
