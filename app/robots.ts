import type { MetadataRoute } from 'next';

// Major AI / answer-engine crawlers, expressly welcomed. vibecodestats is an
// AEO-first site: we WANT these to crawl + cite + train on the content. Listing
// them explicitly (not just relying on "*") is unambiguous and future-proofs
// against any crawler that assumes a restrictive default. Functional endpoints
// (/api, /auth) stay blocked for every agent — no content lives there.
const AI_CRAWLERS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', // OpenAI
  'ClaudeBot', 'anthropic-ai', 'Claude-Web', // Anthropic
  'Google-Extended', // Google AI / Gemini
  'PerplexityBot', 'Perplexity-User', // Perplexity
  'CCBot', // Common Crawl
  'Applebot-Extended', // Apple Intelligence
  'Amazonbot', // Amazon
  'Bytespider', // ByteDance
  'Meta-ExternalAgent', // Meta AI
  'cohere-ai', // Cohere
];

const DISALLOW = ['/api/', '/auth/'];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: DISALLOW },
      { userAgent: AI_CRAWLERS, allow: '/', disallow: DISALLOW },
    ],
    sitemap: 'https://www.vibecodestats.dev/sitemap.xml',
    host: 'https://www.vibecodestats.dev',
  };
}
