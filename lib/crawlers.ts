// Social / link-preview crawlers (Open Graph + Twitter Card scrapers).
//
// These are the bots that fetch a URL to build a share card. They matter for
// host canonicalization: X (and others) normalize a shared link by STRIPPING
// the `www.` subdomain, then scrape the bare apex. The apex 301-redirects to
// www, but these crawlers do NOT follow that redirect for card scraping — they
// fall back to the domain's homepage card. So on the apex we must serve the
// crawler the actual page (its og:image), not redirect it.
//
// Humans are unaffected: they keep canonicalizing apex -> www (PKCE/SEO).
const SOCIAL_CRAWLER_UA =
  /(Twitterbot|facebookexternalhit|Facebot|LinkedInBot|Slackbot|Slack-ImgProxy|Discordbot|TelegramBot|WhatsApp|Pinterest|redditbot|Googlebot|bingbot|Applebot|Embedly|Iframely|vkShare|SkypeUriPreview|Yahoo|Mastodon|Bluesky|Threads)/i;

export function isSocialCrawler(userAgent: string | null | undefined): boolean {
  return !!userAgent && SOCIAL_CRAWLER_UA.test(userAgent);
}
