import type { RankedEntry } from '@/lib/stats/leaderboard';
import type { Tier } from '@/lib/stats/tier';
import { formatValue } from '@/components/leaderboard/format';

type RankListProps = {
  entries: RankedEntry[];
};

// Tier -> neon accent. S/A lean foil-warm (Claude), B/C/D cool (Codex), and the
// handcoder badge stays dim. Used for the small tier-badge square on each row.
const TIER_ACCENT: Record<Tier, string> = {
  S: 'var(--team-cc)',
  A: 'var(--team-cc)',
  B: 'var(--team-cx)',
  C: 'var(--team-cx)',
  D: 'var(--neon-txt-dim)',
  handcoder: 'var(--neon-txt-dim)',
};

function tierLetter(tier: Tier): string {
  return tier === 'handcoder' ? 'HC' : tier.toUpperCase();
}

export function RankList({ entries }: RankListProps) {
  if (entries.length === 0) {
    return (
      <div
        data-empty
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 13,
          letterSpacing: '0.04em',
          padding: '28px 0',
          textAlign: 'center',
          color: 'var(--neon-txt-dim)',
        }}
      >
        no one in this scope yet
      </div>
    );
  }
  return (
    <div
      style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
      role="list"
      aria-label="leaderboard ranking"
    >
      {entries.map((e, i) => {
        const isFirst = e.rank === 1;
        const isHandcoder = e.tier === 'handcoder';
        const accent = TIER_ACCENT[e.tier];
        return (
          <div
            key={e.userId}
            data-rank-row
            data-rank={e.rank}
            data-handle={e.handle}
            data-viewer={e.isViewer}
            role="listitem"
            className="foil-hover neon-row neon-row-in"
            style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr auto auto',
              alignItems: 'center',
              gap: 14,
              padding: '14px 18px',
              borderRadius: 16,
              // Stagger the one-shot row-in entrance; cap so long lists settle fast.
              animationDelay: `${Math.min(i, 12) * 0.06}s`,
              background: e.isViewer
                ? 'rgba(255,138,60,0.10)'
                : 'rgba(14,7,24,0.6)',
              border: `1px solid ${e.isViewer ? 'rgba(255,138,60,0.45)' : 'var(--neon-line)'}`,
              color: 'var(--neon-txt)',
            }}
          >
            {/* Rank number — Orbitron; #1 gets the static foil fill */}
            <span
              className={isFirst ? 'neon-foil-text-static' : undefined}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 22,
                textAlign: 'center',
                color: isFirst ? undefined : 'var(--neon-txt-dim)',
              }}
            >
              {e.rank}
            </span>

            {/* Handle + viewer hint */}
            <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span
                title={e.handle}
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 700,
                  fontSize: 16,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {e.displayName ?? e.handle}
                {e.isViewer && (
                  <span style={{ color: 'var(--team-cc)', fontWeight: 600 }}> · you</span>
                )}
              </span>
            </span>

            {/* Tokens / metric value — Orbitron; #1 gets the foil flow */}
            <span
              className={isFirst ? 'neon-foil-text' : undefined}
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 800,
                fontSize: 18,
                textAlign: 'right',
                fontVariantNumeric: 'tabular-nums',
                color: isFirst ? undefined : isHandcoder ? 'var(--neon-txt-dim)' : 'var(--neon-txt)',
              }}
            >
              {formatValue(e.value)}
            </span>

            {/* Tier accent badge — letter only; #1 foil, handcoder dim */}
            <span
              className={isFirst ? 'neon-foil-text-static' : undefined}
              aria-hidden="true"
              style={{
                fontFamily: 'var(--font-display)',
                fontWeight: 900,
                fontSize: 13,
                width: 34,
                height: 34,
                borderRadius: 9,
                display: 'grid',
                placeItems: 'center',
                color: isFirst ? undefined : isHandcoder ? 'var(--neon-txt-dim)' : '#0a0010',
                background: isFirst
                  ? 'rgba(255,255,255,0.06)'
                  : isHandcoder
                    ? 'rgba(255,255,255,0.07)'
                    : accent,
                boxShadow: isFirst || isHandcoder ? 'none' : `0 0 16px ${accent}`,
              }}
            >
              {tierLetter(e.tier)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
