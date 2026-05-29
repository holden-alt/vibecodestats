import type { Metadata } from 'next';
import Link from 'next/link';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'How tiers and teams work — vibecodestats.dev',
  description:
    'How vibecodestats.dev assigns tiers (S/A/B/C/D/HANDCODER) and teams (Claude Code vs Codex). Pure percentile ranking against the active cohort. Token-derived team split.',
};

const sectionStyle: React.CSSProperties = { marginBottom: 40 };
const h2Style: React.CSSProperties = {
  fontSize: '1.1rem',
  margin: '0 0 12px',
  color: 'var(--chart-1)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
};
const codeBlock: React.CSSProperties = {
  fontFamily: 'ui-monospace, monospace',
  background: 'var(--color-bg-2)',
  border: '1px solid var(--color-border)',
  borderRadius: 3,
  padding: '12px 16px',
  fontSize: '0.78rem',
  whiteSpace: 'pre',
  overflowX: 'auto',
  lineHeight: 1.55,
};
const tierRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '100px 80px 1fr',
  gap: 16,
  padding: '12px 0',
  borderTop: '1px solid var(--color-border)',
  fontSize: '0.85rem',
  lineHeight: 1.5,
};

export default function MethodologyPage() {
  return (
    <main
      style={{
        maxWidth: 780,
        margin: '0 auto',
        padding: '48px 24px 96px',
        fontFamily: 'ui-monospace, monospace',
        color: 'var(--color-text)',
        lineHeight: 1.55,
      }}
    >
      <div style={{ fontSize: '0.65rem', opacity: 0.6, textTransform: 'uppercase', letterSpacing: '0.15em', color: 'var(--chart-1)' }}>
        methodology
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0 8px', letterSpacing: '-0.01em' }}>
        Tiers + Teams
      </h1>
      <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: '0 0 36px' }}>
        Your all-time tokens put you in a tier. Your model split puts you on a team.
        That&apos;s it. No composite score, no sigmoid formula, no five dimensions.
        Just your /usage, ranked against everyone who showed up.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>How tiers work</h2>
        <p>
          Your tier is a <strong>percentile</strong> against the active cohort
          (users who have real token activity on file). One metric drives it:
          all-time tokens, counted as{' '}
          <code>input + output + cache_creation + cache_read</code> (the{' '}
          <a href="https://github.com/ryoppippi/ccusage" style={{ color: 'var(--chart-2)' }}>ccusage</a>{' '}
          formula). No weights, no adjustments, no gaming the curve.
        </p>
        <p style={{ marginTop: 8 }}>
          Percentile is computed fresh against the active cohort on each load,
          so early-field noise never locks you into a wrong tier. The bands:
        </p>
        <div style={{ marginTop: 16 }}>
          <div style={{ ...tierRow, borderTop: 'none', fontWeight: 600, opacity: 0.55, fontSize: '0.75rem' }}>
            <div>TIER</div>
            <div>BAND</div>
            <div>WHAT IT MEANS</div>
          </div>
          <div style={tierRow}>
            <div style={{ color: 'var(--chart-1)', fontWeight: 700 }}>S</div>
            <div>Top 1%</div>
            <div>Lets it cook. One-shots SaaS apps at 3am and reviews the PRs while you sip coffee. The ceiling everyone else is measured against.</div>
          </div>
          <div style={tierRow}>
            <div style={{ color: 'var(--chart-1)', fontWeight: 700 }}>A</div>
            <div>Top 10%</div>
            <div>Dispatches agents in parallel worktrees and burns the rate limit by noon. One tier off cracking S and you know it.</div>
          </div>
          <div style={tierRow}>
            <div style={{ color: 'var(--chart-1)', fontWeight: 700 }}>B</div>
            <div>Top 40%</div>
            <div>Two-shots it on a good day. Survived context rot, hit /compact, lost the plot, shipped anyway. Respectable.</div>
          </div>
          <div style={tierRow}>
            <div style={{ color: 'var(--chart-1)', fontWeight: 700 }}>C</div>
            <div>Top 75%</div>
            <div>Opens the agent when stuck, closes it when nervous. The come-up is right there. You just keep closing the tab.</div>
          </div>
          <div style={tierRow}>
            <div style={{ color: 'var(--chart-1)', fontWeight: 700 }}>D</div>
            <div>75-90%</div>
            <div>Showed up to the casino, bought one chip. One bad week from the handcoder label. Pick a team and actually play.</div>
          </div>
          <div style={tierRow}>
            <div style={{ color: 'var(--chart-3)', fontWeight: 700 }}>HANDCODER</div>
            <div>Bottom 10%</div>
            <div>
              Bottom 10% of the active field, or zero AI tokens on file. Two sub-cases:
              if you have zero tokens, there&apos;s nothing to rank. If you have tokens
              but land in the bottom 10%, you out-purist Linus Torvalds, and he caved.
              Pick a team and climb.
            </div>
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>The token count</h2>
        <pre style={codeBlock}>{`all_time_tokens = SUM(
  input_tokens
  + output_tokens
  + cache_creation_tokens
  + cache_read_tokens
)`}</pre>
        <p style={{ marginTop: 14 }}>
          This is the ccusage formula, applied across every session ever ingested.
          Cache reads count because they represent real context load, even if the
          tokens were created in a prior session. All-time volume is the right
          signal for a leaderboard: it captures who has been in the trenches the
          longest, not just who had the biggest single day.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Team Claude Code vs Team Codex</h2>
        <p>
          At signup you pick a camp. The split is derived from your token data:
        </p>
        <ul style={{ paddingLeft: 18, lineHeight: 1.7, marginTop: 8 }}>
          <li>
            <strong>Team Codex</strong> — tokens from <code>gpt-*</code> models
            (OpenAI&apos;s Codex and GPT family). If your <code>tokens_by_model</code>{' '}
            breakdown shows a heavy <code>gpt-*</code> footprint, you belong here.
          </li>
          <li>
            <strong>Team Claude Code</strong> — everything else. Sonnet, Opus, Haiku,
            any non-gpt-* model routed through Claude Code.
          </li>
        </ul>
        <p style={{ marginTop: 8 }}>
          A <strong>live daily Team Scoreboard</strong> sums each camp&apos;s tokens
          across the entire field and shows the running split. It swings. Check it
          daily or don&apos;t, but your team&apos;s position is never static.
        </p>
        <p style={{ marginTop: 8 }}>
          You get <strong>one free switch per month</strong> (rolling 30 days). A
          switch earns you a <strong>DEFECTOR</strong> badge for a window. Bold move.
          We saw that.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What drives the card</h2>
        <p>
          Your OG card shows: all-time tokens (the hero number), your tier letter,
          your global rank, your percentile, your team chip, and supporting stats
          (peak day, sessions, active days). The gap to your next tier is visible
          on the card so you know exactly what it takes to climb.
        </p>
        <p style={{ marginTop: 8 }}>
          One number, one letter. Your /usage says everything. So does your tier.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What this is not</h2>
        <p>
          Not a measure of code quality. Not a productivity score. Not a claim
          that more tokens means better work. It&apos;s a tokenmaxxing leaderboard:
          you showed up, you burned tokens, here is where you rank against everyone
          else who did the same. The flex is the number; the tier is the context.
        </p>
        <p style={{ marginTop: 8 }}>
          Holden is #1 global at 4.84B all-time tokens, S-tier, Team Claude Code.
          That&apos;s the anchor the top 1% is measured against.
        </p>
      </section>

      <p style={{ marginTop: 48, fontSize: '0.78rem', opacity: 0.6 }}>
        Questions, calibration feels off, found a gaming exploit? Open an issue at{' '}
        <a href="https://github.com/holden-alt/vibecodestats" style={{ color: 'var(--chart-2)' }}>
          github.com/holden-alt/vibecodestats
        </a>
        .{' '}
        <Link href="/" style={{ color: 'var(--chart-1)' }}>{'<- back to dashboard'}</Link>
      </p>
    </main>
  );
}
