import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  lifetimeTokens: number;
  daysActive: number;
  lifetimeShips: number;
  nextMilestone: { target: number; progress: number; remaining: number };
};

export function AllTimeTile({ lifetimeTokens, daysActive, lifetimeShips, nextMilestone }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.65rem' }}>
        <Stat label="lifetime tokens" value={formatCompact(lifetimeTokens)} />
        <Stat label="days active" value={formatNumber(daysActive)} />
        <Stat label="lifetime ships" value={formatNumber(lifetimeShips)} />
      </div>
      <div>
        <div style={{ fontSize: '0.65rem', opacity: 0.55, marginBottom: 3 }}>
          next milestone: {formatCompact(nextMilestone.target)} tokens
          <span style={{ opacity: 0.5, marginLeft: 6 }}>
            ({formatCompact(nextMilestone.remaining)} to go)
          </span>
        </div>
        <div style={{ height: 6, background: 'var(--color-bg-2)', borderRadius: 1, overflow: 'hidden' }}>
          <div
            style={{
              width: `${nextMilestone.progress * 100}%`,
              height: '100%',
              background: 'var(--chart-1)',
              transition: 'width 800ms ease-out',
            }}
          />
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ opacity: 0.6, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--chart-2)' }}>{value}</div>
    </div>
  );
}
