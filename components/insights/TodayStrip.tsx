import { SOURCE_COLOR, SOURCE_LABEL, type TodaySummary } from '@/lib/insights/types';
import { fmtCost, fmtDuration, fmtInt, fmtTokens } from '@/lib/insights/format';

// Today strip — the current LOCAL day's usage: tokens (per source), active
// time, cost, ships. Server-rendered. The hero number is the panel's one amber
// moment.
export function TodayStrip({ summary }: { summary: TodaySummary }) {
  const empty = summary.totalTokens === 0 && summary.totalActiveMinutes === 0;

  return (
    <section
      className="term-panel term-panel-raised"
      style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 16 }}
    >
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <h2 className="panel-title" style={{ margin: 0 }}>
          Today
        </h2>
        <span className="term-eyebrow" style={{ textTransform: 'none', letterSpacing: '0.02em' }}>
          {summary.date} · America/New_York
        </span>
        <span
          className={empty ? undefined : 'station-pulse'}
          aria-hidden
          style={{
            marginLeft: 'auto',
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: empty ? 'var(--color-dim-2)' : 'var(--color-green)',
          }}
        />
      </header>

      <div style={{ display: 'flex', alignItems: 'flex-end', flexWrap: 'wrap', gap: '10px 30px' }}>
        <div>
          <div
            className="num"
            style={{
              fontSize: 'clamp(2rem, 8vw, 3rem)',
              fontWeight: 600,
              lineHeight: 1,
              color: 'var(--color-accent)',
              letterSpacing: '-0.02em',
            }}
          >
            {fmtTokens(summary.totalTokens)}
          </div>
          <div className="term-eyebrow" style={{ marginTop: 6 }}>
            tokens today
          </div>
        </div>

        <Stat label="active" value={fmtDuration(summary.totalActiveMinutes)} />
        <Stat label="ships" value={summary.commits == null ? '—' : fmtInt(summary.commits)} dim={summary.commits == null} />
        <Stat label="cost" value={fmtCost(summary.cost)} dim={summary.cost == null} />
      </div>

      {summary.bySource.length > 0 ? (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {summary.bySource.map((s) => (
            <span
              key={s.source}
              className="num"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 7,
                border: '1px solid var(--color-border)',
                borderRadius: 3,
                padding: '4px 9px',
                fontSize: '0.66rem',
              }}
            >
              <span
                aria-hidden
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: '50%',
                  background: SOURCE_COLOR[s.source] ?? 'var(--color-dim)',
                }}
              />
              <span style={{ color: 'var(--color-dim)' }}>{SOURCE_LABEL[s.source] ?? s.source}</span>
              <span style={{ color: 'var(--color-text)' }}>{fmtTokens(s.tokens)}</span>
            </span>
          ))}
        </div>
      ) : (
        <div style={{ fontSize: '0.74rem', color: 'var(--color-dim)' }}>No activity recorded yet today.</div>
      )}
    </section>
  );
}

function Stat({ label, value, dim }: { label: string; value: string; dim?: boolean | undefined }) {
  return (
    <div>
      <div
        className="num"
        style={{
          fontSize: '1.15rem',
          fontWeight: 500,
          lineHeight: 1.1,
          color: dim ? 'var(--color-dim)' : 'var(--color-text)',
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
