import { formatCompact } from '@/lib/format';
import type { ProfileUser } from '@/lib/stats/profile-data';
import type { Tier } from '@/lib/stats/tier';
import type { Camp } from '@/lib/stats/team';

type Props = {
  user: ProfileUser;
  tier: Tier; // rolling-90-day tier
  rankMonth: number; // this-month token rank
  rankTotal: number; // players active this month
  isHandcoder: boolean;
  allTimeTokens: number;
  team: Camp | null;
  nowProject: string | null;
};

// Compact identity / orientation bar. Avatar + handle on the left; this-month
// rank (N / total), 90-day tier, all-time tokens, team on the right. Every
// number is monospace + solid high-contrast; foil only on the tier badge.
export function IdentityBar({ user, tier, rankMonth, rankTotal, isHandcoder, allTimeTokens, team, nowProject }: Props) {
  const tierLetter = tier === 'handcoder' ? 'HC' : tier.toUpperCase();
  const tierLabel = tier === 'handcoder' ? 'HANDCODER' : `${tier.toUpperCase()} TIER`;
  const teamColor = team === 'codex' ? 'var(--team-cx)' : 'var(--team-cc)';
  const teamLabel = team === 'codex' ? 'TEAM CODEX' : team === 'claude_code' ? 'TEAM CLAUDE CODE' : null;
  const noRank = isHandcoder && allTimeTokens === 0;

  return (
    <div
      className="neon-glass neon-enter"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 20,
        flexWrap: 'wrap',
        rowGap: 16,
        padding: 'clamp(16px, 3vw, 22px) clamp(18px, 4vw, 26px)',
        marginBottom: 28,
      }}
    >
      {/* left: identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: '50%',
            flexShrink: 0,
            background: user.avatar_url ? `url(${user.avatar_url}) center/cover` : 'var(--foil-gradient)',
            boxShadow: '0 0 18px var(--neon-glow-foil)',
          }}
        />
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 'clamp(18px, 3.5vw, 24px)', letterSpacing: '0.01em', lineHeight: 1.1 }}>
            @{user.github_handle}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 3, color: 'var(--neon-txt-dim)', fontFamily: 'var(--font-body)', fontSize: 14 }}>
            {user.display_name && <span>{user.display_name}</span>}
            {nowProject && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--team-cc)' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--team-cc)', animation: 'cc-pulse 1.5s ease-in-out infinite' }} />
                now: {nowProject}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* right: stat blocks */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(16px, 4vw, 30px)', flexWrap: 'wrap' }}>
        <Stat label="Rank · month" mono>
          {noRank ? '—' : (
            <span style={{ color: 'var(--neon-txt)' }}>
              {rankMonth}
              <span style={{ color: 'var(--neon-txt-dim)', fontWeight: 500 }}> / {rankTotal}</span>
            </span>
          )}
        </Stat>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div className="neon-tier-badge" style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0 }}>
            <span className="neon-tier-letter" style={{ fontSize: 18 }}>{tierLetter}</span>
          </div>
          <Stat label="Tier · 90d">
            <span className={tier === 'S' ? 'neon-foil-text-static' : undefined} style={{ fontFamily: 'var(--font-display)', color: tier === 'S' ? undefined : 'var(--neon-txt)', fontSize: 18 }}>
              {tierLabel}
            </span>
          </Stat>
        </div>

        <Stat label="All-time tokens" mono>
          <span style={{ color: 'var(--neon-txt)' }}>{formatCompact(allTimeTokens)}</span>
        </Stat>

        {teamLabel && (
          <Stat label="Team">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: teamColor, fontSize: 14, fontFamily: 'var(--font-display)' }}>
              <span style={{ width: 11, height: 11, borderRadius: 3, background: teamColor, boxShadow: `0 0 12px ${teamColor}` }} />
              {teamLabel}
            </span>
          </Stat>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--neon-txt-dim)' }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: mono ? 'var(--font-num)' : 'var(--font-display)',
          fontWeight: 700,
          fontSize: 21,
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1,
        }}
      >
        {children}
      </span>
    </div>
  );
}
