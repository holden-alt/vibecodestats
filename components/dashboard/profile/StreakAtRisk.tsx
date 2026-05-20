'use client';

import { useEffect, useState } from 'react';

type Props = {
  streakDays: number;
  todayTokens: number;
};

export function StreakAtRisk({ streakDays, todayTokens }: Props) {
  const [isAfternoon, setIsAfternoon] = useState(false);
  useEffect(() => {
    const update = () => setIsAfternoon(new Date().getHours() >= 12);
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, []);
  if (streakDays < 2 || todayTokens > 0 || !isAfternoon) return null;
  return (
    <div
      style={{
        padding: '6px 10px',
        border: '1px dashed var(--color-red, #d97373)',
        borderRadius: 2,
        background: 'rgba(217,115,115,0.05)',
        color: 'var(--color-red, #d97373)',
        fontSize: '0.65rem',
      }}
    >
      ⚠ your {streakDays}-day streak ends at midnight — push something today
    </div>
  );
}
