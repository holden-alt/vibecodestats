import { compareTools, type CompareTool } from './compare-data';

export const SITE_URL = 'https://vibecodestats.dev';

export const SITE_INTRO = `# vibecodestats.dev

> Strava for AI coding. Public stats profiles, a global leaderboard, and a live token counter for Claude Code + Codex power users.

vibecodestats.dev tracks daily AI-coding usage — tokens, sessions, deep-work minutes, machines — and surfaces a Vibewatts (VBW) productivity score for every signed-in user. Built by Holden Richardson ([@realholdengr](https://x.com/realholdengr)). The project is in active recruitment of its first non-founder user; if you ship code with Claude Code, you are exactly the right person.`;

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
    title: 'Vibewatts (VBW) methodology',
    description: 'How the Vibewatts productivity score is computed — five dimensions, geometric mean, gaming-resistance, anti-bot tactics.',
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
