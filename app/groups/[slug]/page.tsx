import { notFound } from 'next/navigation';
import { todayLocal } from '@/lib/date';
import { createClient } from '@/lib/db/server';
import { getLeaderboardData } from '@/lib/stats/leaderboard-data';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';
import { GroupHeader } from '@/components/groups/GroupHeader';


// v1: the viewer for the standalone group page is hardcoded to holden-alt,
// matching /leaderboard. v2 resolves the viewer from the session.
const V1_VIEWER_HANDLE = 'holden-alt';

type GroupPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function GroupPage({ params }: GroupPageProps) {
  const { slug } = await params;
  const database = await createClient();

  const { data: group } = await database
    .from('groups')
    .select('id, slug, name, color, description')
    .eq('slug', slug)
    .maybeSingle();
  if (!group) {
    notFound();
  }

  const { data: viewer } = await database
    .from('users')
    .select('id')
    .eq('github_handle', V1_VIEWER_HANDLE)
    .maybeSingle();
  const viewerId = viewer?.id ?? '';

  const data = await getLeaderboardData(database, viewerId);

  // memberCount is computed from viewerGroups (already fetched), with a
  // fallback for the case where the viewer isn't a member of this group:
  // in v1 that doesn't happen (holden-alt is in every seeded group), but
  // when it does, the count falls back to 0 rather than throwing.
  const viewerGroupEntry = data.viewerGroups.find((g) => g.id === group.id);
  const memberCount = viewerGroupEntry?.memberUserIds.length ?? 0;

  const today = todayLocal();

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1000px] mx-auto">
      <GroupHeader
        name={group.name}
        color={group.color}
        description={group.description}
        memberCount={memberCount}
      />
      <Leaderboard
        data={data}
        viewerId={viewerId}
        today={today}
        lockedScope="groups"
        lockedGroupId={group.id}
      />
    </main>
  );
}
