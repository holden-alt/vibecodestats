import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  weekTokens: number;
  weekDelta: number; // ratio
  monthTokens: number;
  daysActiveThisMonth: number;
  daysInMonth: number;
  shipsThisMonth: number;
};

export function RollupPills({ weekTokens, weekDelta, monthTokens, daysActiveThisMonth, daysInMonth, shipsThisMonth }: Props) {
  const deltaSign = weekDelta >= 0 ? '+' : '';
  const deltaColor = weekDelta >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)';
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: '0.65rem' }}>
      <Pill label="this week" value={formatCompact(weekTokens)} delta={`${deltaSign}${Math.round(weekDelta * 100)}% vs last`} deltaColor={deltaColor} />
      <Pill label="this month" value={formatCompact(monthTokens)} />
      <Pill label="days active" value={`${daysActiveThisMonth}/${daysInMonth}`} />
      <Pill label="ships this month" value={formatNumber(shipsThisMonth)} />
    </div>
  );
}

function Pill({ label, value, delta, deltaColor }: { label: string; value: string; delta?: string; deltaColor?: string }) {
  return (
    <div style={{
      padding: '6px 10px',
      border: '1px solid var(--color-border)',
      borderRadius: 2,
      display: 'flex',
      flexDirection: 'column',
      gap: 2,
      minWidth: 110,
    }}>
      <span style={{ opacity: 0.55, fontSize: '0.65rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</span>
      <span style={{ fontWeight: 600, fontSize: '0.8rem' }}>{value}</span>
      {delta && <span style={{ color: deltaColor, fontSize: '0.65rem' }}>{delta}</span>}
    </div>
  );
}
