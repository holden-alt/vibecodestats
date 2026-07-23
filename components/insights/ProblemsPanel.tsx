import { humanizeSignature } from '@/lib/insights/compute';
import type { ProblemRow } from '@/lib/insights/types';
import { fmtInt } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';

// Problems I keep fixing — recurring problem signatures grouped from problem_events,
// ranked by recent recurrence. Headline panel (not a footnote). Server-rendered.
export function ProblemsPanel({ problems, today }: { problems: ProblemRow[]; today: string }) {
  return (
    <PanelShell title="Problems I keep fixing" hint="recurring failures, ranked by recent recurrence">
      {problems.length === 0 ? (
        <div style={{ padding: '24px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
          No recurring problems recorded yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {problems.map((p) => (
            <ProblemRowView key={p.signature} p={p} today={today} />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function ProblemRowView({ p, today }: { p: ProblemRow; today: string }) {
  const hitToday = p.lastSeen === today;
  const spread =
    p.firstSeen === p.lastSeen
      ? p.firstSeen.slice(5)
      : `${p.firstSeen.slice(5)}→${p.lastSeen.slice(5)}`;
  return (
    <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.76rem', color: 'var(--color-text)', fontWeight: 600 }}>
            {humanizeSignature(p.signature)}
          </span>
          {hitToday && (
            <span
              style={{
                fontSize: '0.5rem',
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--color-red)',
                border: '1px solid var(--color-red)',
                borderRadius: 3,
                padding: '1px 5px',
              }}
            >
              today
            </span>
          )}
        </div>
        {p.latestDescription && (
          <div
            style={{
              fontSize: '0.64rem',
              color: 'var(--color-dim)',
              marginTop: 3,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
            title={p.latestDescription}
          >
            {p.latestDescription}
          </div>
        )}
        <div style={{ fontSize: '0.56rem', color: 'var(--color-dim)', marginTop: 3, fontVariantNumeric: 'tabular-nums' }}>
          <code style={{ opacity: 0.7 }}>{p.signature}</code> · {spread} · {p.daysActive} day
          {p.daysActive === 1 ? '' : 's'} active
        </div>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-orange)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
          {fmtInt(p.occurrences)}
        </div>
        <div className="term-eyebrow" style={{ marginTop: 4 }}>
          {p.occurrences === 1 ? 'hit' : 'hits'}
        </div>
      </div>
    </div>
  );
}
