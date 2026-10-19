'use client';

import { useState } from 'react';
import { OTHER_COLOR, VENDOR_COLOR } from '@/lib/insights/colors';
import { fmtTokens } from '@/lib/insights/format';
import type { ModelRank } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';
import { Legend } from './chartBits';

type Win = '30d' | '90d' | 'all';
const WINDOWS: { id: Win; label: string }[] = [
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'all' },
];
const PLOT_H = 170;

const VENDOR_NAME: Record<string, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
  xai: 'xAI',
  moonshot: 'Moonshot',
  other: 'Other',
};

/** Models ranked by tokens: one sorted column each, colored by vendor, value on
 *  the cap. Built from divs (not a chart lib) so the labels can wrap. */
export function ModelBars({ byWindow }: { byWindow: Record<Win, ModelRank[]> }) {
  const [win, setWin] = useState<Win>('30d');
  const models = byWindow[win];
  const top = models[0]?.tokens ?? 0;
  const vendors = [...new Set(models.map((m) => m.vendor))];

  return (
    <PanelShell
      title="Models by tokens"
      hint="all token classes · higher means more use"
      right={<Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />}
    >
      <Legend
        items={vendors.map((v) => ({ label: VENDOR_NAME[v] ?? v, color: v === 'other' ? OTHER_COLOR : VENDOR_COLOR[v] }))}
        style={{ marginBottom: 12 }}
      />
      {models.length === 0 ? (
        <div style={{ height: PLOT_H, display: 'grid', placeItems: 'center', color: 'var(--color-dim)', fontSize: '0.68rem' }}>
          No model usage in this window.
        </div>
      ) : (
        <div className="scroll-x">
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: `repeat(${models.length}, minmax(58px, 1fr))`,
              gap: 4,
              minWidth: models.length * 62,
            }}
          >
            {models.map((m) => {
              const h = top > 0 ? Math.max(3, (m.tokens / top) * PLOT_H) : 0;
              const color = m.vendor === 'other' ? OTHER_COLOR : VENDOR_COLOR[m.vendor];
              return (
                <li
                  key={m.model}
                  title={`${m.label} · ${fmtTokens(m.tokens)} · ${Math.round(m.share * 100)}% of tokens`}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 0 }}
                >
                  <div style={{ height: PLOT_H + 18, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
                    <span className="num" style={{ fontSize: '0.66rem', color: 'var(--color-text)', marginBottom: 4 }}>
                      {fmtTokens(m.tokens)}
                    </span>
                    <div style={{ width: 24, height: h, background: color, borderRadius: '4px 4px 0 0' }} />
                  </div>
                  <div style={{ width: '100%', height: 1, background: 'var(--color-border)' }} />
                  <span
                    style={{
                      marginTop: 7,
                      fontSize: '0.66rem',
                      lineHeight: 1.25,
                      color: 'var(--color-dim)',
                      textAlign: 'center',
                      textWrap: 'balance',
                      overflowWrap: 'anywhere',
                    }}
                  >
                    {m.label}
                  </span>
                  <span className="num" style={{ fontSize: '0.6rem', color: 'var(--color-dim-2)', marginTop: 2 }}>
                    {Math.round(m.share * 100)}%
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      )}
    </PanelShell>
  );
}
