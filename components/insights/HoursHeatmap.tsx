'use client';

import { useMemo, useState } from 'react';
import { buildHeatmapMatrix, DOW_LABELS } from '@/lib/insights/compute';
import { SOURCE_COLOR, SOURCE_LABEL, type HourlyAgg } from '@/lib/insights/types';
import { fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';

const HEAT = ['var(--color-heat-0)', 'var(--color-heat-1)', 'var(--color-heat-2)', 'var(--color-heat-3)', 'var(--color-heat-4)'];
const CELL = 20;
const GAP = 2;
const LABEL_W = 34;
const WINDOW_DAYS = 30;

function level(tokens: number, max: number): number {
  if (tokens <= 0 || max <= 0) return 0;
  const r = tokens / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

function hourLabel(h: number): string {
  const suffix = h < 12 ? 'a' : 'p';
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${suffix}`;
}

type SourceOpt = 'all' | string;

export function HoursHeatmap({
  agg,
  today,
  availableSources,
}: {
  agg: HourlyAgg[];
  today: string;
  availableSources: string[];
}) {
  const [source, setSource] = useState<SourceOpt>('all');
  const [hovered, setHovered] = useState<{ dow: number; hour: number; tokens: number } | null>(null);

  const { matrix, max, total } = useMemo(
    () => buildHeatmapMatrix(agg, today, WINDOW_DAYS, source === 'all' ? null : source),
    [agg, today, source],
  );

  const sourceOptions = useMemo(
    () => [
      { id: 'all', label: 'all' },
      ...availableSources.map((s) => ({ id: s, label: SOURCE_LABEL[s] ?? s, color: SOURCE_COLOR[s] ?? 'var(--color-dim)' })),
    ],
    [availableSources],
  );

  const controls = <Pills options={sourceOptions} value={source} onChange={setSource} ariaLabel="source filter" />;
  const gridWidth = LABEL_W + 24 * (CELL + GAP);

  return (
    <PanelShell title="Productive hours" hint="tokens by hour × weekday (30d)" right={controls}>
      {total === 0 ? (
        <div style={{ padding: '28px 0', textAlign: 'center', color: 'var(--color-dim)', fontSize: '0.72rem' }}>
          No hourly activity in the last 30 days.
        </div>
      ) : (
        <>
          <div style={{ minHeight: 18, marginBottom: 6, fontSize: '0.62rem', color: 'var(--color-dim)', fontVariantNumeric: 'tabular-nums' }}>
            {hovered ? (
              <span>
                <span style={{ color: 'var(--color-text)' }}>
                  {DOW_LABELS[hovered.dow]} {hourLabel(hovered.hour)}
                </span>{' '}
                · {fmtTokens(hovered.tokens)} tokens
              </span>
            ) : (
              <span>hover a cell for detail</span>
            )}
          </div>
          <div className="scroll-x">
            <div style={{ width: gridWidth }}>
              {/* hour axis */}
              <div style={{ display: 'flex', paddingLeft: LABEL_W, marginBottom: 4 }}>
                {Array.from({ length: 24 }, (_, h) => (
                  <div
                    key={h}
                    style={{
                      width: CELL + GAP,
                      fontSize: '0.5rem',
                      color: 'var(--color-dim)',
                      textAlign: 'left',
                      visibility: h % 3 === 0 ? 'visible' : 'hidden',
                    }}
                  >
                    {hourLabel(h)}
                  </div>
                ))}
              </div>
              {DOW_LABELS.map((dl, dow) => (
                <div key={dl} style={{ display: 'flex', alignItems: 'center', marginBottom: GAP }}>
                  <div style={{ width: LABEL_W, fontSize: '0.55rem', color: 'var(--color-dim)', paddingRight: 6 }}>
                    {dl}
                  </div>
                  {(matrix[dow] ?? []).map((tokens, hour) => (
                    <div
                      key={hour}
                      onMouseEnter={() => setHovered({ dow, hour, tokens })}
                      onMouseLeave={() => setHovered(null)}
                      style={{
                        width: CELL,
                        height: CELL,
                        marginRight: GAP,
                        borderRadius: 2,
                        background: HEAT[level(tokens, max)] ?? HEAT[0],
                        outline: hovered && hovered.dow === dow && hovered.hour === hour ? '1px solid var(--color-orange)' : 'none',
                        cursor: 'default',
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 12, fontSize: '0.55rem', color: 'var(--color-dim)' }}>
            <span>less</span>
            {HEAT.map((c, i) => (
              <span key={i} aria-hidden style={{ width: 12, height: 12, borderRadius: 2, background: c }} />
            ))}
            <span>more</span>
          </div>
        </>
      )}
    </PanelShell>
  );
}
