import { Heatmap } from '@/components/Heatmap';
import type { DailyStat } from '@/lib/stats/profile-data';

type ActivityPaneProps = {
  tokensToday: number;
  sessionsToday: number;
  machinesCount: number;
  deepWorkMinutes: number;
  tokensByModel: Record<string, number>;
  dailyStats: DailyStat[];
  today: string;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

function modelPct(tokensByModel: Record<string, number>): { opus: number; sonnet: number; haiku: number } {
  const total = Object.values(tokensByModel).reduce((s, n) => s + n, 0) || 1;
  let opus = 0, sonnet = 0, haiku = 0;
  for (const [model, n] of Object.entries(tokensByModel)) {
    if (model.includes('opus')) opus += n;
    else if (model.includes('sonnet')) sonnet += n;
    else if (model.includes('haiku')) haiku += n;
  }
  return {
    opus: Math.round((opus / total) * 100),
    sonnet: Math.round((sonnet / total) * 100),
    haiku: Math.round((haiku / total) * 100),
  };
}

export function ActivityPane({
  tokensToday,
  sessionsToday,
  machinesCount,
  deepWorkMinutes,
  tokensByModel,
  dailyStats,
  today,
}: ActivityPaneProps) {
  const pct = modelPct(tokensByModel);
  const heatmapDays = dailyStats.map((s) => ({ date: s.date, tokens: s.tokens_total }));

  const stats = [
    { n: formatTokens(tokensToday), l: 'tokens today', color: 'var(--color-orange)' },
    { n: String(sessionsToday), l: 'sessions', color: 'var(--color-green)' },
    { n: `${Math.round(deepWorkMinutes / 60)}h`, l: 'deep work', color: 'var(--color-yellow)' },
    { n: String(machinesCount), l: 'machines', color: 'var(--color-cyan)' },
  ];

  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-orange)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-orange)' }}>
        · activity
      </h4>

      <div className="flex gap-4 my-1.5">
        {stats.map((s) => (
          <div key={s.l} className="flex flex-col">
            <span className="text-[1.1rem] font-semibold leading-none" style={{ color: s.color }}>
              {s.n}
            </span>
            <span className="text-[0.58rem] uppercase tracking-[0.08em]" style={{ color: 'var(--color-dim)' }}>
              {s.l}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-2 flex h-[18px] rounded-[3px] overflow-hidden">
        <div style={{ background: 'var(--color-orange)', width: `${pct.opus}%` }} />
        <div style={{ background: 'var(--color-cyan)', width: `${pct.sonnet}%` }} />
        <div style={{ background: 'var(--color-green)', width: `${pct.haiku}%` }} />
      </div>
      <div className="flex gap-3 text-[0.6rem] mt-1" style={{ color: 'var(--color-dim)' }}>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-orange)' }} />
          opus {pct.opus}%
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-cyan)' }} />
          sonnet {pct.sonnet}%
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-green)' }} />
          haiku {pct.haiku}%
        </span>
      </div>

      <div className="mt-2.5">
        <div className="text-[0.55rem] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-dim)' }}>
          52w activity
        </div>
        <Heatmap days={heatmapDays} today={new Date(today + 'T00:00:00Z')} />
      </div>
    </div>
  );
}
