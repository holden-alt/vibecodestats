import type { ProfileUser } from '@/lib/stats/profile-data';
import type { Tier, TierGap } from '@/lib/stats/tier';
import type { Camp } from '@/lib/stats/team';
import { formatCompact } from '@/lib/format';

type Props = {
  user: ProfileUser;
  rank: number | null;
  squadSize: number | null;
  tier: Tier;
  team: Camp | null;
  gap: TierGap;
  streakDays: number;
  nowProject: string | null;
};

export function IdentityStrip({ user, rank, squadSize, tier, team, gap, streakDays, nowProject }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-2)',
        borderRadius: 3,
        flexWrap: 'wrap',
        rowGap: 6,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: user.avatar_url
            ? `url(${user.avatar_url}) center/cover`
            : 'linear-gradient(135deg, var(--chart-4), var(--chart-1))',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.85rem' }}>@{user.github_handle}</span>
        {user.display_name && (
          <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>{user.display_name}</span>
        )}
      </div>
      {user.primary_persona && (
        <span style={pill('var(--chart-4)', true)}>{user.primary_persona}</span>
      )}
      {user.secondary_personas.slice(0, 2).map((p) => (
        <span key={p} style={pill('var(--chart-2)', false)}>{p}</span>
      ))}
      <div style={{
        marginLeft: 'auto',
        display: 'flex',
        gap: 6,
        alignItems: 'center',
        flexWrap: 'wrap',
        rowGap: 4,
        minWidth: 0,
        maxWidth: '100%',
      }}>
        {rank != null && squadSize != null && (
          <span style={pill('var(--chart-5)', true)}>rank #{rank} / {squadSize}</span>
        )}
        <span
          className={tier === 'S' ? 'foil tier-reveal tier-reveal-s' : 'tier-reveal'}
          style={tier === 'S'
            ? { ...pill('var(--chart-5)', true), background: undefined, fontWeight: 700 }
            : { ...pill('var(--chart-5)', true), fontWeight: 700 }}
        >
          {tier === 'handcoder' ? 'HANDCODER' : tier.toUpperCase()}
        </span>
        {team != null && (
          <span style={pill(team === 'codex' ? 'var(--team-cx-color)' : 'var(--team-cc-color)', false)}>
            {team === 'codex' ? 'TEAM CODEX' : 'TEAM CLAUDE CODE'}
          </span>
        )}
        {gap.nextTier != null && (
          <span style={{ fontSize: '0.65rem', opacity: 0.7, fontFamily: 'ui-monospace, monospace' }}>
            {formatCompact(gap.tokensNeeded)} from {gap.nextTier.toUpperCase()}
          </span>
        )}
        <span style={pill('var(--chart-3)', true)}>{streakDays}d streak</span>
        {nowProject && (
          <span style={{
            ...pill('var(--chart-4)', false),
            border: '1px dashed var(--chart-4)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            minWidth: 0,
            maxWidth: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            <span style={{ flexShrink: 0, width: 6, height: 6, borderRadius: '50%', background: 'var(--chart-4)', animation: 'cc-pulse 1.5s ease-in-out infinite' }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>now: {nowProject}</span>
          </span>
        )}
      </div>
    </div>
  );
}

function pill(color: string, filled: boolean): React.CSSProperties {
  return {
    fontSize: '0.65rem',
    padding: '2px 6px',
    borderRadius: 2,
    background: filled ? color : 'transparent',
    color: filled ? 'var(--color-bg)' : color,
    border: filled ? 'none' : `1px solid ${color}`,
    fontFamily: 'ui-monospace, monospace',
  };
}
