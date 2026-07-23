import type { SystemRow } from '@/lib/insights/types';
import { fmtInt } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';

const STATE_COLOR: Record<string, string> = {
  green: 'var(--color-green)',
  amber: 'var(--color-yellow)',
  red: 'var(--color-red)',
  none: 'var(--color-dim)',
};
const STATE_LABEL: Record<string, string> = {
  green: 'ok',
  amber: 'amber',
  red: 'red',
  none: 'no data',
};

// Systems board — per-system uptime + red incidents + today's state, from
// system_health_daily. Renders fine with a single day of history. Server-rendered.
export function SystemsBoard({ systems, windowDays }: { systems: SystemRow[]; windowDays: number }) {
  const redToday = systems.filter((s) => s.todayState === 'red').length;
  const amberToday = systems.filter((s) => s.todayState === 'amber').length;
  const greenToday = systems.filter((s) => s.todayState === 'green').length;

  const summary =
    systems.length === 0
      ? undefined
      : `${greenToday} ok · ${amberToday} amber · ${redToday} red today`;

  return (
    <PanelShell title="Systems board" hint={`mission-control health · ${windowDays}d uptime`} right={
      summary ? <span style={{ fontSize: '0.6rem', color: 'var(--color-dim)', fontVariantNumeric: 'tabular-nums' }}>{summary}</span> : undefined
    }>
      {systems.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
          No system-health checks recorded yet.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
            gap: 8,
          }}
        >
          {systems.map((s) => (
            <SystemCell key={s.system} s={s} />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function SystemCell({ s }: { s: SystemRow }) {
  const uptimePct = s.uptime == null ? null : Math.round(s.uptime * 100);
  const barColor =
    s.uptime == null
      ? 'var(--color-dim)'
      : s.uptime >= 0.98
        ? 'var(--color-green)'
        : s.uptime >= 0.9
          ? 'var(--color-yellow)'
          : 'var(--color-red)';
  return (
    <div style={{ border: '1px solid var(--color-border)', borderRadius: 3, padding: '9px 11px', background: 'var(--color-bg-2)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7 }}>
        <span
          aria-hidden
          title={STATE_LABEL[s.todayState] ?? s.todayState}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: STATE_COLOR[s.todayState] ?? 'var(--color-dim)',
            flexShrink: 0,
            boxShadow: s.todayState === 'red' ? '0 0 6px var(--color-red)' : 'none',
          }}
        />
        <span
          style={{ fontSize: '0.68rem', color: 'var(--color-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          title={s.system}
        >
          {s.system}
        </span>
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 700, color: barColor, fontVariantNumeric: 'tabular-nums' }}>
          {uptimePct == null ? '—' : `${uptimePct}%`}
        </span>
        <span style={{ fontSize: '0.56rem', color: s.redIncidents > 0 ? 'var(--color-red)' : 'var(--color-dim)', fontVariantNumeric: 'tabular-nums' }}>
          {s.redIncidents > 0 ? `${fmtInt(s.redIncidents)} red` : 'no reds'}
        </span>
      </div>
      <div style={{ marginTop: 6, height: 4, borderRadius: 2, background: 'var(--color-bg)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${uptimePct ?? 0}%`, background: barColor }} />
      </div>
    </div>
  );
}
