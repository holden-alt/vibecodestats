import type { LeaderboardData, Group } from '@/lib/stats/leaderboard';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';

type GroupLeaderboardSectionProps = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
  group: Group;
};

export function GroupLeaderboardSection({
  data,
  viewerId,
  today,
  group,
}: GroupLeaderboardSectionProps) {
  return (
    <section className="mt-3" data-leaderboard-section data-group-section={group.slug}>
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: `var(--color-${group.color})` }}
      >
        {group.name.toLowerCase()}
      </h3>
      <Leaderboard
        data={data}
        viewerId={viewerId}
        today={today}
        lockedScope="groups"
        lockedGroupId={group.id}
      />
    </section>
  );
}
