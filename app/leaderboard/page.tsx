import { createClient } from '@/lib/db/server';
import { todayLocal } from '@/lib/date';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';


// v1: there is one real user, so the standalone leaderboard scopes to 'holden-alt'.
// v2 resolves the viewer from the session (Key Decision 4).
const V1_VIEWER_HANDLE = 'holden-alt';

export default async function LeaderboardPage() {
  const database = await createClient();

  const { data: viewer } = await database
    .from('users')
    .select('id')
    .eq('github_handle', V1_VIEWER_HANDLE)
    .maybeSingle();
  // '' fallback is safe in v1 because holden-alt always exists; v2 will redirect to login instead.
  const viewerId = viewer?.id ?? '';

  const data = await getLeaderboardData(database, viewerId);
  const today = todayLocal();

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1000px] mx-auto">
      <h1
        className="text-[0.7rem] uppercase tracking-[0.14em] font-semibold mb-3"
        style={{ color: 'var(--color-yellow)' }}
      >
        · leaderboard
      </h1>
      <Leaderboard data={data} viewerId={viewerId} today={today} />
    </main>
  );
}
