import { createServiceClient } from '@/lib/db/server';

export async function GET(request: Request): Promise<Response> {
  const userId = new URL(request.url).searchParams.get('user');
  if (!userId || !/^[0-9a-f:-]{8,80}$/i.test(userId)) {
    return Response.json({ error: 'invalid user' }, { status: 400 });
  }
  const database = await createServiceClient();
  const { data, error } = await database
    .from('daily_stats')
    .select('*')
    .eq('user_id', userId)
    .order('date', { ascending: false })
    .limit(366);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json(data ?? [], {
    headers: { 'cache-control': 'public, max-age=10, s-maxage=10' },
  });
}
