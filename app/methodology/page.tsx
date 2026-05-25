import type { Metadata } from 'next';
import Link from 'next/link';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Vibewatts (VBW) methodology — vibecodestats.dev',
  description:
    'How vibecodestats.dev computes the Vibewatts (VBW) productivity score. Sigmoid-anchored dimensions, weighted-additive composite, diversity multiplier, soft penalty, personal-percentile sub-display, gaming-resistance.',
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
const dimRow: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
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
        methodology · v2
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0 8px', letterSpacing: '-0.01em' }}>
        Vibewatts (VBW)
      </h1>
      <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: '0 0 36px' }}>
        VBW is an absolute, cross-user-comparable AI-productivity score, 0–10,000 per day.
        The headline token number on every profile measures <em>volume</em>; VBW measures how
        much actual work got done across five dimensions, with the leaderboard ranked by 7-day
        rolling average so consistency wins over flash.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What changed in v2 (2026-05-25)</h2>
        <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>Per-dimension curve:</strong> log-against-absolute-ceiling →{' '}
            <strong>sigmoid centered on a typical heavy day</strong>. v1 saturated near 100
            for every active day; v2 keeps full 0–100 resolution across the realistic input range.
          </li>
          <li>
            <strong>Aggregation:</strong> geometric mean → <strong>weighted additive +
            diversity multiplier + soft penalty</strong>. v1 had a one-zero-kill (no commits →
            score = 0, even with a heavy research day). v2 hurts low dimensions but never
            zeroes the score.
          </li>
          <li>
            <strong>Streak:</strong> max +10% at 10 days → <strong>max +5% at 10 days</strong>.
            Streak nudges, doesn&apos;t dominate.
          </li>
          <li>
            <strong>Leaderboard ranking:</strong> single-day VBW → <strong>7-day rolling
            mean VBW</strong>. Smooths anomalies, rewards consistent vibecoders.
          </li>
          <li>
            <strong>New display: &quot;P64 vs you&quot;</strong> percentile under each
            dimension. Personal-baseline. Doesn&apos;t affect the score (leaderboard stays
            cross-user-comparable).
          </li>
          <li>
            <strong>New display: &quot;1.3× by this hour&quot;</strong> pace indicator next
            to the VBW headline. Anchors live cumulative against your typical
            cumulative-by-this-hour over the last 30 days.
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Why not just count tokens?</h2>
        <p>
          The token number on a profile uses the{' '}
          <a href="https://github.com/ryoppippi/ccusage" style={{ color: 'var(--chart-2)' }}>ccusage</a>{' '}
          formula: <code>input + output + cache_creation + cache_read</code>. Cache reads
          usually dominate — they&apos;re the cost of carrying conversation state, not work
          you&apos;re doing. A 4-hour session re-reading the same 150K context dwarfs a
          1-hour session that shipped real code.
        </p>
        <p style={{ marginTop: 8 }}>
          <a href="https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/" style={{ color: 'var(--chart-2)' }}>METR&apos;s 2025 randomized study</a>{' '}
          of 16 experienced developers found that AI usage made them <strong>19% slower</strong>{' '}
          on real tasks, even though they <em>felt</em> 20% faster. Self-reported AI
          productivity is structurally unreliable. VBW anchors on observable artifacts
          instead — five separate signals, each hard to fake.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>The 5 dimensions (sigmoid)</h2>
        <p style={{ fontSize: '0.85rem', opacity: 0.75 }}>
          Each dimension is mapped to a 0–100 score by a logistic sigmoid centered on a
          &quot;typical heavy day&quot; anchor. A score of 50 = a typical-heavy-day input;
          70 = solidly above; 90+ = genuinely outsized. Anchors live in the{' '}
          <code>dim_anchor</code> table and are recalibrated as the platform&apos;s top-end
          shifts (currently set against the founder&apos;s actual 30-day distribution).
        </p>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Output</div>
          <div>
            <code>score = 100 / (1 + exp(-1.2 × (log₁₀(output_tokens + 1) − 6.0)))</code>
            <br />Tokens Claude generated for you. Anchor 50 ≈ 1M output tokens (a heavy day).
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Substance</div>
          <div>
            <code>score = 100 / (1 + exp(-1.5 × (log₁₀(cache_creation + 1) − 7.0)))</code>
            <br />New material you fed Claude. Anchor 50 ≈ 10M cache_creation tokens.
            Excludes cache reads — those are just re-reading what you already established.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Tools</div>
          <div>
            <code>score = 100 / (1 + exp(-1.5 × (log₁₀(tool_calls + 1) − 3.0)))</code>
            <br />Concrete actions Claude executed. Anchor 50 ≈ 1,000 tool calls.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Ships</div>
          <div>
            <code>score = 100 / (1 + exp(-1.5 × (log₁₀(ship_quality + 1) − 1.7)))</code>
            <br />Real shipped code, quality-weighted.{' '}
            <code>ship_quality = Σ log₁₀(lines + 1) × files × non_test_ratio</code>{' '}
            (per-commit cap 20). Anchor 50 ≈ 50 ship_quality.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Depth</div>
          <div>
            <code>score = 100 / (1 + exp(-1.3 × (log₁₀(deep_work_minutes + 1) − 2.5)))</code>
            <br />Focus time — sessions broken by gaps under 15 minutes stay connected;
            longer gaps reset. Anchor 50 ≈ 316 minutes (~5.3 hours).
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>The aggregation</h2>
        <pre style={codeBlock}>{`base       = 0.20·Output + 0.20·Substance + 0.15·Tools + 0.25·Ships + 0.20·Depth

# diversity = clamp(0.5, 1.1, sqrt(geom_mean(s+1) / arith_mean(s+1)))
diversity  = clamp[0.5, 1.1]  √( GM(scores+1) / AM(scores+1) )

# soft penalty for each dim below 20 (replaces v1's one-zero-kill)
penalty    = 0.94 ^ count(s < 20)

# small consistency bonus
streak     = 1 + min(0.05, consecutive_days × 0.005)   # max +5% at day 10

VBW        = clamp(0, 10000)( base × diversity × penalty × streak × 100 )`}</pre>
        <p style={{ marginTop: 14 }}>
          <strong>Why weighted additive over geometric mean?</strong> v1&apos;s geo-mean
          one-zero-killed entire days. A 344M-token research day with no commits scored 0,
          which is wrong — that&apos;s a productive day. v2 still hurts you for zeros (via
          the soft penalty and diversity multiplier), but doesn&apos;t nuke. <strong>FICO</strong>{' '}
          uses a similar &quot;reason codes that penalize, never zero out&quot; logic.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>Why diversity at sqrt(GM/AM)?</strong> When all dims are equal, GM = AM
          and the multiplier is 1.0. When one dim dominates, GM &lt;&lt; AM and the
          multiplier shrinks. The 0.5 floor means a one-dimensional &quot;hero&quot; day
          still gets meaningful but capped credit. <strong>ESPN QBR</strong> uses similar
          situational adjustments to prevent stat-padding.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>The two displays you see</h2>
        <p>
          <strong>VBW (the headline number)</strong> is absolute and cross-user-comparable.
          The all-time #1 spot belongs to whoever objectively did the most work, the way
          Strava KOM cares about wall-clock time up the climb (not how it compares to your
          own zones).
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>&quot;P64 vs you&quot;</strong> next to each dimension is a personal-baseline
          percentile (robust z-score against your last 30 days, mapped to 0–100 via logistic
          CDF). It tells you whether today was strong <em>for you</em>. It does NOT feed
          the VBW score — so the leaderboard stays a real competition. This is the same
          two-track approach <strong>Whoop</strong> uses: personalized Strain alongside an
          absolute peak-strain record.
        </p>
        <p style={{ marginTop: 8 }}>
          <strong>&quot;1.3× by this hour&quot;</strong> projects today&apos;s cumulative
          token volume against your typical cumulative at this same UTC hour over the last
          30 days. Solves the &quot;it&apos;s 12:30am and my dimensions are already 80&quot;
          puzzle. Doesn&apos;t feed the VBW score either.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Leaderboard ranking</h2>
        <p>
          The leaderboard ranks by <strong>7-day rolling mean VBW</strong>, not single-day.
          Smooths one-off anomalies, rewards consistency, and keeps the result on the same
          0–10K scale. Tabs let you switch to today, month, or all-time. This is{' '}
          <strong>Strava&apos;s Fitness/Form</strong> logic applied to coding: recent
          sustained intensity matters more than your single best Tuesday.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Gaming-resistance audit</h2>
        <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>Token spam</strong> → sigmoid&apos;s asymptotic top (90+ requires
            genuinely outsized inputs) + low weight (0.20) + diversity multiplier dampens
            single-dim inflation. <em>Prior art: Stack Overflow rep cap, FICO scorecard
            compression.</em>
          </li>
          <li>
            <strong>Micro-commits</strong> → per-commit ship_quality capped at 20, plus
            <code> non_test_ratio</code> discount for test-only commits, then log-transformed
            again at the sum level. <em>Prior art: WikiTrust survival-based reputation.</em>
          </li>
          <li>
            <strong>Idle &quot;deep work&quot; inflation</strong> → deep_work_minutes is
            computed client-side from gap-filtered active intervals (15-minute gap = reset).
            <em>Prior art: Whoop Strain intensity weighting, Strava Relative Effort.</em>
          </li>
          <li>
            <strong>Sandbagging then a hero day</strong> → personal-percentile uses ±2.5σ
            z-score clipping, so a single peak day caps at ~P85 vs you (and the absolute
            VBW score is unaffected by sandbagging anyway).{' '}
            <em>Prior art: ESPN QBR garbage-time down-weighting.</em>
          </li>
        </ul>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Calibration</h2>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
              <th style={{ padding: '8px 4px', opacity: 0.55, fontWeight: 400 }}>Day shape</th>
              <th style={{ padding: '8px 4px', opacity: 0.55, fontWeight: 400 }}>Expected VBW</th>
            </tr>
          </thead>
          <tbody>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Genuinely outsized day — record-territory across multiple dims</td>
              <td style={{ padding: '8px 4px', color: 'var(--chart-3)' }}>7,500–10,000</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Heavy day — multi-tool agentic flow, lots of ships</td>
              <td style={{ padding: '8px 4px', color: 'var(--chart-3)' }}>5,000–7,500</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Average focused day</td>
              <td style={{ padding: '8px 4px', color: 'var(--chart-2)' }}>3,500–5,000</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Research-only day (no commits)</td>
              <td style={{ padding: '8px 4px' }}>2,000–4,000</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Light day — a few prompts, no commits</td>
              <td style={{ padding: '8px 4px' }}>500–1,500</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 4px' }}>Bot pattern — tool spam, zero ships/output</td>
              <td style={{ padding: '8px 4px', color: 'var(--color-dim)' }}>under 2,000 (penalized, but not zero)</td>
            </tr>
          </tbody>
        </table>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>How VBW aggregates across time</h2>
        <p>
          Tokens, sessions, and ships are <em>cumulative volumes</em> — summing
          them across a week gives a meaningful weekly total. VBW is different:
          it&apos;s a normalized 0–10,000 daily score, so summing it would produce
          an arbitrary unbounded number that scales with window length.
        </p>
        <p style={{ marginTop: 8 }}>
          Instead, week / month / year VBW is the <strong>mean across every day
          in the window</strong> (rest days included). That keeps every window
          on the same 0–10,000 scale and gives an honest read of typical daily
          productivity: a 9,000-VBW Tuesday gets dragged down by a Sunday off.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Anchor recalibration over time</h2>
        <p>
          The dimension anchors (1M output, 10M cache_creation, 1K tools,
          50 ship_quality, 316 min depth) are <strong>platform-wide constants</strong>{' '}
          stored in the <code>dim_anchor</code> table. They represent a typical-heavy-day
          input for an active vibecoder.
        </p>
        <p style={{ marginTop: 8 }}>
          As the platform&apos;s top-end shifts, the anchors will be recomputed quarterly
          to the median of all-users&apos; all-time-best-per-dimension. Old VBW scores
          re-evaluate, so the leaderboard reflects current platform reality. The all-time #1
          spot belongs to whoever genuinely had the biggest day across all 5 dimensions.
          This is what <strong>FICO</strong> and <strong>ESPN QBR</strong> do as their
          underlying populations shift.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What this is not</h2>
        <p>
          VBW is not a measure of <em>code quality</em>. It&apos;s not a substitute for
          your judgment, your taste, or your manager&apos;s code review. It&apos;s a leading
          indicator that you <em>showed up and did the work</em>, the same way Strava
          measures you ran the route — not whether you ran it well.
        </p>
        <p style={{ marginTop: 8 }}>
          Framework references for the curious:{' '}
          <a href="https://www.microsoft.com/en-us/research/publication/the-space-of-developer-productivity-theres-more-to-it-than-you-think/" style={{ color: 'var(--chart-2)' }}>SPACE</a>{' '}
          (Microsoft Research, 2021),{' '}
          <a href="https://dora.dev/guides/dora-metrics/" style={{ color: 'var(--chart-2)' }}>DORA metrics</a>,{' '}
          <a href="https://www.myfico.com/credit-education/whats-in-your-credit-score" style={{ color: 'var(--chart-2)' }}>FICO scoring</a>,{' '}
          <a href="https://en.wikipedia.org/wiki/Total_quarterback_rating" style={{ color: 'var(--chart-2)' }}>ESPN QBR</a>.
        </p>
      </section>

      <p style={{ marginTop: 48, fontSize: '0.78rem', opacity: 0.6 }}>
        Questions, gaming exploits found, calibration feels off? Open an issue at{' '}
        <a href="https://github.com/holden-alt/vibecodestats" style={{ color: 'var(--chart-2)' }}>
          github.com/holden-alt/vibecodestats
        </a>
        .{' '}
        <Link href="/" style={{ color: 'var(--chart-1)' }}>← back to dashboard</Link>
      </p>
    </main>
  );
}
