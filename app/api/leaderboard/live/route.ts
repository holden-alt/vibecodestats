import { createClient } from '@/lib/db/server';
import { todayLocal } from '@/lib/date';
import { computeLiveDailyRanking } from '@/lib/stats/leaderboard-live';


export async function GET(request: Request) {
  const url = new URL(request.url);
  const viewerId = url.searchParams.get('viewer') ?? '';
  const date = url.searchParams.get('date') ?? todayLocal();

  const database = await createClient();
  const { data, error } = await database
    .from('daily_stats')
    .select('user_id, tokens_total, users:user_id (github_handle)')
    .eq('date', date);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  type RawRow = { user_id: string; tokens_total: number; users: { github_handle: string } | null };
  const rows = (data as RawRow[] ?? []).map((r) => ({
    user_id: r.user_id,
    github_handle: r.users?.github_handle ?? '',
    tokens_total: r.tokens_total,
  })).filter((r) => r.github_handle);

  const ranking = computeLiveDailyRanking(rows, viewerId);
  return Response.json(ranking, {
    headers: {
      'cache-control': 'public, max-age=10, s-maxage=10',
    },
  });
}
