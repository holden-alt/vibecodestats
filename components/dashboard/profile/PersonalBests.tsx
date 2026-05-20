import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  bestDayTokens: number;
  bestDayDate: string | null;
  bestShipsCount: number;
  bestShipsDate: string | null;
  bestSessionsCount: number;
  bestSessionsDate: string | null;
};

export function PersonalBests({ bestDayTokens, bestDayDate, bestShipsCount, bestShipsDate, bestSessionsCount, bestSessionsDate }: Props) {
  return (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      <Trophy label="best day" value={formatCompact(bestDayTokens)} sub={bestDayDate ?? '—'} />
      <Trophy label="most ships" value={formatNumber(bestShipsCount)} sub={bestShipsDate ?? '—'} />
      <Trophy label="most sessions" value={formatNumber(bestSessionsCount)} sub={bestSessionsDate ?? '—'} />
    </div>
  );
}

function Trophy({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div
      style={{
        flex: '1 1 0',
        minWidth: 120,
        padding: '8px 10px',
        border: '1px solid var(--color-border)',
        borderLeft: '2px solid var(--chart-5)',
        borderRadius: 3,
        background: 'rgba(227, 196, 102, 0.04)',
      }}
    >
      <div style={{ fontSize: '0.5rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--chart-5)', marginTop: 2 }}>{value}</div>
      <div style={{ fontSize: '0.5rem', opacity: 0.5, marginTop: 2 }}>{sub}</div>
    </div>
  );
}
