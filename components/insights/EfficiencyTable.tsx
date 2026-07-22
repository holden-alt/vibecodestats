'use client';

import { useState } from 'react';
import { prettyModel } from '@/lib/insights/compute';
import { SOURCE_COLOR, SOURCE_LABEL, type EfficiencyRow } from '@/lib/insights/types';
import { fmtCost, fmtDuration, fmtInt, fmtRate, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

type Win = '7d' | '30d';
const WINDOWS: { id: Win; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
];

export function EfficiencyTable({ byWindow }: { byWindow: Record<Win, EfficiencyRow[]> }) {
  const [win, setWin] = useState<Win>('30d');
  const rows = byWindow[win] ?? [];

  const controls = <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />;

  return (
    <PanelShell
      title="Model efficiency"
      hint="usage + shipped-work attribution per model"
      right={controls}
    >
      {rows.length === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
          No model activity in the last {win}.
        </div>
      ) : (
        <div className="scroll-x">
          <table className="term-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>model</th>
                <th>tokens</th>
                <th>turns</th>
                <th>tools/turn</th>
                <th>sessions</th>
                <th>active</th>
                <th>cost</th>
                <th>commits</th>
                <th>+lines</th>
                <th>commits/hr</th>
                <th>lines/hr</th>
                <th>commits/100M</th>
                <th>lines/100M</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.source + '|' + r.model}>
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
                  <td style={{ color: 'var(--color-orange)' }}>{fmtTokens(r.tokens)}</td>
                  <td>{fmtInt(r.turns)}</td>
                  <td>{fmtRate(r.toolCallsPerTurn)}</td>
                  <td>{fmtInt(r.sessions)}</td>
                  <td>{fmtDuration(r.activeMinutes)}</td>
                  <td style={{ color: r.cost == null ? 'var(--color-dim)' : 'var(--color-text)' }}>
                    {fmtCost(r.cost)}
                  </td>
                  <td>{r.commits > 0 ? fmtInt(r.commits) : dash()}</td>
                  <td>{r.insertions > 0 ? `+${fmtInt(r.insertions)}` : dash()}</td>
                  <td>{r.commits > 0 ? fmtRate(r.commitsPerActiveHour) : dash()}</td>
                  <td>{r.insertions > 0 ? fmtRate(r.insertionsPerActiveHour) : dash()}</td>
                  <td>{r.commits > 0 ? fmtRate(r.commitsPer100M) : dash()}</td>
                  <td>{r.insertions > 0 ? fmtRate(r.insertionsPer100M) : dash()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ marginTop: 12, fontSize: '0.58rem', color: 'var(--color-dim)', lineHeight: 1.5, maxWidth: 720 }}>
        <span style={{ color: 'var(--color-orange)' }}>†</span> Shipped-work columns use{' '}
        <em style={{ fontStyle: 'normal', color: 'var(--color-text)' }}>dominant-model attribution</em>: each
        day-project&apos;s commits and lines (from git) are credited to whichever model logged the most tokens on
        that project that day. A heuristic, not a causal measurement — a single day-project maps to one model.
      </p>
    </PanelShell>
  );
}

function dash() {
  return <span style={{ color: 'var(--color-dim)', opacity: 0.5 }}>—</span>;
}
