import Image from 'next/image';
import Link from 'next/link';
import type { Metadata } from 'next';
import { todayLocal } from '@/lib/date';
import { createClient } from '@/lib/db/server';
import { getInsightsBundle } from '@/lib/insights/queries';
import {
  bucketVendorDays,
  buildActiveHours,
  buildDayRankings,
  buildModelRanking,
  buildModelWeeks,
  buildProjectLanes,
  buildRecords,
  buildShowdown,
  buildTodaySummary,
  buildVendorDays,
  buildWorkClock,
  deepWorkPerDay,
} from '@/lib/insights/compute';
import { StationTabs } from '@/components/insights/StationTabs';
import { ShowdownPanel } from '@/components/insights/ShowdownPanel';
import { TokenTimeline } from '@/components/insights/TokenTimeline';
import { DayScatter } from '@/components/insights/DayScatter';
import { ModelBars } from '@/components/insights/ModelBars';
import { TodayStrip } from '@/components/insights/TodayStrip';
import { RecordsBoard } from '@/components/insights/RecordsBoard';
import { DayRankingsPanel } from '@/components/insights/DayRankingsPanel';
import { ModelEras } from '@/components/insights/ModelEras';
import { WorkClock } from '@/components/insights/WorkClock';
import { ProjectLanes } from '@/components/insights/ProjectLanes';
import { ActiveHours } from '@/components/insights/ActiveHours';

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://www.vibecodestats.dev';

// Brand line from the RAI kit (BRAND-SPEC.md). Subordinate to the wordmark.
const TAGLINE = 'Applied AI that makes an organization more capable — and more human.';

export const metadata: Metadata = {
  title: 'Usage station · Richardson Applied AI',
  description:
    'Richardson Applied AI usage station: Claude vs. Codex over time, which models did the work, when, and on which projects.',
  alternates: { canonical: '/' },
};

const WEBSITE_JSONLD = {
  '@context': 'https://schema.org',
  '@type': 'WebSite',
  name: 'Richardson Applied AI · usage station',
  url: SITE_URL,
  description: 'Personal LLM usage station: tokens, models, hours, and projects over time.',
};

export default async function HomePage() {
  const database = await createClient();
  const today = todayLocal();
  const bundle = await getInsightsBundle(database, today);

  // ── Server-side compute (RSC) — everything derived once, here. ──────────────
  const todaySummary = buildTodaySummary(bundle.modelDaily, [], today, bundle.ships);
  const records = buildRecords(bundle.history, today);
  const dayRankings = buildDayRankings(bundle.history);

  // ── Overview: Claude vs. Codex across the full history ─────────────────────
  const vendorDays = buildVendorDays(bundle.modelDaily, today);
  const showdowns = {
    '7d': buildShowdown(vendorDays, today, '7d'),
    '30d': buildShowdown(vendorDays, today, '30d'),
    '90d': buildShowdown(vendorDays, today, '90d'),
    all: buildShowdown(vendorDays, today, 'all'),
  };
  const timeline = {
    day: bucketVendorDays(vendorDays, 'day'),
    week: bucketVendorDays(vendorDays, 'week'),
    month: bucketVendorDays(vendorDays, 'month'),
  };
  const lifetimeTokens = vendorDays.reduce((sum, d) => sum + d.claude + d.codex + d.other, 0);
  const modelRanks = {
    '30d': buildModelRanking(bundle.modelDaily, today, 30),
    '90d': buildModelRanking(bundle.modelDaily, today, 90),
    all: buildModelRanking(bundle.modelDaily, today, null),
  };

  // ── Detail: all-time models, hours, projects, and time ─────────────────────
  const modelWeeks = buildModelWeeks(bundle.modelDaily, today);
  const workClock = buildWorkClock(bundle.hourly, today);
  const projectLanes = buildProjectLanes(bundle.projectModel, today);
  const activeWeeks = buildActiveHours(bundle.hourly, bundle.history, today);
  const perDay30 = deepWorkPerDay(bundle.history, today, 30);
  const perDayAll = deepWorkPerDay(bundle.history, today, null);

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
          How much you use Claude and Codex, how that has changed over time, and which models did the
          work.
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

      <StationTabs
        overview={
          <>
            <ShowdownPanel showdowns={showdowns} weekly={timeline.week} />
            <TokenTimeline byGrain={timeline} lifetime={lifetimeTokens} since={vendorDays[0]?.date ?? null} />
            <div className="insights-two-col" style={{ alignItems: 'stretch' }}>
              <DayScatter days={vendorDays} today={today} />
              <ModelBars byWindow={modelRanks} />
            </div>
            <DayRankingsPanel days={dayRankings} today={today} />
          </>
        }
        detail={
          <>
            <RecordsBoard records={records} today={today} />
            <ModelEras data={modelWeeks} />
            <WorkClock weeks={workClock} />
            <ProjectLanes data={projectLanes} />
            <ActiveHours weeks={activeWeeks} perDay30={perDay30} perDayAll={perDayAll} />
          </>
        }
      />

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
