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
  // Grid with minmax(0, 1fr) so columns can shrink below their content's
  // min-content size. The old flex layout had min-width:120 on each tile, which
  // forced the parent grid cell to ≥372px and burst the mobile viewport.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
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
        minWidth: 0,
        padding: '8px 10px',
        border: '1px solid var(--color-border)',
        borderLeft: '2px solid var(--chart-5)',
        borderRadius: 3,
        background: 'rgba(227, 196, 102, 0.04)',
        overflow: 'hidden',
      }}
    >
      <div style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.08em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--chart-5)', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
      <div style={{ fontSize: '0.65rem', opacity: 0.5, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</div>
    </div>
  );
}
