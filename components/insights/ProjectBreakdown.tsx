'use client';

import { useState } from 'react';
import { prettyModel } from '@/lib/insights/compute';
import { modelColor, modelLabel } from '@/lib/insights/colors';
import { OTHER_COLOR, type ProjectRow, type WindowKey } from '@/lib/insights/types';
import { fmtInt, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

const WINDOWS: { id: WindowKey; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];
const MAX_PROJECTS = 10;
const MIN_SEGMENT = 0.04; // models below 4% of a project fold into "other"

export function ProjectBreakdown({ byWindow }: { byWindow: Record<WindowKey, ProjectRow[]> }) {
  const [win, setWin] = useState<WindowKey>('30d');
  const rows = (byWindow[win] ?? []).slice(0, MAX_PROJECTS);

  const controls = <Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />;

  return (
    <PanelShell title="Projects" hint="top projects by tokens · model mix · worktrees folded in" right={controls}>
      {rows.length === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.74rem' }}>
          No project activity in the last {win}.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {rows.map((p) => (
            <ProjectRowView key={p.project} row={p} />
          ))}
        </div>
      )}
    </PanelShell>
  );
}

function ProjectRowView({ row }: { row: ProjectRow }) {
  const total = row.tokens || 1;
  // Build mix segments; fold sub-threshold models into "other".
  const segs: { key: string; label: string; tokens: number; color: string }[] = [];
  let other = 0;
  for (const m of row.models) {
    if (m.tokens / total < MIN_SEGMENT) other += m.tokens;
    else segs.push({ key: m.model, label: modelLabel(m.model, prettyModel), tokens: m.tokens, color: modelColor(m.model, m.source) });
  }
  if (other > 0) segs.push({ key: '__other', label: 'other', tokens: other, color: OTHER_COLOR });

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 5 }}>
        <span
          className="num"
          style={{
            fontSize: '0.72rem',
            color: 'var(--color-text)',
            minWidth: 0,
            flex: '1 1 auto',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
          title={row.project}
        >
          {row.project}
        </span>
        <span
          className="num"
          style={{
            marginLeft: 'auto',
            fontSize: '0.72rem',
            color: 'var(--color-text)',
          }}
        >
          {fmtTokens(row.tokens)}
        </span>
      </div>

      {/* model-mix bar */}
      <div
        style={{
          display: 'flex',
          height: 8,
          borderRadius: 2,
          overflow: 'hidden',
          background: 'var(--color-bg-2)',
          border: '1px solid var(--color-border)',
        }}
      >
        {segs.map((s) => (
          <div
            key={s.key}
            title={`${s.label} · ${Math.round((s.tokens / total) * 100)}%`}
            style={{ width: `${(s.tokens / total) * 100}%`, background: s.color }}
          />
        ))}
      </div>

      <div
        className="num"
        style={{
          display: 'flex',
          gap: 14,
          marginTop: 5,
          fontSize: '0.6rem',
          color: 'var(--color-dim)',
          flexWrap: 'wrap',
        }}
      >
        <span>{fmtInt(row.turns)} turns</span>
        {row.completed > 0 && (
          <span style={{ color: 'var(--color-green)' }}>{fmtInt(row.completed)} done</span>
        )}
        {row.blocked > 0 && (
          <span style={{ color: 'var(--color-red)' }}>{fmtInt(row.blocked)} blocked</span>
        )}
        {segs.slice(0, 3).map((s) => (
          <span key={s.key} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span aria-hidden style={{ width: 7, height: 7, borderRadius: 2, background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
