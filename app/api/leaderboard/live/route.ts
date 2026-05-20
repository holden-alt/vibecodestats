import { createClient } from '@/lib/supabase/server';
import { computeLiveDailyRanking } from '@/lib/stats/leaderboard-live';

export const runtime = 'edge';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const viewerId = url.searchParams.get('viewer') ?? '';
  const date = url.searchParams.get('date') ?? new Date().toISOString().slice(0, 10);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('daily_stats')
    .select('user_id, tokens_total, users:user_id (github_handle)')
    .eq('date', date);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const rows = (data ?? []).map((r: any) => ({
    user_id: r.user_id,
    github_handle: r.users?.github_handle ?? '',
    tokens_total: r.tokens_total,
  })).filter((r: any) => r.github_handle);

  const ranking = computeLiveDailyRanking(rows, viewerId);
  return Response.json(ranking, {
    headers: {
      'cache-control': 'public, max-age=10, s-maxage=10',
    },
  });
}
