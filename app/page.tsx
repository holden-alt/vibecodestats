import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { todayLocal } from '@/lib/date';
import { createClient } from '@/lib/db/server';
import { getInsightsBundle } from '@/lib/insights/queries';
import {
  buildDayRankings,
  buildEfficiency,
  buildHourlyAgg,
  buildProjectRows,
  buildRecords,
  buildShips,
  buildTodaySummary,
  buildTrend,
} from '@/lib/insights/compute';
import { SOURCES } from '@/lib/insights/types';
import { TodayStrip } from '@/components/insights/TodayStrip';
import { RecordsBoard } from '@/components/insights/RecordsBoard';
import { DayRankingsPanel } from '@/components/insights/DayRankingsPanel';
import { ModelMixTrend } from '@/components/insights/ModelMixTrend';
import { EfficiencyPanel } from '@/components/insights/EfficiencyPanel';
import { HoursHeatmap } from '@/components/insights/HoursHeatmap';
import { ProjectBreakdown } from '@/components/insights/ProjectBreakdown';
import { ShipsPanel } from '@/components/insights/ShipsPanel';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';

// Brand line from the RAI kit (BRAND-SPEC.md). Subordinate to the wordmark.
const TAGLINE = 'Applied AI that makes an organization more capable — and more human.';

export const metadata: Metadata = {
  title: 'Usage station · Richardson Applied AI',
  description:
    'Richardson Applied AI usage station: how much, when, which models, which projects, and what shipped — across Claude Code, Codex, Grok, and Kimi.',
  alternates: { canonical: '/' },
};

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Richardson Applied AI · usage station',
  url: SITE_URL,
  description: 'Personal LLM usage station: tokens, models, hours, projects, and ships.',
};

export default async function HomePage() {
  const database = await createClient();
  const today = todayLocal();
  const bundle = await getInsightsBundle(database, today);

  // ── Server-side compute (RSC) — everything derived once, here. ──────────────
  const todaySummary = buildTodaySummary(bundle.modelDaily, [], today, bundle.ships);
  const records = buildRecords(bundle.history, today);
  const dayRankings = buildDayRankings(bundle.history);
  const efficiency = buildEfficiency(bundle.modelDaily, today, 90);

  const { points, models } = buildTrend(bundle.modelDaily);
  const hourlyAgg = buildHourlyAgg(bundle.hourly);

  const projByWindow = {
    '7d': buildProjectRows(bundle.projectModel, [], today, 7),
    '30d': buildProjectRows(bundle.projectModel, [], today, 30),
    '90d': buildProjectRows(bundle.projectModel, [], today, 91),
  };
  const shipsByWindow = {
    '7d': buildShips(bundle.ships, today, 7, false),
    '30d': buildShips(bundle.ships, today, 30, false),
    '90d': buildShips(bundle.ships, today, 91, true),
  };

  const present = new Set<string>();
  for (const r of bundle.modelDaily) present.add(r.source);
  for (const r of bundle.hourly) present.add(r.source);
  const availableSources = SOURCES.filter((s) => present.has(s));

  return (
    <main
      style={{
        maxWidth: 1120,
        margin: '0 auto',
        padding: '26px 20px 72px',
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

      {/* ── Masthead: approved inline wordmark (on-dark variant), clear space kept. ── */}
      <header style={{ marginBottom: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
          <Image
            src="/brand/wordmark-inline-on-dark.svg"
            alt="Richardson Applied AI"
            width={217}
            height={31}
            priority
            unoptimized
            style={{ display: 'block', height: 31, width: 'auto' }}
          />
          <span
            className="term-eyebrow"
            style={{ paddingLeft: 18, borderLeft: '1px solid var(--color-border)', lineHeight: '31px' }}
          >
            usage station
          </span>
        </div>
        <p
          style={{
            margin: '12px 0 0',
            fontSize: '0.78rem',
            color: 'var(--color-dim)',
            lineHeight: 1.5,
            maxWidth: 680,
          }}
        >
          How much, when, which models, which projects, what shipped — across Claude Code, Codex, Grok
          &amp; Kimi.
        </p>
      </header>

      {!bundle.hasData && (
        <div
          className="term-panel"
          style={{ padding: '16px 18px', fontSize: '0.78rem', color: 'var(--color-dim)', lineHeight: 1.6 }}
        >
          No telemetry is readable yet. The station reads the{' '}
          <code className="num" style={{ color: 'var(--color-text)' }}>llm_*</code> usage tables. Every panel
          fills in automatically once data lands.
        </div>
      )}

      <TodayStrip summary={todaySummary} />

      <RecordsBoard records={records} today={today} />

      <DayRankingsPanel days={dayRankings} today={today} />

      <DayRankingsPanel days={dayRankings} today={today} />

      <ModelMixTrend points={points} models={models} today={today} availableSources={availableSources} />

      <div className="insights-two-col">
        <HoursHeatmap agg={hourlyAgg} today={today} availableSources={availableSources} />
        <ProjectBreakdown byWindow={projByWindow} />
      </div>

      <ShipsPanel byWindow={shipsByWindow} />

      <EfficiencyPanel points={efficiency} />

      {/* ── Footer (demoted routes live here, off the primary surface) ─────── */}
      <footer
        style={{
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--color-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-dim)', lineHeight: 1.5 }}>{TAGLINE}</p>
        <div
          className="term-eyebrow"
          style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center', letterSpacing: '0.08em' }}
        >
          <span>America/New_York · reported by local day</span>
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
        </div>
      </footer>
    </main>
  );
}
