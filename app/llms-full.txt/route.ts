import { SITE_INTRO, renderMainPagesSection, renderCompareFull } from '@/lib/seo/llms-content';

export const revalidate = 3600;

export async function GET() {
  const body = `${SITE_INTRO}

## Main pages

${renderMainPagesSection()}

---

# Claude Code comparison & guide articles (full content)

${renderCompareFull()}
`;
  return new Response(body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
