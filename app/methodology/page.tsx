import type { Metadata } from 'next';
import Link from 'next/link';

export const runtime = 'edge';

export const metadata: Metadata = {
  title: 'Vibewatts (VBW) methodology — vibecodestats.dev',
  description:
    'How vibecodestats.dev computes the Vibewatts (VBW) productivity score. Five dimensions, geometric mean, gaming-resistance, anti-bot tactics.',
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
        methodology
      </div>
      <h1 style={{ fontSize: '2rem', fontWeight: 700, margin: '8px 0 8px', letterSpacing: '-0.01em' }}>
        Vibewatts (VBW)
      </h1>
      <p style={{ fontSize: '0.95rem', opacity: 0.8, margin: '0 0 36px' }}>
        VBW is a composite AI-productivity score, 0–10,000 per day. The headline
        token number on every profile measures <em>volume</em> — VBW measures how
        much actual work got done. Both are shown side by side because both matter
        to a different audience.
      </p>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Why not just count tokens?</h2>
        <p>
          The token number on a profile uses the{' '}
          <a href="https://github.com/ryoppippi/ccusage" style={{ color: 'var(--chart-2)' }}>ccusage</a>{' '}
          formula: <code>input + output + cache_creation + cache_read</code>. Cache reads
          usually dominate — they’re the cost of carrying conversation state, not work
          you’re doing. A 4-hour session re-reading the same 150K context dwarfs a
          1-hour session that shipped real code.
        </p>
        <p style={{ marginTop: 8 }}>
          <a href="https://metr.org/blog/2025-07-10-early-2025-ai-experienced-os-dev-study/" style={{ color: 'var(--chart-2)' }}>METR’s 2025 randomized study</a>{' '}
          of 16 experienced developers found that AI usage made them <strong>19% slower</strong>{' '}
          on real tasks, even though they <em>felt</em> 20% faster. Self-reported AI
          productivity is structurally unreliable. VBW anchors on observable artifacts
          instead — five separate signals, each hard to fake.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>The 5 dimensions</h2>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Output</div>
          <div>
            <code>log₁₀(output_tokens + 1) × 16.67</code>, clamped 0–100.
            <br />Tokens Claude generated for you. Log curve so spamming long replies
            doesn’t scale.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Substance</div>
          <div>
            <code>log₁₀(cache_creation_tokens + 1) × 12.5</code>, clamped 0–100.
            <br />New material you fed Claude (files read, big prompts). Excludes cache
            reads — those are just re-reading what you already established.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Tools</div>
          <div>
            <code>log₁₀(tool_use_blocks + 1) × 25</code>, clamped 0–100.
            <br />Concrete actions Claude executed — edits, runs, queries. Spamming
            1,000 trivial reads gives roughly the same score as 10 meaningful ones.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Ships</div>
          <div>
            <code>Σ log₁₀(lines + 1) × files × non_test_ratio</code>, per-commit cap 20.
            <br />Real shipped code, quality-weighted. A README-only commit scores
            near zero; a 5-file refactor scores high. Test-only commits are
            discounted.
          </div>
        </div>
        <div style={dimRow}>
          <div style={{ color: 'var(--chart-1)' }}>Depth</div>
          <div>
            <code>deep_work_minutes / 6</code>, clamped 0–100.
            <br />Focus time — sessions broken by gaps under 15 minutes stay
            connected; longer gaps reset. 10 hours of focused work caps the dimension.
          </div>
        </div>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>The formula</h2>
        <pre style={codeBlock}>{`base    = geo_mean(Output, Substance, Tools, Ships, Depth)
streak  = 1.0 + min(0.1, consecutive_days × 0.01)   # max 1.1× at 10 days
VBW     = clamp(0, 10000)( base × streak × 100 )`}</pre>
        <p style={{ marginTop: 14 }}>
          The <strong>geometric mean</strong> is the load-bearing choice. A zero on
          any one dimension wrecks the score — you can’t leaderboard your way up by
          hyper-specializing in tokens while shipping nothing, or shipping a lot
          while never opening Claude. FICO does the same thing with its weighted
          categories: every category has to be present.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>Gaming-resistance — what we learned from others</h2>
        <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
          <li>
            <strong>Stack Overflow</strong> caps daily reputation at +200 to stop
            voting rings — we cap each dimension at 100 and the daily score at 10,000.
          </li>
          <li>
            <strong>ESPN’s QBR</strong> only <em>down-weights</em> low-leverage plays;
            it never <em>up-weights</em> clutch. We follow the same rule: the score
            can be reduced (low-quality ships, test-only commits) but never boosted
            beyond what the dimensions earn.
          </li>
          <li>
            <strong>WikiTrust</strong> measures editor reputation by how long
            contributions <em>survive</em>, not how many edits they make. Our v2 plan
            applies a 7-day commit-revert check on Ships — coming soon.
          </li>
          <li>
            <strong>FICO</strong> publishes its weight categories but keeps exact
            anomaly thresholds private. We publish the formula above and reserve
            adversarial audit (top-100 only) for behind the scenes.
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
              <td style={{ padding: '8px 4px' }}>Heavy day — multi-tool agentic flow, lots of ships</td>
              <td style={{ padding: '8px 4px', color: 'var(--chart-3)' }}>7,000–9,500</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Average focused day</td>
              <td style={{ padding: '8px 4px', color: 'var(--chart-2)' }}>3,000–5,000</td>
            </tr>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <td style={{ padding: '8px 4px' }}>Light day — a few prompts, no commits</td>
              <td style={{ padding: '8px 4px' }}>300–800</td>
            </tr>
            <tr>
              <td style={{ padding: '8px 4px' }}>Bot pattern — tool spam, zero ships/output</td>
              <td style={{ padding: '8px 4px', color: 'var(--color-dim)' }}>0–200</td>
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
        <h2 style={h2Style}>Threshold calibration & recalibration</h2>
        <p>
          The dimension thresholds (10⁶ output, 10⁸ cache_creation, 10⁴ tools,
          100 ship_quality, 600 min depth) are <strong>absolute ceilings</strong>{' '}
          chosen to represent a physically heavy day on Claude Code, not a
          population percentile. With one active user on the platform, that&apos;s
          the only honest anchor.
        </p>
        <p style={{ marginTop: 8 }}>
          When the platform crosses <strong>50+ active users for 30+ days</strong>,
          these thresholds will <strong>rebase to the population</strong>: the
          95th percentile of daily scores will become the new dimension cap,
          recomputed quarterly. This is what FICO and ESPN QBR do as their
          underlying populations shift. Until then: thresholds stay fixed and
          this section gets updated when they change.
        </p>
      </section>

      <section style={sectionStyle}>
        <h2 style={h2Style}>What this is not</h2>
        <p>
          VBW is not a measure of <em>code quality</em>. It’s not a substitute for
          your judgment, your taste, or your manager’s code review. It’s a leading
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
