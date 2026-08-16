import Link from 'next/link';
import type { Metadata } from 'next';
import { todayLocal } from '@/lib/date';
import { createClient } from '@/lib/db/server';
import { getInsightsBundle } from '@/lib/insights/queries';
import {
  buildEfficiency,
  buildHourlyAgg,
  buildProjectRows,
  buildRecords,
  buildTodaySummary,
  buildTrend,
} from '@/lib/insights/compute';
import { SOURCES } from '@/lib/insights/types';
import { TodayStrip } from '@/components/insights/TodayStrip';
import { RecordsBoard } from '@/components/insights/RecordsBoard';
import { ModelMixTrend } from '@/components/insights/ModelMixTrend';
import { EfficiencyPanel } from '@/components/insights/EfficiencyPanel';
import { HoursHeatmap } from '@/components/insights/HoursHeatmap';
import { ProjectBreakdown } from '@/components/insights/ProjectBreakdown';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';

export const metadata: Metadata = {
  title: 'usage station · vibecodestats.dev',
  description:
    'A single-user terminal dashboard for LLM usage: how much, when, which models, which projects — across Claude Code, Codex, Grok, and Kimi.',
  alternates: { canonical: '/' },
};

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'vibecodestats.dev',
  alternateName: 'usage station',
  url: SITE_URL,
  description: 'Personal LLM usage station: tokens, models, hours, and projects.',
};

export default async function HomePage() {
  const database = await createClient();
  const today = todayLocal();
  const bundle = await getInsightsBundle(database, today);

  // ── Server-side compute (RSC) — everything derived once, here. ──────────────
  const todaySummary = buildTodaySummary(bundle.modelDaily, [], today);
  const records = buildRecords(bundle.history, today);
  const efficiency = buildEfficiency(bundle.modelDaily, today, 90);

  const { points, models } = buildTrend(bundle.modelDaily);
  const hourlyAgg = buildHourlyAgg(bundle.hourly);

  const projByWindow = {
    '7d': buildProjectRows(bundle.projectModel, [], today, 7),
    '30d': buildProjectRows(bundle.projectModel, [], today, 30),
    '90d': buildProjectRows(bundle.projectModel, [], today, 90),
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
          <span className="term-eyebrow">usage station</span>
          <span className="term-cursor" aria-hidden style={{ color: 'var(--color-orange)' }}>
            _
          </span>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: '0.72rem', color: 'var(--color-dim)', lineHeight: 1.5, maxWidth: 660 }}>
          How much, when, which models, which projects — across Claude Code, Codex, Grok &amp; Kimi.
        </p>
      </header>

      {!bundle.hasData && (
        <div
          className="term-panel"
          style={{ padding: '16px 18px', fontSize: '0.72rem', color: 'var(--color-dim)', lineHeight: 1.6 }}
        >
          <span style={{ color: 'var(--color-orange)' }}>›</span> No telemetry is readable yet. The station reads the{' '}
          <code style={{ color: 'var(--color-text)' }}>llm_*</code> usage tables. Every panel fills in automatically
          once data lands.
        </div>
      )}

      <TodayStrip summary={todaySummary} />

      <RecordsBoard records={records} />

      <ModelMixTrend points={points} models={models} today={today} availableSources={availableSources} />

      <EfficiencyPanel points={efficiency} />

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
