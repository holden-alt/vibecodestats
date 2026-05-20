import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  projects: Record<string, number>;
  limit?: number;
};

export function ProjectsBarList({ projects, limit = 6 }: Props) {
  const entries = Object.entries(projects)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = entries[0]?.[1] ?? 1;
  if (entries.length === 0) {
    return <div style={{ fontSize: '0.65rem', opacity: 0.6 }}>no projects touched yet today</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([name, value]) => (
        <div
          key={name}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}
          title={`${name}: ${formatNumber(value)} tokens`}
        >
          <span style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <div style={{ flex: 1, background: 'var(--color-bg-2)', height: 7, borderRadius: 1, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(value / max) * 100}%`,
                background: 'var(--chart-1)',
                height: '100%',
                transition: 'width 800ms ease-out',
              }}
            />
          </div>
          <span style={{ opacity: 0.75, minWidth: 42, textAlign: 'right' }}>{formatCompact(value)}</span>
        </div>
      ))}
    </div>
  );
}
