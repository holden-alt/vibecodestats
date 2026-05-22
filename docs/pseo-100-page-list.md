# Programmatic SEO/AEO — 100 Page List

**Goal:** rank for 100 high-intent Claude Code / AI coding queries, funnel signups to vibecodestats.dev.
**Quality bar:** 800-1500 words per page, real research, schema markup, internal links, CTA back to product.
**Status:** all pages start in `unwritten` state. Mark `live` once shipped.

---

## 1. Tool comparisons (25 pages) — `/compare/[tool]`

Claude Code vs:
1. cursor — Cursor
2. cline — Cline
3. github-copilot — GitHub Copilot
4. aider — Aider
5. codex-cli — Codex CLI (OpenAI)
6. cody — Sourcegraph Cody
7. windsurf — Windsurf
8. devin — Devin (Cognition)
9. open-interpreter — Open Interpreter
10. goose — Goose (Block)
11. continue — Continue
12. tabnine — Tabnine
13. amazon-q — Amazon Q Developer
14. zed — Zed AI
15. pear-ai — PearAI
16. bolt — Bolt.new
17. v0 — v0 (Vercel)
18. lovable — Lovable
19. replit-agent — Replit Agent
20. cody-enterprise — Cody Enterprise
21. cursor-tab — Cursor Tab (autocomplete)
22. supermaven — Supermaven
23. junie — Junie (JetBrains)
24. lazy-cli — Lazy CLI
25. roo-code — Roo Code (Cline fork)

**Page formula:** intro paragraph + comparison table (price, model, UX, strengths) + 3 named use-cases per side + "which is right for you" decision tree + FAQ + "track YOUR Claude Code usage" CTA.

---

## 2. How-to guides (30 pages) — `/guides/[slug]`

Setup & integration:
1. setup-claude-code-mac
2. setup-claude-code-linux
3. setup-claude-code-windows-wsl
4. claude-code-with-nextjs
5. claude-code-with-react
6. claude-code-with-python
7. claude-code-with-rust
8. claude-code-with-go
9. claude-code-with-typescript
10. claude-code-with-supabase
11. claude-code-with-vercel
12. claude-code-with-cloudflare
13. claude-code-with-docker
14. claude-code-with-vscode
15. claude-code-with-jetbrains
16. claude-code-in-tmux

Workflow:
17. track-claude-code-usage
18. set-up-claude-code-stop-hook
19. set-up-claude-code-skills
20. set-up-claude-code-subagents
21. optimize-claude-code-costs
22. claude-code-with-multiple-machines
23. share-claude-code-stats
24. claude-code-team-setup

Advanced:
25. claude-code-mcp-servers
26. claude-code-permissions-config
27. claude-code-bash-automation
28. claude-code-thinking-mode
29. claude-code-context-management
30. migrate-from-cursor-to-claude-code

---

## 3. Glossary / definitions (20 pages) — `/glossary/[term]`

AEO gold — schema as `DefinedTerm` + `FAQPage`.

1. what-is-claude-code
2. what-is-vibe-coding
3. what-is-a-claude-code-session
4. what-is-a-claude-token
5. what-is-claude-opus
6. what-is-claude-sonnet
7. what-is-claude-haiku
8. what-is-the-anthropic-api
9. what-is-a-claude-skill
10. what-is-a-stop-hook
11. what-is-an-mcp-server
12. what-is-prompt-caching
13. what-is-a-subagent
14. what-is-extended-thinking
15. what-is-the-context-window
16. what-is-tool-use-in-claude
17. what-are-claude-code-permissions
18. what-is-a-cli-coding-agent
19. what-is-an-agentic-loop
20. what-is-deep-work-coding

---

## 4. Listicles (15 pages) — `/lists/[slug]`

1. best-claude-code-skills
2. best-claude-code-prompts
3. top-ai-coding-tools-2026
4. best-claude-code-workflows
5. claude-code-keyboard-shortcuts
6. best-claude-code-mcp-servers
7. top-vibe-coded-products
8. best-cli-coding-agents
9. claude-code-power-user-tips
10. best-claude-code-skills-for-frontend
11. best-claude-code-skills-for-backend
12. best-claude-code-skills-for-devops
13. top-anthropic-models-ranked
14. best-tools-for-vibe-coding
15. claude-code-tips-for-beginners

---

## 5. Troubleshooting (10 pages) — `/help/[issue]`

1. claude-code-not-working
2. claude-code-rate-limit
3. claude-code-missing-tokens
4. claude-code-stop-hook-not-firing
5. claude-code-permission-denied
6. claude-code-mcp-server-not-connecting
7. claude-code-skill-not-loading
8. claude-code-out-of-context
9. claude-code-token-counter-wrong
10. claude-code-billing-questions

---

## Funnel design (every page)

- Below the fold: **"Track your Claude Code stats live"** CTA card → big button → vibecodestats.dev signup
- Sidebar / inline: 3-5 related pSEO links (internal graph)
- Footer: link to leaderboard + GitHub repo
- Schema: appropriate type per template (Article, HowTo, FAQPage, ItemList, DefinedTerm)

## Indexing pipeline

- `app/sitemap.ts` auto-generates from all 100 routes + the existing user profile pages
- `app/robots.ts` allows indexing, references sitemap
- Cloudflare Crawler Hints toggle → IndexNow ping on content change (Bing + Yandex)
- GSC OAuth + sitemap submit + URL Inspection API for top 10 priority URLs/day

## Build order

1. **Foundation:** sitemap.ts, robots.ts, layout for SEO pages, IndexNow + GSC setup
2. **Template 1 (compare) ships first** with 5 pages — proof of pipeline
3. **Templates 2-5 ship in batches** of 10-20 pages
