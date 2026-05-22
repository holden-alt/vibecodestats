/**
 * Source-of-truth for /compare/[tool] pages.
 *
 * Each tool entry holds the structured comparison content. The page renders
 * this data into a consistent template with comparison table, use-case
 * breakdown, decision tree, FAQ, and a CTA back to vibecodestats.dev.
 *
 * Content guidelines:
 * - 800-1500 words of substantive content per entry
 * - Specific named features, not vague platitudes
 * - Pricing from each tool's public page (review quarterly)
 * - Strengths + weaknesses on BOTH sides — honest comparisons rank better
 */

export type CompareTool = {
  slug: string;
  name: string;
  tagline: string;
  /** One-sentence summary used in meta description and intro. */
  summary: string;
  /** Comparison rows, paired with Claude Code. */
  table: { feature: string; claudeCode: string; other: string }[];
  /** Markdown-friendly paragraphs forming the body. */
  intro: string;
  bestForClaudeCode: string[];
  bestForOther: string[];
  decisionTree: string;
  /** FAQ pairs, used for FAQPage schema markup + on-page Q&A. */
  faq: { question: string; answer: string }[];
  /** Related comparison/guide slugs for internal linking. */
  related: { slug: string; label: string; type: 'compare' | 'guides' | 'glossary' | 'lists' }[];
  /** Public availability of the other tool (months) — used for "as of" timestamps. */
  lastReviewed: string;
};

export const compareTools: CompareTool[] = [
  {
    slug: 'cursor',
    name: 'Cursor',
    tagline: 'The AI-first IDE forked from VS Code',
    summary:
      'Claude Code is a terminal-native CLI coding agent. Cursor is an AI-first IDE forked from VS Code. They overlap on intent (let AI write code) but differ on every concrete choice — surface area, control, autonomy, pricing.',
    table: [
      { feature: 'Surface', claudeCode: 'Terminal CLI', other: 'Forked VS Code IDE' },
      { feature: 'Default model', claudeCode: 'Claude Sonnet 4.6 / Opus 4.7', other: 'Multiple (GPT, Claude, Gemini, custom)' },
      { feature: 'Pricing (individual)', claudeCode: 'Pay-per-use via Anthropic API, or $20/mo Pro', other: '$20/mo Pro, $40/mo Ultra' },
      { feature: 'Autonomy', claudeCode: 'Agentic — runs commands, edits files, follows multi-step plans', other: 'Mixed — Tab autocomplete + Composer agent mode' },
      { feature: 'Open source', claudeCode: 'Closed (Anthropic-built)', other: 'Closed fork of open VS Code' },
      { feature: 'Stop-hook automation', claudeCode: 'Native — exit hooks fire arbitrary scripts', other: 'Not natively' },
      { feature: 'MCP server support', claudeCode: 'Yes — first-class', other: 'Yes — added 2024' },
      { feature: 'Custom skills', claudeCode: 'Yes — installable skill plugins', other: 'No formal skill system' },
      { feature: 'Best for', claudeCode: 'Power users who live in the terminal', other: 'Devs who want IDE comfort + AI' },
    ],
    intro:
      'Both tools are excellent. Picking between them is less about which is "better" and more about where you spend your time. Claude Code lives in the terminal — its primary surface is your shell, with file edits applied through tool use. Cursor lives in an IDE — its primary surface is your editor window, with AI suggestions woven into the typing experience. If you reach for the terminal first, Claude Code feels like an extension of how you already work. If you reach for VS Code first, Cursor feels like it.',
    bestForClaudeCode: [
      'Long-running agent tasks that span multiple files and run shell commands (migrations, scaffolds, refactors)',
      'Workflows where you want the AI to drive — write code, run tests, commit, iterate — without you babysitting each edit',
      'Tracking and rewarding deep work: Claude Code\'s stop hooks let you instrument every session, which is how vibecodestats.dev works',
      'Multi-machine setups where the same agent + skills follow you across Macs, Linux boxes, or remote dev servers',
    ],
    bestForOther: [
      'Tab-completion-heavy workflows where you want inline autocomplete as you type',
      'Visual debugging, breakpoints, and IDE features you\'d miss in a terminal',
      'Pair-programming style where you steer most edits and the AI fills gaps',
      'Teams already standardized on VS Code and unwilling to switch surfaces',
    ],
    decisionTree:
      'Live in tmux/vim/shell? → Claude Code. Live in VS Code? → Cursor. Want to track deep work and publish a leaderboard like the one at vibecodestats.dev? → Claude Code, because the stop-hook architecture is what makes that possible. Want autocomplete-while-typing as the primary AI surface? → Cursor.',
    faq: [
      {
        question: 'Is Claude Code free?',
        answer:
          'Claude Code is free to install and use via the Anthropic API on a pay-per-use basis. Claude Pro ($20/mo) and Max plans include Claude Code usage with monthly limits. Cursor is a paid product at $20/mo for Pro.',
      },
      {
        question: 'Can I use Claude Code inside Cursor?',
        answer:
          'You can run Claude Code in Cursor\'s integrated terminal, and Cursor can also call Claude models for its own AI features. They\'re not mutually exclusive — many devs use both.',
      },
      {
        question: 'Which uses more tokens?',
        answer:
          'Depends entirely on workflow. Cursor\'s autocomplete consumes tokens constantly. Claude Code consumes tokens in bursts when you invoke it. Most heavy users hit similar monthly totals; track yours at vibecodestats.dev.',
      },
      {
        question: 'Does Cursor have an equivalent to Claude Code skills?',
        answer:
          'No. Cursor has Rules and Notepads but no skill plugin ecosystem. Claude Code\'s skill system is closer to a package manager for agent capabilities.',
      },
    ],
    related: [
      { slug: 'cline', label: 'Claude Code vs Cline', type: 'compare' },
      { slug: 'aider', label: 'Claude Code vs Aider', type: 'compare' },
      { slug: 'migrate-from-cursor-to-claude-code', label: 'Migrate from Cursor to Claude Code', type: 'guides' },
      { slug: 'what-is-claude-code', label: 'What is Claude Code?', type: 'glossary' },
    ],
    lastReviewed: '2026-05',
  },

  {
    slug: 'cline',
    name: 'Cline',
    tagline: 'Open-source AI coding agent for VS Code',
    summary:
      'Cline is an open-source VS Code extension that runs an agentic coding loop inside your IDE. Claude Code is a closed-source CLI agent built by Anthropic. Both can use Claude models; they differ on surface and ecosystem.',
    table: [
      { feature: 'Surface', claudeCode: 'Terminal CLI', other: 'VS Code extension' },
      { feature: 'License', claudeCode: 'Closed (Anthropic)', other: 'Apache 2.0' },
      { feature: 'Model support', claudeCode: 'Claude only (Anthropic API)', other: 'Claude, GPT, Gemini, Ollama, OpenRouter, anything OpenAI-compatible' },
      { feature: 'Pricing', claudeCode: 'Anthropic API costs or Pro/Max plan', other: 'Bring your own API key; extension is free' },
      { feature: 'Stop hooks', claudeCode: 'Yes — native exit hooks', other: 'No' },
      { feature: 'Skill ecosystem', claudeCode: 'Yes — installable skills', other: 'Workflows + MCP servers, no plugin marketplace' },
      { feature: 'Token tracking', claudeCode: 'Native + pushes to vibecodestats.dev', other: 'In-UI counter only' },
      { feature: 'Best for', claudeCode: 'Terminal-first power users', other: 'Multi-model experimenters, IDE-first devs' },
    ],
    intro:
      'Cline is one of the strongest open-source AI coding agents available. It runs inside VS Code, supports any OpenAI-compatible model, and gives you full transparency over what the agent does. Claude Code is Anthropic\'s first-party CLI agent, optimized for Claude models and terminal workflows, with deeper instrumentation hooks. The choice is mostly about whether you want vendor-anchored polish (Claude Code) or open multi-model flexibility (Cline).',
    bestForClaudeCode: [
      'Workflows where the latest Claude features land first (extended thinking, prompt caching, new agent capabilities)',
      'Terminal-native development across multiple machines, ssh sessions, or tmux setups',
      'Instrumented deep work — pushing every session\'s stats to a leaderboard like vibecodestats.dev',
      'Anthropic Pro/Max plan users who don\'t want to manage API keys and per-model billing',
    ],
    bestForOther: [
      'Running multiple model providers behind one UI — Claude for hard reasoning, Gemini for cheap context, local models offline',
      'Auditing the agent\'s every step in a visual diff inside the IDE',
      'Self-hosting the agent code or forking the behavior',
      'Cost-sensitive workflows using cheaper non-Claude models',
    ],
    decisionTree:
      'Care most about agent autonomy + terminal feel + first-party Anthropic polish? → Claude Code. Care most about model flexibility, open source, or running local models? → Cline. Run both — many devs do.',
    faq: [
      {
        question: 'Is Cline a fork of Claude Code?',
        answer:
          'No. Cline is its own project, originally created by Saoud Rizwan and now developed by Cline Inc. It predates Claude Code\'s general availability and was built as an open-source alternative.',
      },
      {
        question: 'Can Cline use Claude models?',
        answer:
          'Yes. You add your Anthropic API key and Cline routes requests through Claude Sonnet, Opus, or Haiku. Many devs use Cline specifically to access Claude with full transparency.',
      },
      {
        question: 'Does Cline have something like vibecodestats.dev?',
        answer:
          'Not natively. You can track Cline usage by inspecting your Anthropic API dashboard, but the per-session leaderboard model that vibecodestats.dev provides is specific to Claude Code\'s stop-hook architecture.',
      },
      {
        question: 'Why pick Claude Code if Cline is free and open source?',
        answer:
          'Polish and pace. Anthropic ships Claude-Code-specific features first (skills, extended thinking, certain MCP behaviors). For most users, the time saved outweighs the cost of being inside the Anthropic ecosystem.',
      },
    ],
    related: [
      { slug: 'cursor', label: 'Claude Code vs Cursor', type: 'compare' },
      { slug: 'aider', label: 'Claude Code vs Aider', type: 'compare' },
      { slug: 'set-up-claude-code-skills', label: 'Set up Claude Code Skills', type: 'guides' },
      { slug: 'what-is-claude-code', label: 'What is Claude Code?', type: 'glossary' },
    ],
    lastReviewed: '2026-05',
  },

  {
    slug: 'github-copilot',
    name: 'GitHub Copilot',
    tagline: 'GitHub\'s AI pair programmer',
    summary:
      'GitHub Copilot is the original AI coding assistant — autocomplete plus a chat sidebar inside your editor. Claude Code is a newer-generation agentic CLI. They serve different jobs and many devs run both.',
    table: [
      { feature: 'Surface', claudeCode: 'Terminal CLI', other: 'VS Code, JetBrains, Visual Studio, others' },
      { feature: 'Primary mode', claudeCode: 'Agentic — multi-step task execution', other: 'Autocomplete + chat assist' },
      { feature: 'Default model', claudeCode: 'Claude Sonnet 4.6 / Opus 4.7', other: 'GPT-4.1, Claude 3.5/4, Gemini (selectable)' },
      { feature: 'Pricing', claudeCode: 'Anthropic API or Pro/Max plan', other: '$10/mo Individual, $19/mo Business, $39/mo Enterprise' },
      { feature: 'Agent mode', claudeCode: 'Built-in', other: 'Yes — added 2025 (Copilot Agents)' },
      { feature: 'Tool use', claudeCode: 'Native', other: 'Available via Copilot Agents' },
      { feature: 'Best for', claudeCode: 'Multi-step tasks the AI can drive end-to-end', other: 'Inline suggestions while typing' },
    ],
    intro:
      'Copilot kicked off the modern AI coding wave in 2021 with its inline autocomplete. Five years later, the category has split: traditional Copilot-style autocomplete (where AI fills in your next line as you type) and agentic coding (where AI executes whole workflows). Claude Code is firmly in the second camp. Copilot now does both, but its DNA is still autocomplete-first.',
    bestForClaudeCode: [
      'Tasks longer than a function — refactors, migrations, scaffolds, multi-file edits',
      'Devs who want to delegate complete chunks of work and review the diff',
      'Instrumenting your coding workflow with stop hooks (e.g. pushing stats to vibecodestats.dev)',
      'Terminal-native devs who don\'t want an IDE in the loop',
    ],
    bestForOther: [
      'Typing-heavy workflows where you want suggestions in your next keystroke',
      'Teams already on GitHub Enterprise who want consolidated billing',
      'Developers who prefer the comfort of IDE-native UX over a terminal',
      'Mature enterprise compliance and audit features',
    ],
    decisionTree:
      'Want AI to type for you as you write? → Copilot. Want AI to take a task description and execute it? → Claude Code. Want both? → run both; they don\'t conflict and many devs do.',
    faq: [
      {
        question: 'Is Claude Code a Copilot competitor?',
        answer:
          'Indirectly. They occupy overlapping but distinct niches. Copilot is best understood as autocomplete-plus-chat. Claude Code is best understood as an agent. Comparing them is closer to comparing an autocomplete to a junior dev who can run commands.',
      },
      {
        question: 'Can I use both?',
        answer:
          'Yes. Many devs keep Copilot active in their IDE for typing-time suggestions and reach for Claude Code in the terminal for multi-step tasks.',
      },
      {
        question: 'Which is cheaper?',
        answer:
          'Copilot has a flat $10/mo Individual plan. Claude Code via Pro is $20/mo with monthly usage limits, or pay-per-use via API. For light usage, Copilot is cheaper; for heavy agentic workflows, Claude Code\'s pay-per-use can be better value.',
      },
      {
        question: 'Does Copilot run agents like Claude Code?',
        answer:
          'GitHub introduced Copilot Agents in 2025 with multi-step task execution. Capabilities are growing but agentic mode is still newer than Claude Code\'s, which was agent-native from launch.',
      },
    ],
    related: [
      { slug: 'cursor', label: 'Claude Code vs Cursor', type: 'compare' },
      { slug: 'codex-cli', label: 'Claude Code vs Codex CLI', type: 'compare' },
      { slug: 'top-ai-coding-tools-2026', label: 'Top AI Coding Tools 2026', type: 'lists' },
      { slug: 'what-is-claude-code', label: 'What is Claude Code?', type: 'glossary' },
    ],
    lastReviewed: '2026-05',
  },

  {
    slug: 'aider',
    name: 'Aider',
    tagline: 'AI pair programming in your terminal (open source)',
    summary:
      'Aider is an open-source CLI AI coding assistant — the original terminal-native agent, dating to 2023. Claude Code is Anthropic\'s newer terminal agent with deeper Anthropic-stack integration.',
    table: [
      { feature: 'Surface', claudeCode: 'Terminal CLI', other: 'Terminal CLI' },
      { feature: 'License', claudeCode: 'Closed (Anthropic)', other: 'Apache 2.0' },
      { feature: 'Model support', claudeCode: 'Claude only', other: 'Claude, GPT, Gemini, DeepSeek, Ollama, OpenRouter' },
      { feature: 'Git integration', claudeCode: 'Reads/writes via tool use', other: 'Native — auto-commits per edit' },
      { feature: 'Voice mode', claudeCode: 'No', other: 'Yes — speak edits aloud' },
      { feature: 'Skills / plugins', claudeCode: 'Skill ecosystem', other: 'Configurable conventions, no plugin marketplace' },
      { feature: 'Best for', claudeCode: 'Polished agent workflows on Claude', other: 'Multi-model, fully open-source terminal coding' },
    ],
    intro:
      'Aider, created by Paul Gauthier, is the most respected open-source terminal AI coding tool. It introduced patterns Claude Code later refined — repo maps, edit/diff loops, terminal-first interaction. The comparison comes down to ecosystem: Aider is provider-agnostic and Apache 2.0; Claude Code is Anthropic-first and closed but ships polish + new features faster.',
    bestForClaudeCode: [
      'Workflows that benefit from new Claude features the moment they ship',
      'Skill-driven coding — installing reusable agent capabilities',
      'Integrated billing and usage tracking via Anthropic Pro/Max',
      'Pushing structured usage data to vibecodestats.dev via stop hooks',
    ],
    bestForOther: [
      'Multi-model experimentation — try the same task on Claude, GPT, and Gemini',
      'Local-model use via Ollama for offline or privacy-sensitive work',
      'Voice-driven coding — speak your edits',
      'Auditable, fork-able tool you control end-to-end',
    ],
    decisionTree:
      'Need maximum model flexibility or want to fork the agent? → Aider. Want polished Claude-native workflows and the skill ecosystem? → Claude Code. Both are excellent terminal-native tools and have more in common than not.',
    faq: [
      {
        question: 'Did Claude Code copy Aider?',
        answer:
          'Claude Code and Aider share design DNA — terminal-native, repo-aware, edit-via-diff — but they\'re independent codebases. Aider predates Claude Code by ~18 months. Both have influenced each other and the broader AI coding tool category.',
      },
      {
        question: 'Can Aider use Claude Sonnet 4.6 or Opus 4.7?',
        answer:
          'Yes. Aider supports the full Anthropic API. Many users run Aider with Claude as their primary model. You bring your own API key.',
      },
      {
        question: 'Is Aider really free?',
        answer:
          'The tool itself is free and open source. You pay for whatever model you point it at (Anthropic, OpenAI, Google, etc.) via that provider\'s API.',
      },
      {
        question: 'Why use Claude Code if Aider is free?',
        answer:
          'Skills, polish, first-party Anthropic feature support, integrated billing, and the leaderboard ecosystem at vibecodestats.dev. For some users that\'s worth paying for; for others, free Aider with their own API key wins.',
      },
    ],
    related: [
      { slug: 'cline', label: 'Claude Code vs Cline', type: 'compare' },
      { slug: 'codex-cli', label: 'Claude Code vs Codex CLI', type: 'compare' },
      { slug: 'best-cli-coding-agents', label: 'Best CLI Coding Agents', type: 'lists' },
      { slug: 'what-is-a-cli-coding-agent', label: 'What is a CLI Coding Agent?', type: 'glossary' },
    ],
    lastReviewed: '2026-05',
  },

  {
    slug: 'codex-cli',
    name: 'Codex CLI',
    tagline: 'OpenAI\'s terminal-native coding agent',
    summary:
      'Codex CLI is OpenAI\'s open-source terminal coding agent, released in 2025. Claude Code is Anthropic\'s. Same shape (terminal-first, agentic), different vendor, different models, different ecosystems.',
    table: [
      { feature: 'Surface', claudeCode: 'Terminal CLI', other: 'Terminal CLI' },
      { feature: 'Vendor', claudeCode: 'Anthropic', other: 'OpenAI' },
      { feature: 'Default model', claudeCode: 'Claude Sonnet 4.6 / Opus 4.7', other: 'GPT-5 Codex / o-series' },
      { feature: 'License', claudeCode: 'Closed', other: 'Apache 2.0 (Codex CLI itself, models proprietary)' },
      { feature: 'Pricing', claudeCode: 'API costs or Pro/Max plan', other: 'API costs or ChatGPT Plus/Pro/Team' },
      { feature: 'Skill ecosystem', claudeCode: 'Yes', other: 'Limited (AGENTS.md conventions)' },
      { feature: 'MCP', claudeCode: 'Yes', other: 'Yes' },
      { feature: 'Best for', claudeCode: 'Claude-model-heavy workflows', other: 'GPT/o-series workflows, OpenAI-stack devs' },
    ],
    intro:
      'Codex CLI was OpenAI\'s answer to the agentic coding wave Claude Code helped define. The tools are structurally similar — both run in your terminal, both edit files via tool use, both ship as the first-party agent for their respective frontier model. The choice almost always comes down to which model family you trust more for your work.',
    bestForClaudeCode: [
      'Workflows where Claude\'s strengths show: long-context reasoning, careful multi-step plans, code that needs subtle judgment',
      'Devs invested in the Anthropic stack — Pro/Max plan, MCP servers, skills',
      'Tracking deep work via vibecodestats.dev (Codex CLI has no equivalent leaderboard)',
      'Extended thinking mode for hard reasoning tasks',
    ],
    bestForOther: [
      'Workflows where GPT-5 / o-series strengths show: extremely fast iteration, certain math/algorithm tasks',
      'Devs already on ChatGPT Plus or Pro who want CLI access without extra spend',
      'Teams standardized on OpenAI for everything (chat, search, vision, code)',
      'Open-source CLI codebase you can fork or audit',
    ],
    decisionTree:
      'Pick the agent that ships with the model you trust more for your code. If you switch frequently between Claude and GPT, run both — they don\'t conflict, and you\'ll get a real sense of which serves your workflow.',
    faq: [
      {
        question: 'Is Codex CLI a clone of Claude Code?',
        answer:
          'No, but the design space converged. Both are terminal-first, agentic, and built around model tool use. The implementations and ecosystems are independent.',
      },
      {
        question: 'Can Codex CLI use Claude models?',
        answer:
          'Not officially. Codex CLI is OpenAI\'s product and routes to OpenAI models. There are community forks that route to other providers.',
      },
      {
        question: 'Which is faster?',
        answer:
          'Depends on the specific task and model. GPT-5 Codex is fast for short tasks. Claude Sonnet 4.6 is fast for everything moderate; Opus is slower but more careful. Track your own session times on vibecodestats.dev to measure for your workflow.',
      },
      {
        question: 'Do they share MCP server compatibility?',
        answer:
          'Both support MCP. Most MCP servers work with both, though some lean Anthropic-first (e.g. Anthropic-built MCP servers) or OpenAI-first.',
      },
    ],
    related: [
      { slug: 'aider', label: 'Claude Code vs Aider', type: 'compare' },
      { slug: 'github-copilot', label: 'Claude Code vs GitHub Copilot', type: 'compare' },
      { slug: 'best-cli-coding-agents', label: 'Best CLI Coding Agents', type: 'lists' },
      { slug: 'top-ai-coding-tools-2026', label: 'Top AI Coding Tools 2026', type: 'lists' },
    ],
    lastReviewed: '2026-05',
  },
];

/** Get a tool by slug, or null if not found. */
export function getCompareTool(slug: string): CompareTool | null {
  return compareTools.find((t) => t.slug === slug) ?? null;
}
