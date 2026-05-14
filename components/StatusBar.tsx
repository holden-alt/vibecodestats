import { format } from 'date-fns';

type Segment = {
  text: string;
  bg: string;
  fg: string;
};

type StatusBarProps = {
  handle: string;
  primaryPersona: string | null;
  streakDays?: number;
  rank?: number;
  tokensToday?: number;
  tokensDeltaPct?: number;
  badgesEarned?: number;
  badgesTotal?: number;
  now?: Date;
};

export function StatusBar({
  handle,
  primaryPersona,
  streakDays = 0,
  rank = 1,
  tokensToday = 0,
  tokensDeltaPct = 0,
  badgesEarned = 0,
  badgesTotal = 50,
  now = new Date(),
}: StatusBarProps) {
  const segments: Segment[] = [
    { text: `$ ${handle}`, bg: 'var(--color-orange)', fg: 'var(--color-bg)' },
    { text: primaryPersona ?? 'NO PERSONA YET', bg: 'var(--color-magenta)', fg: 'var(--color-bg)' },
    { text: `${streakDays}d streak`, bg: 'var(--color-yellow)', fg: 'var(--color-bg)' },
    { text: `#${rank}`, bg: 'var(--color-green)', fg: 'var(--color-bg)' },
    {
      text: `${formatTokens(tokensToday)} tokens ${tokensDeltaPct >= 0 ? '▲' : '▼'} ${Math.abs(tokensDeltaPct)}%`,
      bg: 'var(--color-cyan)',
      fg: 'var(--color-bg)',
    },
    { text: `${badgesEarned} / ${badgesTotal} badges`, bg: 'var(--color-blue)', fg: 'var(--color-bg)' },
  ];

  return (
    <div className="flex items-stretch text-[0.7rem] font-semibold">
      {segments.map((seg, i) => (
        <div
          key={i}
          style={{
            background: seg.bg,
            color: seg.fg,
            padding: '0.4rem 0.85rem 0.4rem 1rem',
            clipPath:
              i === 0
                ? 'polygon(0 0, calc(100% - 0.5rem) 0, 100% 50%, calc(100% - 0.5rem) 100%, 0 100%)'
                : 'polygon(0 0, calc(100% - 0.5rem) 0, 100% 50%, calc(100% - 0.5rem) 100%, 0 100%, 0.5rem 50%)',
          }}
        >
          {seg.text}
        </div>
      ))}
      <div className="flex-1 bg-[color:var(--color-bg-2)]" />
      <div className="px-3 py-2 text-[color:var(--color-dim)]" style={{ background: 'var(--color-bg-2)' }}>
        {format(now, 'yyyy-MM-dd · HH:mm')}
      </div>
    </div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}
