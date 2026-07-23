'use client';

import { useState } from 'react';
import { prettyModel } from '@/lib/insights/compute';
import { SOURCE_COLOR, SOURCE_LABEL, type EffectivenessRow } from '@/lib/insights/types';
import { fmtCost, fmtInt, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

type Win = '7d' | '30d';
const WINDOWS: { id: Win; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

// Which models "work for me": interactive task outcomes per model over a window.
export function ModelEffectiveness({ byWindow }: { byWindow: Record<Win, EffectivenessRow[]> }) {
  const [win, setWin] = useState<Win>('30d');
  const rows = byWindow[win] ?? [];

  const controls = <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />;

  return (
    <PanelShell
      title="Model effectiveness"
      hint="interactive task outcomes per model — which models work for me"
      right={controls}
    >
      {rows.length === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
          No interactive sessions judged in the last {win} yet.
        </div>
      ) : (
        <div className="scroll-x">
          <table className="term-table" style={{ minWidth: 720 }}>
            <thead>
              <tr>
                <th>model</th>
                <th>sessions</th>
                <th>done</th>
                <th>partial</th>
                <th>blocked</th>
                <th>abandoned</th>
                <th>completion</th>
                <th>friction</th>
                <th>tokens</th>
                <th>cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.model}>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
                      <span
                        aria-hidden
                        title={SOURCE_LABEL[r.source] ?? r.source}
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: SOURCE_COLOR[r.source] ?? 'var(--color-dim)',
                          flexShrink: 0,
                        }}
                      />
                      <span style={{ color: 'var(--color-text)' }}>{prettyModel(r.model)}</span>
                    </span>
                  </td>
                  <td>{fmtInt(r.sessions)}</td>
                  <td style={{ color: r.completed > 0 ? 'var(--color-green)' : undefined }}>
                    {r.completed > 0 ? fmtInt(r.completed) : dash()}
                  </td>
                  <td style={{ color: r.partial > 0 ? 'var(--color-yellow)' : undefined }}>
                    {r.partial > 0 ? fmtInt(r.partial) : dash()}
                  </td>
                  <td style={{ color: r.blocked > 0 ? 'var(--color-red)' : undefined }}>
                    {r.blocked > 0 ? fmtInt(r.blocked) : dash()}
                  </td>
                  <td style={{ color: 'var(--color-dim)' }}>
                    {r.abandoned > 0 ? fmtInt(r.abandoned) : dash()}
                  </td>
                  <td>
                    <CompletionCell rate={r.completionRate} />
                  </td>
                  <td style={{ color: frictionColor(r.avgFriction) }}>
                    {r.avgFriction == null ? dash() : r.avgFriction.toFixed(1)}
                  </td>
                  <td style={{ color: 'var(--color-orange)' }}>{fmtTokens(r.tokens)}</td>
                  <td style={{ color: r.cost == null ? 'var(--color-dim)' : 'var(--color-text)' }}>
                    {fmtCost(r.cost)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 12, fontSize: '0.58rem', color: 'var(--color-dim)', lineHeight: 1.5, maxWidth: 720 }}>
        Interactive sessions only — automations are tracked separately and never mixed in here. Chat-only sessions
        are excluded from completion + friction. Friction is 0–3 (higher = more stuck).
      </p>
    </PanelShell>
  );
}

function CompletionCell({ rate }: { rate: number | null }) {
  if (rate == null) return <span style={{ color: 'var(--color-dim)' }}>—</span>;
  const pct = Math.round(rate * 100);
  const color = rate >= 0.7 ? 'var(--color-green)' : rate >= 0.4 ? 'var(--color-yellow)' : 'var(--color-red)';
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, justifyContent: 'flex-end' }}>
      <span
        aria-hidden
        style={{ width: 42, height: 5, borderRadius: 3, background: 'var(--color-bg-2)', overflow: 'hidden', flexShrink: 0 }}
      >
        <span style={{ display: 'block', height: '100%', width: `${pct}%`, background: color }} />
      </span>
      <span style={{ color, minWidth: 30, textAlign: 'right' }}>{pct}%</span>
    </span>
  );
}

function frictionColor(f: number | null): string {
  if (f == null) return 'var(--color-dim)';
  if (f >= 1.5) return 'var(--color-red)';
  if (f >= 0.75) return 'var(--color-yellow)';
  return 'var(--color-text)';
}

function dash() {
  return <span style={{ color: 'var(--color-dim)', opacity: 0.5 }}>—</span>;
}
