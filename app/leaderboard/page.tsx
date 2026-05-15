import { createClient } from '@/lib/supabase/server';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';

export const runtime = 'edge';

// v1: there is one real user, so the standalone leaderboard scopes to 'holden-alt'.
// v2 resolves the viewer from the session (Key Decision 4).
const V1_VIEWER_HANDLE = 'holden-alt';

export default async function LeaderboardPage() {
  const supabase = await createClient();

  const { data: viewer } = await supabase
    .from('users')
    .select('id')
    .eq('github_handle', V1_VIEWER_HANDLE)
    .maybeSingle();
  // '' fallback is safe in v1 because holden-alt always exists; v2 will redirect to login instead.
  const viewerId = viewer?.id ?? '';

  const data = await getLeaderboardData(supabase, viewerId);
  const today = new Date().toISOString().slice(0, 10);

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
