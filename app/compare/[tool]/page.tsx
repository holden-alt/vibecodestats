import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCompareTool } from '@/lib/seo/compare-data';

export const runtime = 'edge';

type Props = {
  params: Promise<{ tool: string }>;
};

const SITE = 'https://vibecodestats.dev';

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { tool } = await params;
  const t = getCompareTool(tool);
  if (!t) {
    return { title: 'Comparison not found · vibecodestats.dev' };
  }

  const title = `Claude Code vs ${t.name}: Honest Comparison (${t.lastReviewed})`;
  const description = t.summary;
  const url = `${SITE}/compare/${t.slug}`;
  const ogImage = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://srexmxntzjdhbuicqvso.supabase.co'}/storage/v1/object/public/og/_root.png`;

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title,
      description,
      url,
      type: 'article',
      siteName: 'vibecodestats.dev',
      images: [{ url: ogImage, secureUrl: ogImage, type: 'image/png', width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: ogImage, type: 'image/png', width: 1200, height: 630, alt: title }],
    },
  };
}

export default async function ComparePage({ params }: Props) {
  const { tool } = await params;
  const t = getCompareTool(tool);
  if (!t) notFound();

  const url = `${SITE}/compare/${t.slug}`;

  // JSON-LD: Article + FAQPage + BreadcrumbList for rich results.
  const articleSchema = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Claude Code vs ${t.name}: Honest Comparison`,
    description: t.summary,
    author: { '@type': 'Organization', name: 'vibecodestats.dev' },
    publisher: { '@type': 'Organization', name: 'vibecodestats.dev', url: SITE },
    datePublished: '2026-05-22',
    dateModified: `${t.lastReviewed}-01`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: t.faq.map((q) => ({
      '@type': 'Question',
      name: q.question,
      acceptedAnswer: { '@type': 'Answer', text: q.answer },
    })),
  };
  const breadcrumbSchema = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Home', item: SITE },
      { '@type': 'ListItem', position: 2, name: 'Compare', item: `${SITE}/compare` },
      { '@type': 'ListItem', position: 3, name: `Claude Code vs ${t.name}`, item: url },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify([articleSchema, faqSchema, breadcrumbSchema]) }}
      />
      <article style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px 96px', lineHeight: 1.65 }}>
        <nav style={{ fontSize: 13, opacity: 0.6, marginBottom: 16 }}>
          <Link href="/" style={{ color: 'inherit' }}>vibecodestats.dev</Link>
          {' / '}
          <Link href="/compare" style={{ color: 'inherit' }}>compare</Link>
          {' / '}
          <span>{t.slug}</span>
        </nav>

        <h1 style={{ fontSize: 36, lineHeight: 1.15, marginBottom: 8, fontWeight: 700 }}>
          Claude Code vs {t.name}
        </h1>
        <p style={{ fontSize: 18, opacity: 0.75, marginBottom: 8 }}>{t.tagline}</p>
        <p style={{ fontSize: 13, opacity: 0.5, marginBottom: 32 }}>
          Last reviewed {t.lastReviewed}
        </p>

        <p style={{ fontSize: 17, marginBottom: 32 }}>{t.intro}</p>

        {/* Comparison table */}
        <h2 style={{ fontSize: 24, marginTop: 40, marginBottom: 16, fontWeight: 700 }}>
          At a glance
        </h2>
        <div style={{ overflowX: 'auto', marginBottom: 32 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border, #2a2a32)' }}>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Feature</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600, color: 'var(--chart-1, #d97757)' }}>Claude Code</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>{t.name}</th>
              </tr>
            </thead>
            <tbody>
              {t.table.map((row) => (
                <tr key={row.feature} style={{ borderBottom: '1px solid var(--color-border, #2a2a32)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>{row.feature}</td>
                  <td style={{ padding: '10px 12px' }}>{row.claudeCode}</td>
                  <td style={{ padding: '10px 12px' }}>{row.other}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Best for sections */}
        <h2 style={{ fontSize: 24, marginTop: 40, marginBottom: 16, fontWeight: 700 }}>
          When to pick Claude Code
        </h2>
        <ul style={{ paddingLeft: 22, marginBottom: 32 }}>
          {t.bestForClaudeCode.map((b, i) => (
            <li key={i} style={{ marginBottom: 8 }}>{b}</li>
          ))}
        </ul>

        <h2 style={{ fontSize: 24, marginTop: 40, marginBottom: 16, fontWeight: 700 }}>
          When to pick {t.name}
        </h2>
        <ul style={{ paddingLeft: 22, marginBottom: 32 }}>
          {t.bestForOther.map((b, i) => (
            <li key={i} style={{ marginBottom: 8 }}>{b}</li>
          ))}
        </ul>

        {/* Decision tree */}
        <h2 style={{ fontSize: 24, marginTop: 40, marginBottom: 16, fontWeight: 700 }}>
          Which is right for you?
        </h2>
        <p style={{ marginBottom: 32 }}>{t.decisionTree}</p>

        {/* CTA — the funnel */}
        <aside
          style={{
            background: 'var(--color-bg-2, #15151a)',
            border: '1px solid var(--chart-1, #d97757)',
            borderRadius: 6,
            padding: '20px 22px',
            marginBottom: 40,
          }}
        >
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
            Track your own Claude Code stats
          </h3>
          <p style={{ fontSize: 14, opacity: 0.85, marginBottom: 14 }}>
            Once you pick a tool, instrument your usage. vibecodestats.dev is a live leaderboard
            for Claude Code power users — total tokens, daily rank, days active, all updated in
            real time via a stop hook. Free, no email required, open source.
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
            Track my Claude Code stats →
          </Link>
        </aside>

        {/* FAQ */}
        <h2 style={{ fontSize: 24, marginTop: 40, marginBottom: 16, fontWeight: 700 }}>
          FAQ
        </h2>
        {t.faq.map((q) => (
          <details key={q.question} style={{ marginBottom: 14, borderBottom: '1px solid var(--color-border, #2a2a32)', paddingBottom: 12 }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: 16, padding: '6px 0' }}>
              {q.question}
            </summary>
            <p style={{ marginTop: 8, opacity: 0.9 }}>{q.answer}</p>
          </details>
        ))}

        {/* Related pages — internal link graph */}
        <h2 style={{ fontSize: 24, marginTop: 48, marginBottom: 16, fontWeight: 700 }}>
          Related
        </h2>
        <ul style={{ paddingLeft: 22 }}>
          {t.related.map((r) => (
            <li key={r.slug} style={{ marginBottom: 6 }}>
              <Link href={`/${r.type}/${r.slug}`} style={{ color: 'var(--chart-3, #6bbfd9)' }}>
                {r.label}
              </Link>
            </li>
          ))}
        </ul>
      </article>
    </>
  );
}
