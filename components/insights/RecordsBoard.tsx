'use client';

import { useMemo, useState } from 'react';
import { addDays, daysBetween, dowMonFirst, DOW_LABELS } from '@/lib/insights/compute';
import type { Milestone, OdometerPoint, Pace, RecordsData } from '@/lib/insights/types';
import { fmtDuration, fmtInt, fmtTokens } from '@/lib/insights/format';
import { PanelShell } from './PanelShell';

// Lifetime panel — the full-history day store, read three ways:
//   1. record tiles (bests, streaks, lifetime counters),
//   2. a day grid: every tracked day as one cell, intensity = tokens
//      (the rhythm of the work — heavy weeks, weekends, the 1B+ days),
//   3. a milestone timeline: when each round cumulative total landed, the
//      current pace, and the projected date for the next one.
// The old cumulative line is gone: a monotone curve against a 100B ceiling
// carried almost no information the ladder does not carry better.
export function RecordsBoard({ records, today }: { records: RecordsData; today: string }) {
  const r = records;
  if (r.daysTracked === 0) return null;

  const pct = Math.min(100, (r.lifetimeTokens / r.nextMilestone) * 100);
  const deepHours = Math.round(r.lifetimeDeepWorkMinutes / 60);

  return (
    <PanelShell
      title="Lifetime"
      hint={`full history · since ${r.firstDate ? r.firstDate.slice(5) : '—'} · ${fmtInt(r.daysTracked)} days`}
      right={
        <span className="num" style={{ fontSize: '0.62rem', color: 'var(--color-dim)' }}>
          {fmtTokens(r.lifetimeTokens)} of {fmtTokens(r.nextMilestone)} · {pct.toFixed(0)}%
        </span>
      }
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(104px, 1fr))',
          gap: '14px 18px',
          marginBottom: 18,
        }}
      >
        <Tile label="lifetime tokens" value={fmtTokens(r.lifetimeTokens)} accent />
        <Tile
          label={`best day${r.bestDay ? ` · ${r.bestDay.date.slice(5)}` : ''}`}
          value={r.bestDay ? fmtTokens(r.bestDay.tokens) : '—'}
        />
        <Tile
          label={`best week${r.bestWeek ? ` · wk of ${r.bestWeek.start.slice(5)}` : ''}`}
          value={r.bestWeek ? fmtTokens(r.bestWeek.tokens) : '—'}
        />
        <Tile label="1B+ days" value={fmtInt(r.billionDays)} />
        <Tile label="deep work" value={`${fmtInt(deepHours)}h`} />
        <Tile label="sessions" value={fmtInt(r.lifetimeSessions)} />
        <Tile label="commits" value={r.lifetimeCommits == null ? '—' : fmtInt(r.lifetimeCommits)} />
        <Tile
          label={`streak · longest ${r.longestStreak ? fmtInt(r.longestStreak.days) : 0}`}
          value={`${fmtInt(r.currentStreak)}d`}
        />
      </div>

      <HistoryGrid days={r.odometer} today={today} bestDay={r.bestDay?.date ?? null} />

      <MilestoneLadder
        firstDate={r.firstDate ?? today}
        today={today}
        milestones={r.milestones}
        lifetime={r.lifetimeTokens}
        nextMilestone={r.nextMilestone}
        etaNext={r.etaNext}
        pace={r.pace}
      />
    </PanelShell>
  );
}

function Tile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div
        className="num"
        style={{
          fontSize: '1.15rem',
          fontWeight: 500,
          lineHeight: 1.1,
          color: accent ? 'var(--color-accent)' : 'var(--color-text)',
        }}
      >
        {value}
      </div>
      <div className="term-eyebrow" style={{ marginTop: 5 }}>
        {label}
      </div>
    </div>
  );
}

// ── Day grid ─────────────────────────────────────────────────────────────────
const MAX_WEEKS = 53;
const HEAT = [
  'var(--color-heat-0)',
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
  'var(--color-heat-5)',
];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** Quantile cut points over active days → 5 intensity bands above "empty". */
function thresholds(values: number[]): number[] {
  const v = values.filter((x) => x > 0).sort((a, b) => a - b);
  if (v.length < 5) return [1, 2, 3, 4];
  const q = (p: number) => v[Math.min(v.length - 1, Math.floor((v.length - 1) * p))]!;
  return [q(0.25), q(0.5), q(0.75), q(0.9)];
}
function level(tokens: number, cuts: number[]): number {
  if (tokens <= 0) return 0;
  let l = 1;
  for (const c of cuts) if (tokens > c) l++;
  return Math.min(5, l);
}

type Hover = { date: string; point: OdometerPoint | null } | null;

function HistoryGrid({ days, today, bestDay }: { days: OdometerPoint[]; today: string; bestDay: string | null }) {
  const [hover, setHover] = useState<Hover>(null);

  const { columns, cuts, byDate } = useMemo(() => {
    const byDate = new Map(days.map((d) => [d.date, d]));
    const first = days[0]?.date ?? today;
    // Start on the Monday on/before the first tracked day, capped at MAX_WEEKS back.
    const capStart = addDays(today, -(MAX_WEEKS * 7 - 1));
    const rawStart = first > capStart ? first : capStart;
    const start = addDays(rawStart, -dowMonFirst(rawStart));
    const weeks = Math.floor(daysBetween(start, today) / 7) + 1;
    const columns: { dates: (string | null)[]; monthLabel: string | null }[] = [];
    let prevMonth = '';
    for (let w = 0; w < weeks; w++) {
      const dates: (string | null)[] = [];
      let monthLabel: string | null = null;
      for (let d = 0; d < 7; d++) {
        const date = addDays(start, w * 7 + d);
        dates.push(date > today ? null : date);
        const m = date.slice(0, 7);
        if (date <= today && m !== prevMonth) {
          if (prevMonth !== '' || w === 0) monthLabel = MONTHS[Number(date.slice(5, 7)) - 1]!;
          prevMonth = m;
        }
      }
      columns.push({ dates, monthLabel });
    }
    return { columns, cuts: thresholds(days.map((d) => d.day)), byDate };
  }, [days, today]);

  const weeks = columns.length;
  const maxWidth = weeks * 27;
  const p = hover?.point ?? null;

  return (
    <div style={{ marginBottom: 18 }}>
      <div
        className="num"
        style={{ minHeight: 18, marginBottom: 8, fontSize: '0.64rem', color: 'var(--color-dim)' }}
        aria-live="polite"
      >
        {hover ? (
          p ? (
            <span>
              <span style={{ color: 'var(--color-text)' }}>
                {DOW_LABELS[dowMonFirst(hover.date)]} {hover.date}
              </span>
              {' · '}
              <span style={{ color: 'var(--color-text)' }}>{fmtTokens(p.day)}</span> tokens
              {p.sessions != null && ` · ${fmtInt(p.sessions)} sessions`}
              {p.deepWorkMinutes != null && p.deepWorkMinutes > 0 && ` · ${fmtDuration(p.deepWorkMinutes)} deep work`}
              {p.commits != null && ` · ${fmtInt(p.commits)} commits`}
              {' · lifetime '}
              {fmtTokens(p.cumulative)}
            </span>
          ) : (
            <span>
              {DOW_LABELS[dowMonFirst(hover.date)]} {hover.date} · no activity
            </span>
          )
        ) : (
          <span>every tracked day · hover a cell for detail</span>
        )}
      </div>

      <div className="scroll-x">
        <div style={{ display: 'flex', gap: 8, minWidth: weeks * 12 + 30 }}>
          {/* weekday labels */}
          <div
            className="term-eyebrow"
            style={{ display: 'grid', gridTemplateRows: 'repeat(7, minmax(0, 1fr))', gap: 3, paddingTop: 16, letterSpacing: 0 }}
          >
            {DOW_LABELS.map((d, i) => (
              <div key={d} style={{ fontSize: '0.5rem', lineHeight: 1, alignSelf: 'center', visibility: i % 2 === 0 ? 'visible' : 'hidden' }}>
                {d}
              </div>
            ))}
          </div>
          <div style={{ flex: 1, maxWidth }}>
            {/* month labels */}
            <div
              className="term-eyebrow"
              style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))`,
                gap: 3,
                height: 13,
                marginBottom: 3,
                fontSize: '0.5rem',
                letterSpacing: '0.06em',
                overflow: 'hidden',
              }}
            >
              {columns.map((c, i) => (
                <div key={i} style={{ whiteSpace: 'nowrap', lineHeight: '13px' }}>
                  {c.monthLabel ?? ''}
                </div>
              ))}
            </div>
            <div className="history-grid" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 1fr))` }}>
              {columns.map((c, w) =>
                c.dates.map((date, d) => {
                  if (!date) return <div key={`${w}-${d}`} className="history-cell" style={{ background: 'transparent' }} />;
                  const point = byDate.get(date) ?? null;
                  const tokens = point?.day ?? 0;
                  const lvl = level(tokens, cuts);
                  const isBillion = tokens >= 1e9;
                  const isBest = date === bestDay;
                  const hovered = hover?.date === date;
                  const ring = isBest
                    ? 'inset 0 0 0 2px var(--color-text)'
                    : isBillion
                      ? 'inset 0 0 0 1.5px var(--color-text)'
                      : 'none';
                  return (
                    <div
                      key={date}
                      className="history-cell"
                      title={`${date}: ${fmtTokens(tokens)} tokens`}
                      onMouseEnter={() => setHover({ date, point })}
                      onMouseLeave={() => setHover(null)}
                      style={{
                        background: HEAT[lvl],
                        boxShadow: ring,
                        outline: hovered ? '1px solid var(--color-text)' : 'none',
                        outlineOffset: 1,
                      }}
                    />
                  );
                }),
              )}
            </div>
          </div>
        </div>
      </div>

      <div
        className="term-eyebrow"
        style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: '0.52rem', letterSpacing: '0.06em' }}
      >
        <span>less</span>
        {HEAT.map((c, i) => (
          <span key={i} aria-hidden style={{ width: 11, height: 11, borderRadius: 2, background: c }} />
        ))}
        <span>more</span>
        <span style={{ marginLeft: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 11, height: 11, borderRadius: 2, background: HEAT[4], boxShadow: 'inset 0 0 0 1.5px var(--color-text)' }} />
          1B+ day
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <span aria-hidden style={{ width: 11, height: 11, borderRadius: 2, background: HEAT[5], boxShadow: 'inset 0 0 0 2px var(--color-text)' }} />
          best day
        </span>
      </div>
    </div>
  );
}

// ── Milestone ladder ─────────────────────────────────────────────────────────
// A time axis from the first tracked day to the projected next milestone.
// Milestones sit where they were crossed, so the spacing IS the acceleration:
// 1B→2B took days, 20B→50B took two months. The current position is the
// panel's amber moment.
function MilestoneLadder({
  firstDate,
  today,
  milestones,
  lifetime,
  nextMilestone,
  etaNext,
  pace,
}: {
  firstDate: string;
  today: string;
  milestones: Milestone[];
  lifetime: number;
  nextMilestone: number;
  etaNext: string | null;
  pace: Pace;
}) {
  const elapsed = Math.max(1, daysBetween(firstDate, today));
  const future = etaNext ? daysBetween(today, etaNext) : 0;
  // Cap the projection at 60% of the elapsed span so a far-off ETA does not
  // squash the history into the left third. Past the cap the label says "→".
  const cap = Math.max(14, Math.round(elapsed * 0.6));
  const capped = future > cap;
  const shown = etaNext ? Math.min(future, cap) : Math.max(14, Math.round(elapsed * 0.12));
  const total = elapsed + shown;
  const x = (date: string) => Math.max(0, Math.min(100, (daysBetween(firstDate, date) / total) * 100));
  const xToday = x(today);

  // Stagger date labels when neighbouring milestones sit closer than ~4.5%.
  const ticks = milestones.map((m, i) => {
    const px = x(m.date);
    const prev = i > 0 ? x(milestones[i - 1]!.date) : -100;
    return { ...m, x: px, gap: px - prev };
  });
  let row = 0;
  const staggered = ticks.map((t) => {
    row = t.gap < 4.5 ? (row + 1) % 2 : 0;
    return { ...t, row };
  });

  const fmtDate = (d: string) => d.slice(5);
  const perDay = (v: number) => (v > 0 ? `${fmtTokens(v)}/day` : '—');

  return (
    <div>
      <div className="term-eyebrow" style={{ marginBottom: 6 }}>
        milestones · when each round total landed
      </div>
      <div style={{ position: 'relative', height: 96, margin: '0 8px' }}>
        {/* track: elapsed (solid) + projection (dashed) */}
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: 0,
            width: `${xToday}%`,
            top: 42,
            height: 2,
            background: 'var(--color-dim-2)',
          }}
        />
        <div
          aria-hidden
          style={{
            position: 'absolute',
            left: `${xToday}%`,
            right: 0,
            top: 42,
            height: 0,
            borderTop: '2px dashed var(--color-border)',
          }}
        />

        {staggered.map((t) => (
          <div key={t.value} style={{ position: 'absolute', left: `${t.x}%`, top: 0, width: 0 }}>
            <div
              className="num"
              style={{
                position: 'absolute',
                left: 0,
                top: 14 - t.row * 12,
                transform: 'translateX(-50%)',
                fontSize: '0.62rem',
                color: 'var(--color-text)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtTokens(t.value).replace('.00', '')}
            </div>
            <div
              aria-hidden
              style={{
                position: 'absolute',
                left: 0,
                top: 39,
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: 'var(--color-text)',
                transform: 'translateX(-50%)',
                boxShadow: '0 0 0 2px var(--color-bg)',
              }}
            />
            <div
              className="num"
              style={{
                position: 'absolute',
                left: 0,
                top: 54 + t.row * 13,
                transform: 'translateX(-50%)',
                fontSize: '0.55rem',
                color: 'var(--color-dim)',
                whiteSpace: 'nowrap',
              }}
            >
              {fmtDate(t.date)}
            </div>
          </div>
        ))}

        {/* current position — the amber moment */}
        <div style={{ position: 'absolute', left: `${xToday}%`, top: 0, width: 0 }}>
          <div
            className="num"
            style={{
              position: 'absolute',
              left: 0,
              top: 8,
              transform: xToday > 88 ? 'translateX(-100%)' : 'translateX(-50%)',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: 'var(--color-accent)',
              whiteSpace: 'nowrap',
            }}
          >
            {fmtTokens(lifetime)}
          </div>
          <div
            aria-hidden
            className="station-pulse"
            style={{
              position: 'absolute',
              left: 0,
              top: 37,
              width: 12,
              height: 12,
              borderRadius: '50%',
              background: 'var(--color-accent)',
              transform: 'translateX(-50%)',
              boxShadow: '0 0 0 2px var(--color-bg)',
            }}
          />
          <div
            className="num"
            style={{
              position: 'absolute',
              left: 0,
              top: 54,
              transform: xToday > 88 ? 'translateX(-100%)' : 'translateX(-50%)',
              fontSize: '0.55rem',
              color: 'var(--color-dim)',
              whiteSpace: 'nowrap',
            }}
          >
            today
          </div>
        </div>

        {/* next milestone */}
        <div style={{ position: 'absolute', left: '100%', top: 0, width: 0 }}>
          <div
            className="num"
            style={{
              position: 'absolute',
              left: 0,
              top: 14,
              transform: 'translateX(-100%)',
              fontSize: '0.62rem',
              color: 'var(--color-dim)',
              whiteSpace: 'nowrap',
            }}
          >
            {fmtTokens(nextMilestone).replace('.00', '')}
          </div>
          <div
            aria-hidden
            style={{
              position: 'absolute',
              left: 0,
              top: 38,
              width: 8,
              height: 8,
              borderRadius: '50%',
              border: '1.5px solid var(--color-dim)',
              background: 'var(--color-bg)',
              transform: 'translateX(-50%)',
            }}
          />
          <div
            className="num"
            style={{
              position: 'absolute',
              left: 0,
              top: 54,
              transform: 'translateX(-100%)',
              fontSize: '0.55rem',
              color: 'var(--color-dim)',
              whiteSpace: 'nowrap',
            }}
          >
            {etaNext ? `${capped ? '→ ' : ''}~${etaNext} · at 30d pace` : 'no pace yet'}
          </div>
        </div>
      </div>

      <div
        className="num"
        style={{ display: 'flex', gap: 18, flexWrap: 'wrap', marginTop: 4, fontSize: '0.62rem', color: 'var(--color-dim)' }}
      >
        <span>
          pace · 7d <span style={{ color: 'var(--color-text)' }}>{perDay(pace.d7)}</span>
        </span>
        <span>
          30d <span style={{ color: 'var(--color-text)' }}>{perDay(pace.d30)}</span>
        </span>
        <span>
          lifetime <span style={{ color: 'var(--color-text)' }}>{perDay(pace.lifetime)}</span>
        </span>
        {etaNext && (
          <span>
            {fmtTokens(nextMilestone).replace('.00', '')} in{' '}
            <span style={{ color: 'var(--color-text)' }}>{fmtInt(daysBetween(today, etaNext))}d</span>
          </span>
        )}
      </div>
    </div>
  );
}
