import type { Metadata } from 'next';
import Link from 'next/link';
import { compareTools } from '@/lib/seo/compare-data';

const SITE = 'https://vibecodestats.dev';

export const metadata: Metadata = {
  title: 'Compare Claude Code to every AI coding tool · vibecodestats.dev',
  description:
    'Honest, up-to-date comparisons of Claude Code vs Cursor, Cline, GitHub Copilot, Aider, Codex CLI, and more. Pick the right AI coding tool for your workflow.',
  alternates: { canonical: `${SITE}/compare` },
  openGraph: {
    title: 'Compare Claude Code to every AI coding tool',
    description: 'Side-by-side comparisons of every major AI coding agent in 2026.',
    url: `${SITE}/compare`,
    type: 'website',
    siteName: 'vibecodestats.dev',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Compare Claude Code to every AI coding tool',
    description: 'Side-by-side comparisons of every major AI coding agent in 2026.',
  },
};

export default function CompareIndex() {
  return (
    <article style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 96px', lineHeight: 1.65 }}>
      <h1 style={{ fontSize: 36, lineHeight: 1.15, marginBottom: 16, fontWeight: 700 }}>
        Compare Claude Code to every AI coding tool
      </h1>
      <p style={{ fontSize: 17, opacity: 0.85, marginBottom: 32 }}>
        Honest side-by-side breakdowns. Same comparison format for every tool: feature table,
        when to pick each one, real FAQ. Updated as the tools change.
      </p>

      <h2 style={{ fontSize: 20, fontWeight: 700, marginTop: 24, marginBottom: 12 }}>
        All comparisons
      </h2>
      <ul style={{ paddingLeft: 22 }}>
        {compareTools.map((t) => (
          <li key={t.slug} style={{ marginBottom: 8 }}>
            <Link href={`/compare/${t.slug}`} style={{ color: 'var(--chart-3, #6bbfd9)', fontWeight: 600 }}>
              Claude Code vs {t.name}
            </Link>
            <span style={{ opacity: 0.6, marginLeft: 8, fontSize: 14 }}>— {t.tagline}</span>
          </li>
        ))}
      </ul>

      <aside
        style={{
          marginTop: 40,
          background: 'var(--color-bg-2, #15151a)',
          border: '1px solid var(--chart-1, #d97757)',
          borderRadius: 6,
          padding: '20px 22px',
        }}
      >
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
          Track your Claude Code usage live
        </h3>
        <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 14 }}>
          Whichever tool you pick — if you use Claude Code, you can publish your usage stats
          to the live leaderboard at vibecodestats.dev. Free, open source, no email.
        </p>
        <Link
          href="/setup"
          prefetch={false}
          style={{
            display: 'inline-block',
            background: 'var(--chart-1, #d97757)',
            color: 'var(--color-bg, #0d0d0d)',
            padding: '10px 18px',
            borderRadius: 3,
            fontWeight: 700,
            fontSize: 14,
            textDecoration: 'none',
          }}
        >
          Set up tracking →
        </Link>
      </aside>
    </article>
  );
}
