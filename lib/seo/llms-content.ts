import { compareTools, type CompareTool } from './compare-data';

export const SITE_URL = 'https://vibecodestats.dev';

export const SITE_INTRO = `# vibecodestats.dev

> The tokenmaxxing leaderboard. Pick a side.

vibecodestats.dev is a free public leaderboard of Claude Code + Codex token usage. Your all-time tokens put you in a tier: S (top 1%) / A (top 10%) / B (top 40%) / C (top 75%) / D (75-90%) / HANDCODER (bottom 10% or zero AI tokens). At signup you pick Team Claude Code or Team Codex; a live daily scoreboard pits both camps against each other. Your OG card is the share unit. Built by Holden Richardson ([@realholdengr](https://x.com/realholdengr)), #1 global at 4.84B all-time tokens.`;

export const MAIN_PAGES: { url: string; title: string; description: string }[] = [
  {
    url: `${SITE_URL}/`,
    title: 'Home',
    description: 'What the site is, the one-line installer pitch, and the live top of today\'s leaderboard.',
  },
  {
    url: `${SITE_URL}/leaderboard`,
    title: 'Global leaderboard',
    description: 'Ranks every public profile by today\'s, this week\'s, and all-time token volume.',
  },
  {
    url: `${SITE_URL}/setup`,
    title: 'Setup',
    description: 'One-line installer that drops a Claude Code stop-hook script. Reads aggregate stats only — never your code or prompts.',
  },
  {
    url: `${SITE_URL}/methodology`,
    title: 'How tiers and teams work',
    description: 'How vibecodestats.dev assigns tiers (S/A/B/C/D/HANDCODER) via pure percentile ranking and splits users into Team Claude Code vs Team Codex by token-derived model usage.',
  },
  {
    url: `${SITE_URL}/holden-alt`,
    title: 'Holden\'s profile',
    description: 'The founder\'s profile. Right now, the only real user — be the second.',
  },
];

export function renderCompareEntryShort(t: CompareTool): string {
  return `- [Claude Code vs ${t.name}](${SITE_URL}/compare/${t.slug}): ${t.summary}`;
}

export function renderCompareEntryFull(t: CompareTool): string {
  const tableHeader = `| Feature | Claude Code | ${t.name} |\n| --- | --- | --- |`;
  const tableRows = t.table.map((r) => `| ${r.feature} | ${r.claudeCode} | ${r.other} |`).join('\n');
  const bestClaude = t.bestForClaudeCode.map((b) => `- ${b}`).join('\n');
  const bestOther = t.bestForOther.map((b) => `- ${b}`).join('\n');
  const faq = t.faq.map((q) => `**${q.question}**\n\n${q.answer}`).join('\n\n');

  return `## Claude Code vs ${t.name}

Source: ${SITE_URL}/compare/${t.slug}
Last reviewed: ${t.lastReviewed}

> ${t.summary}

${t.intro}

### Comparison table

${tableHeader}
${tableRows}

### Best for Claude Code

${bestClaude}

### Best for ${t.name}

${bestOther}

### Decision tree

${t.decisionTree}

### FAQ

${faq}
`;
}

export function renderMainPagesSection(): string {
  return MAIN_PAGES.map((p) => `- [${p.title}](${p.url}): ${p.description}`).join('\n');
}

export function renderCompareIndex(): string {
  return compareTools.map(renderCompareEntryShort).join('\n');
}

export function renderCompareFull(): string {
  return compareTools.map(renderCompareEntryFull).join('\n---\n\n');
}
