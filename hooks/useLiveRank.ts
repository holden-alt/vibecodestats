'use client';

import { useEffect, useState } from 'react';
import type { LiveRanking } from '@/lib/stats/leaderboard-live';

const POLL_MS = 30_000;

export function useLiveRank(
  viewerId: string,
  date: string,
  initial: LiveRanking,
): LiveRanking {
  const [data, setData] = useState<LiveRanking>(initial);
  useEffect(() => {
    let cancelled = false;
    const fetchNow = async () => {
      try {
        const res = await fetch(`/api/leaderboard/live?viewer=${encodeURIComponent(viewerId)}&date=${encodeURIComponent(date)}`);
        if (!res.ok) return;
        const json = (await res.json()) as LiveRanking;
        if (!cancelled) setData(json);
      } catch {}
    };
    const interval = setInterval(fetchNow, POLL_MS);

    // Also fetch immediately when viewerId/date changes
    fetchNow();

    return () => { cancelled = true; clearInterval(interval); };
  }, [viewerId, date]);

  return data;
}
