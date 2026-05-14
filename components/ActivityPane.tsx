import { Heatmap } from '@/components/Heatmap';

type Stat = { n: string; l: string; color: string };

const PLACEHOLDER_STATS: Stat[] = [
  { n: '0', l: 'tokens today', color: 'var(--color-orange)' },
  { n: '—', l: 'vs avg', color: 'var(--color-green)' },
  { n: '0d', l: 'streak', color: 'var(--color-yellow)' },
  { n: '0', l: 'machines', color: 'var(--color-cyan)' },
];

export function ActivityPane() {
  const today = new Date();
  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-orange)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-orange)' }}>
        · activity
      </h4>

      <div className="flex gap-4 my-1.5">
        {PLACEHOLDER_STATS.map((s) => (
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
        <div style={{ background: 'var(--color-orange)', width: '0%' }} />
        <div style={{ background: 'var(--color-cyan)', width: '0%' }} />
        <div style={{ background: 'var(--color-green)', width: '0%' }} />
      </div>
      <div className="flex gap-3 text-[0.6rem] mt-1" style={{ color: 'var(--color-dim)' }}>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-orange)' }} />
          opus
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-cyan)' }} />
          sonnet
        </span>
        <span>
          <i className="inline-block w-2 h-2 rounded-[2px] mr-1 align-middle" style={{ background: 'var(--color-green)' }} />
          haiku
        </span>
      </div>

      <div className="mt-2.5">
        <div className="text-[0.55rem] uppercase tracking-[0.08em] mb-1" style={{ color: 'var(--color-dim)' }}>
          52w activity
        </div>
        <Heatmap days={[]} today={today} />
      </div>
    </div>
  );
}
