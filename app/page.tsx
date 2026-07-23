import Link from 'next/link';
import type { Metadata } from 'next';
import { todayLocal } from '@/lib/date';
import { createClient } from '@/lib/supabase/server';
import { getInsightsBundle } from '@/lib/insights/queries';
import {
  buildCallouts,
  buildHourlyAgg,
  buildModelEffectiveness,
  buildPlansSessions,
  buildProblems,
  buildProjectRows,
  buildSystemsBoard,
  buildTodaySummary,
  buildTrend,
} from '@/lib/insights/compute';
import { SOURCES } from '@/lib/insights/types';
import { TodayStrip } from '@/components/insights/TodayStrip';
import { InsightCallouts } from '@/components/insights/InsightCallouts';
import { PlansSessions } from '@/components/insights/PlansSessions';
import { ProblemsPanel } from '@/components/insights/ProblemsPanel';
import { SystemsBoard } from '@/components/insights/SystemsBoard';
import { ModelEffectiveness } from '@/components/insights/ModelEffectiveness';
import { ModelMixTrend } from '@/components/insights/ModelMixTrend';
import { HoursHeatmap } from '@/components/insights/HoursHeatmap';
import { ProjectBreakdown } from '@/components/insights/ProjectBreakdown';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';
const HEALTH_WINDOW = 30;

export const metadata: Metadata = {
  title: 'personal insights station · vibecodestats.dev',
  description:
    'A single-user terminal dashboard for LLM work: what plans get finished, which models work, what keeps breaking, and how the systems are running — across Claude Code, Codex, Grok, and Kimi.',
  alternates: { canonical: '/' },
};

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'vibecodestats.dev',
  alternateName: 'personal insights station',
  url: SITE_URL,
  description: 'Personal LLM-work insights station: outcomes, problems, and systems health.',
};

export default async function HomePage() {
  const supabase = await createClient();
  const today = todayLocal();
  const bundle = await getInsightsBundle(supabase, today);

  // ── Server-side compute (RSC) — everything derived once, here. ──────────────
  const todaySummary = buildTodaySummary(bundle.modelDaily, bundle.outcomes, today);
  const plans = buildPlansSessions(bundle.outcomes, today, 30);
  const problems = buildProblems(bundle.problems, today, 90);
  const systems = buildSystemsBoard(bundle.health, today, HEALTH_WINDOW);
  const callouts = buildCallouts(bundle.modelDaily, bundle.outcomes, bundle.problems, bundle.health, today);

  const effByWindow = {
    '7d': buildModelEffectiveness(bundle.modelDaily, bundle.outcomes, today, 7),
    '30d': buildModelEffectiveness(bundle.modelDaily, bundle.outcomes, today, 30),
  };

  const { points, models } = buildTrend(bundle.modelDaily);
  const hourlyAgg = buildHourlyAgg(bundle.hourly);

  const projByWindow = {
    '7d': buildProjectRows(bundle.projectModel, bundle.outcomes, today, 7),
    '30d': buildProjectRows(bundle.projectModel, bundle.outcomes, today, 30),
    '90d': buildProjectRows(bundle.projectModel, bundle.outcomes, today, 90),
  };

  const present = new Set<string>();
  for (const r of bundle.modelDaily) present.add(r.source);
  for (const r of bundle.hourly) present.add(r.source);
  const availableSources = SOURCES.filter((s) => present.has(s));

  const modelColors: Record<string, string> = Object.fromEntries(models.map((m) => [m.model, m.color]));

  return (
    <main
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '28px 20px 72px',
        fontFamily: 'var(--font-mono)',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(WEBSITE_JSONLD).replace(/</g, '\\u003c') }}
      />

      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <header style={{ marginBottom: 2 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.95rem', color: 'var(--color-orange)', fontWeight: 700, letterSpacing: '-0.01em' }}>
            vibecodestats.dev
          </span>
          <span className="term-eyebrow">personal insights station</span>
          <span className="term-cursor" aria-hidden style={{ color: 'var(--color-orange)' }}>
            _
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: 'var(--color-dim)', lineHeight: 1.5, maxWidth: 660 }}>
          What&apos;s getting finished, which models actually work, what keeps breaking, and how the systems are
          running — across Claude Code, Codex, Grok &amp; Kimi. Usage trends underneath.
        </p>
      </header>

      {!bundle.hasData && (
        <div
          className="term-panel"
          style={{ padding: '16px 18px', fontSize: '0.72rem', color: 'var(--color-dim)', lineHeight: 1.6 }}
        >
          <span style={{ color: 'var(--color-orange)' }}>›</span> No telemetry is readable yet. The station reads{' '}
          <code style={{ color: 'var(--color-text)' }}>session_outcomes</code>,{' '}
          <code style={{ color: 'var(--color-text)' }}>problem_events</code>,{' '}
          <code style={{ color: 'var(--color-text)' }}>system_health_daily</code>, and the{' '}
          <code style={{ color: 'var(--color-text)' }}>llm_*</code> usage tables. Every panel fills in automatically
          once data lands.
        </div>
      )}

      {bundle.hasData && !bundle.hasOutcomeData && (
        <div
          className="term-panel"
          style={{ padding: '12px 16px', fontSize: '0.68rem', color: 'var(--color-dim)', lineHeight: 1.5 }}
        >
          <span style={{ color: 'var(--color-orange)' }}>›</span> Usage data is live; the outcome / problem / systems
          miners are still populating (nightly + backfill in progress). Those panels fill in as rows land.
        </div>
      )}

      <InsightCallouts lines={callouts} />

      <TodayStrip summary={todaySummary} />

      <PlansSessions data={plans} />

      <ProblemsPanel problems={problems} today={today} />

      <SystemsBoard systems={systems} windowDays={HEALTH_WINDOW} />

      <ModelEffectiveness byWindow={effByWindow} />

      <ModelMixTrend points={points} models={models} today={today} availableSources={availableSources} />

      <div className="insights-two-col">
        <HoursHeatmap agg={hourlyAgg} today={today} availableSources={availableSources} />
        <ProjectBreakdown byWindow={projByWindow} modelColors={modelColors} />
      </div>

      {/* ── Footer (demoted routes live here, off the primary surface) ─────── */}
      <footer
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--color-border)',
          fontSize: '0.66rem',
          color: 'var(--color-dim)',
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <span style={{ color: 'var(--color-dim)' }}>America/New_York · reported by local day</span>
        <span style={{ display: 'flex', gap: 14, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Link href="/methodology" prefetch={false} style={{ color: 'inherit' }}>
            methodology
          </Link>
          <Link href="/leaderboard" prefetch={false} style={{ color: 'inherit' }}>
            leaderboard
          </Link>
          <Link href="/holden-alt" prefetch={false} style={{ color: 'inherit' }}>
            public profile
          </Link>
          <a href="https://github.com/holden-alt/vibecodestats" style={{ color: 'inherit' }}>
            github
          </a>
        </span>
      </footer>
    </main>
  );
}
