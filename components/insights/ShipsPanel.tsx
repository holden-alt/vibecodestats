'use client';

import { useState } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { ShipsData, WindowKey } from '@/lib/insights/types';
import { fmtInt } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

const WINDOWS: { id: WindowKey; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
];
const MAX_REPOS = 8;

// Ships — what actually left the building: git commits per day/week and the
// repos they landed in. Tokens are the input; this is the closest thing the
// station has to output.
export function ShipsPanel({ byWindow }: { byWindow: Record<WindowKey, ShipsData> }) {
  const [win, setWin] = useState<WindowKey>('30d');
  const d = byWindow[win];
  const weekly = win === '90d';
  const repos = d.repos.slice(0, MAX_REPOS);
  const maxRepo = repos[0]?.commits ?? 1;

  return (
    <PanelShell
      title="Ships"
      hint={`git commits · ${weekly ? 'per week' : 'per day'} · top repos`}
      right={<Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />}
    >
      {d.commits === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.74rem' }}>
          No commits recorded in the last {win}.
        </div>
      ) : (
        <div className="insights-ships">
          <div>
            <div style={{ display: 'flex', gap: 24, alignItems: 'flex-end', marginBottom: 10 }}>
              <Stat label="commits" value={fmtInt(d.commits)} accent />
              <Stat label="repos" value={fmtInt(d.repoCount)} />
              <Stat label="per active day" value={d.perDay.toFixed(1)} />
            </div>
            <div style={{ height: 170, marginLeft: -8 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={d.weekly} margin={{ left: 4, right: 8, top: 8, bottom: 0 }} barCategoryGap={weekly ? '28%' : '22%'}>
                  <CartesianGrid stroke="var(--color-border)" vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={{ stroke: 'var(--color-border)' }}
                    tick={{ fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                    tickFormatter={(v: string) => v.slice(5)}
                    minTickGap={22}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: 'var(--color-dim)', fontFamily: 'var(--font-mono)' }}
                    width={34}
                    allowDecimals={false}
                  />
                  <Tooltip cursor={{ fill: 'var(--color-bg-2)' }} content={<ShipsTooltip weekly={weekly} />} />
                  <Bar
                    dataKey="commits"
                    fill="var(--color-accent)"
                    fillOpacity={0.9}
                    radius={[3, 3, 0, 0]}
                    maxBarSize={22}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div>
            <div className="term-eyebrow" style={{ marginBottom: 8 }}>
              top repos · {win}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
              {repos.map((r) => (
                <div key={r.repo}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 3 }}>
                    <span
                      className="num"
                      title={r.repo}
                      style={{
                        fontSize: '0.68rem',
                        color: 'var(--color-text)',
                        minWidth: 0,
                        flex: '1 1 auto',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {r.repo}
                    </span>
                    <span className="num" style={{ marginLeft: 'auto', fontSize: '0.68rem', color: 'var(--color-text)' }}>
                      {fmtInt(r.commits)}
                    </span>
                  </div>
                  <div style={{ height: 4, borderRadius: 2, background: 'var(--color-bg-2)' }}>
                    <div
                      style={{
                        width: `${(r.commits / maxRepo) * 100}%`,
                        height: '100%',
                        borderRadius: 2,
                        background: 'var(--color-accent)',
                        opacity: 0.75,
                      }}
                    />
                  </div>
                  <div className="num" style={{ marginTop: 3, fontSize: '0.56rem', color: 'var(--color-dim-2)' }}>
                    {fmtInt(r.days)} active day{r.days === 1 ? '' : 's'} · last {r.last.slice(5)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </PanelShell>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="num" style={{ fontSize: '1.15rem', fontWeight: 500, lineHeight: 1.1, color: accent ? 'var(--color-accent)' : 'var(--color-text)' }}>
        {value}
      </div>
      <div className="term-eyebrow" style={{ marginTop: 5 }}>
        {label}
      </div>
    </div>
  );
}

type TipItem = { payload?: { date?: string; commits?: number; repos?: number } };
function ShipsTooltip({ active, payload, label, weekly }: { active?: boolean; payload?: TipItem[]; label?: string; weekly: boolean }) {
  if (!active || !payload?.length) return null;
  const p = payload[0]?.payload;
  return (
    <div
      className="num"
      style={{
        background: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 3,
        padding: '7px 9px',
        fontSize: '0.64rem',
        color: 'var(--color-text)',
        minWidth: 130,
      }}
    >
      <div style={{ color: 'var(--color-dim)', marginBottom: 5 }}>
        {weekly ? 'week ending ' : ''}
        {label}
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <span style={{ color: 'var(--color-dim)' }}>commits</span>
        <span style={{ marginLeft: 'auto' }}>{fmtInt(p?.commits ?? 0)}</span>
      </div>
      <div style={{ display: 'flex', gap: 7 }}>
        <span style={{ color: 'var(--color-dim)' }}>repos</span>
        <span style={{ marginLeft: 'auto' }}>{fmtInt(p?.repos ?? 0)}</span>
      </div>
    </div>
  );
}
