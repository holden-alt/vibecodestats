import type { LeaderboardData } from '@/lib/stats/leaderboard';
import { Leaderboard } from '@/components/leaderboard/Leaderboard';

type LeaderboardSectionProps = {
  data: LeaderboardData;
  viewerId: string;
  today: string;
};

export function LeaderboardSection({ data, viewerId, today }: LeaderboardSectionProps) {
  return (
    <section className="mt-3" data-leaderboard-section>
      <h3
        className="text-[0.6rem] uppercase tracking-[0.12em] font-semibold mb-2"
        style={{ color: 'var(--color-dim)' }}
      >
        leaderboard
      </h3>
      <Leaderboard data={data} viewerId={viewerId} today={today} />
    </section>
  );
}
