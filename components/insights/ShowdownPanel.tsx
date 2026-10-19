'use client';

import { useState } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { VENDOR_COLOR } from '@/lib/insights/colors';
import { fmtTokens } from '@/lib/insights/format';
import type { ShareWindow, Showdown, VendorPoint } from '@/lib/insights/types';
import { PanelShell } from './PanelShell';
import { Pills } from './Pills';
import { AXIS_TICK, fmtDay, Legend, TipBox, TipRow } from './chartBits';

const WINDOWS: { id: ShareWindow; label: string }[] = [
  { id: '7d', label: '7d' },
  { id: '30d', label: '30d' },
  { id: '90d', label: '90d' },
  { id: 'all', label: 'all' },
];
const WINDOW_WORDS: Record<ShareWindow, string> = {
  '7d': 'last 7 days',
  '30d': 'last 30 days',
  '90d': 'last 90 days',
  all: 'all time',
};
const CLAUDE = VENDOR_COLOR.anthropic;
const CODEX = VENDOR_COLOR.openai;

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** The station's headline: which tool the tokens went to, and by how much. */
export function ShowdownPanel({
  showdowns,
  weekly,
}: {
  showdowns: Record<ShareWindow, Showdown>;
  weekly: VendorPoint[];
}) {
  const [win, setWin] = useState<ShareWindow>('30d');
  const s = showdowns[win];

  // Weekly share rows, as percent of Claude + Codex. Weeks with neither are gaps.
  const rows = weekly.map((w) => ({
    start: w.start,
    end: w.end,
    partial: w.partial,
    claudeTokens: w.claude,
    codexTokens: w.codex,
    claude: w.codexShare == null ? null : (1 - w.codexShare) * 100,
    codex: w.codexShare == null ? null : w.codexShare * 100,
  }));

  return (
    <PanelShell
      title="Codex vs. Claude"
      hint="which tool your tokens went to"
      right={<Pills options={WINDOWS} value={win} onChange={setWin} ariaLabel="time window" />}
    >
      <Verdict s={s} window={win} />

      <SplitBar s={s} />

      <div style={{ marginTop: 22 }}>
        <div
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 8 }}
        >
          <span className="term-eyebrow">share of tokens · by week · all time</span>
          <Legend
            items={[
              { label: 'Claude', color: CLAUDE },
              { label: 'Codex', color: CODEX },
            ]}
          />
        </div>
        <div style={{ height: 190, marginLeft: -8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={rows} stackOffset="none" margin={{ left: 4, right: 22, top: 6, bottom: 0 }}>
              <CartesianGrid stroke="var(--color-border)" vertical={false} />
              <XAxis
                dataKey="start"
                tickLine={false}
                axisLine={{ stroke: 'var(--color-border)' }}
                tick={AXIS_TICK}
                tickFormatter={fmtDay}
                minTickGap={36}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={AXIS_TICK}
                domain={[0, 100]}
                ticks={[0, 50, 100]}
                tickFormatter={(v: number) => `${v}%`}
                width={40}
              />
              <Tooltip cursor={{ stroke: 'var(--color-dim)', strokeOpacity: 0.5, strokeWidth: 1 }} content={<ShareTip />} />
              <Area
                type="monotone"
                dataKey="claude"
                stackId="share"
                stroke={CLAUDE}
                strokeWidth={2}
                fill={CLAUDE}
                fillOpacity={0.22}
                isAnimationActive={false}
                connectNulls={false}
              />
              <Area
                type="monotone"
                dataKey="codex"
                stackId="share"
                stroke={CODEX}
                strokeWidth={2}
                fill={CODEX}
                fillOpacity={0.22}
                isAnimationActive={false}
                connectNulls={false}
              />
              <ReferenceLine
                y={50}
                stroke="var(--color-text)"
                strokeOpacity={0.55}
                strokeWidth={1}
                label={{ value: 'even', position: 'insideTopLeft', fill: 'var(--color-text)', fontSize: 10, fontFamily: 'var(--font-mono)' }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </PanelShell>
  );
}

function Verdict({ s, window }: { s: Showdown; window: ShareWindow }) {
  let big: string;
  let line: string;
  if (s.leader === null) {
    big = '—';
    line = `No Claude or Codex usage in the ${WINDOW_WORDS[window]}.`;
  } else if (s.ratio === null) {
    big = s.leader === 'codex' ? 'Codex only' : 'Claude only';
    line = `Only ${s.leader === 'codex' ? 'Codex' : 'Claude'} ran in the ${WINDOW_WORDS[window]}.`;
  } else if (s.leader === 'even') {
    big = 'Even';
    line = `Claude and Codex split the ${WINDOW_WORDS[window]} about evenly.`;
  } else {
    const lead = s.leader === 'codex' ? 'Codex' : 'Claude';
    const trail = s.leader === 'codex' ? 'Claude' : 'Codex';
    big = `${lead} ${s.ratio.toFixed(1)}×`;
    line = `${lead} used ${s.ratio.toFixed(1)}× as many tokens as ${trail} · ${WINDOW_WORDS[window]}`;
  }
  const leadColor = s.leader === 'codex' ? CODEX : s.leader === 'claude' ? CLAUDE : 'var(--color-dim)';
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap', marginBottom: 14 }}>
      <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 10 }}>
        <span aria-hidden style={{ width: 10, height: 10, borderRadius: 2, background: leadColor, alignSelf: 'center' }} />
        <span style={{ fontSize: '2.4rem', fontWeight: 600, lineHeight: 1, letterSpacing: '-0.01em' }}>{big}</span>
      </span>
      <span style={{ fontSize: '0.8rem', color: 'var(--color-dim)' }}>{line}</span>
    </div>
  );
}

/** One 100% bar: Claude's share left, Codex's right, a 2px ground gap between. */
function SplitBar({ s }: { s: Showdown }) {
  if (s.codexShare === null) return null;
  const codex = s.codexShare;
  const claude = 1 - codex;
  return (
    <div>
      <div style={{ display: 'flex', gap: 2, height: 12 }} role="img" aria-label={`Claude ${pct(claude)}, Codex ${pct(codex)}`}>
        {claude > 0 && <div style={{ flexGrow: claude, background: CLAUDE, borderRadius: codex > 0 ? '4px 0 0 4px' : 4 }} />}
        {codex > 0 && <div style={{ flexGrow: codex, background: CODEX, borderRadius: claude > 0 ? '0 4px 4px 0' : 4 }} />}
      </div>
      <div
        className="num"
        style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 7, fontSize: '0.7rem', color: 'var(--color-dim)' }}
      >
        <span>
          <span style={{ color: 'var(--color-text)' }}>Claude {pct(claude)}</span> · {fmtTokens(s.claude)}
        </span>
        <span>
          {fmtTokens(s.codex)} · <span style={{ color: 'var(--color-text)' }}>Codex {pct(codex)}</span>
        </span>
      </div>
    </div>
  );
}

type ShareRow = { start: string; end: string; partial: boolean; claudeTokens: number; codexTokens: number; codex: number | null };
function ShareTip({ active, payload }: { active?: boolean; payload?: { payload?: ShareRow }[] }) {
  const row = payload?.[0]?.payload;
  if (!active || !row || row.codex == null) return null;
  return (
    <TipBox title={`week of ${fmtDay(row.start)}${row.partial ? ' (so far)' : ''}`}>
      <TipRow color={CLAUDE} label="Claude" value={`${Math.round(100 - row.codex)}% · ${fmtTokens(row.claudeTokens)}`} />
      <TipRow color={CODEX} label="Codex" value={`${Math.round(row.codex)}% · ${fmtTokens(row.codexTokens)}`} />
    </TipBox>
  );
}
