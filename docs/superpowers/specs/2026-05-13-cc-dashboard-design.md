# cc-dashboard — Design

**Status:** v1 design, awaiting Holden's review
**Date:** 2026-05-13
**Repo:** `~/Claude/holden-alt/cc-dashboard`
**Domain:** `vibecodestats.dev`

---

## 1. What this is

A public, terminal-styled builder profile that takes the whole shape of Holden as a Claude Code vibecoder — stats, builds, skills, badges, personas, notes, leaderboards — designed for Holden on day one and architected to host other vibecoders later.

The homepage **is** `/holden`. There is no separate marketing page. The profile is the product.

**Dopamine charter:** earn badges, get classified into personas, watch the heatmap fill in, see the streak grow, beat your past self, beat your friends. Pure positive reinforcement.

## 2. Audience and posture

- **v1:** just Holden. Public stats numbers from day one (tokens, streak, badges, model %, ship counts) — but project names default-private.
- **v2+:** community of vibecoders. Each has a profile URL. Leaderboards become real.
- **Architecture from day one:** every data path is built as if there will be many users, even though only one row exists.
- **Privacy hygiene:** every project (repo / directory) is private-by-default in the dashboard. Aggregate counts (commits, sessions, tokens) include private work. Names of private projects are never shown publicly. Holden flips individual projects to public-by-name to surface them on the profile.

## 3. Aesthetic + layout

**Aesthetic:** pure terminal. Dark background (`#0d0d0d`), warm off-white text (`#ece6dc`), monospace everywhere (`ui-monospace`, falls back to `SF Mono`/`Menlo`). Borders are single-pixel `#2a2622`. Section dividers are uppercase letter-spaced labels.

**Polychrome accent palette** (each metric/section has a color):

| Color   | Hex       | Used for                                  |
| ------- | --------- | ----------------------------------------- |
| Orange  | `#d97757` | Claude primary. Activity, "you", flame.   |
| Cyan    | `#6bbfd9` | Builds, machines, common badges.          |
| Magenta | `#c47cb8` | Persona, head-to-head, special.           |
| Yellow  | `#e3c466` | Badges, gold rank, streaks.               |
| Green   | `#8fbc8f` | Shipped, up-arrows, "win" outcomes.       |
| Blue    | `#7a9cd9` | Notes, calm/contemplative.                |
| Red     | `#d97373` | Down-arrows, "lose" outcomes, warnings.   |

**Powerline status bar** sits at the very top of `/holden`. Each segment is its own background color (orange / magenta / yellow / green / cyan / blue) with chevron clip-paths between segments — same energy as a customized zsh powerline prompt.

**Page structure:** TUI multi-pane hero + scrollable depth below.

1. **Powerline status bar** — identity, persona, streak, rank, tokens (today), badges count, timestamp
2. **3-pane hero** — `builds` (cyan accent) / `activity` (orange accent) / `persona + badges + next-up` (magenta accent)
3. **Trends · 30d** — 2 charts side by side: daily tokens bar chart, model-mix area chart
4. **You vs You** — this week vs last week with `▲▼` deltas + personal-best callout
5. **Leaderboard** — full controls (metric × window × scope × view) with rank list / bar comparison / race chart modes
6. **Group bar comparison** — squad you're in, side-by-side bars vs your friends
7. **Head-to-head** — pick another vibecoder, compare stat-by-stat with win/lose/tie
8. **Stats explorer** — tabbed multi-chart view: trends, model mix donut, time-of-day histogram, day-of-week bars, projects, skills, machines
9. **Skills · top 6** with progress bars + link to all skills
10. **Notes · latest 3** with link to all notes
11. **Goals + machines** — weekly/monthly targets, per-machine activity

## 4. Stats explorer — view catalog (v1)

Each view picks from these dimensions: **metric**, **time window**, **scope**, **visualization**.

**Metrics tracked:**
- tokens (total, by-model)
- sessions / hours
- streak days
- ships (commits, PRs merged, releases)
- opus %
- deep-work hours (continuous session > N min)
- badges earned
- skills used
- projects touched

**Time windows:** today, this week, this month, this quarter, this year, all-time

**Visualizations:**
- Calendar heatmap (52 weeks)
- Bar chart (daily/weekly/monthly)
- Area chart (stacked, for model mix over time)
- Donut chart (model split, project split)
- Histogram (time-of-day, day-of-week)
- Sparkline (in-line trend indicator)
- Bar comparison (group, head-to-head)
- Rank list (leaderboard)
- Race chart (animated rank-over-time)

## 5. Leaderboard system

Leaderboards are first-class. Filter dimensions:

- **Metric** — any tracked metric from §4
- **Window** — today / week / month / quarter / year / all-time
- **Scope** — global / my groups / by persona / friends
- **View** — rank list / bar comparison / race chart

Groups are explicit objects you can be in (multi-membership). The "rapid shippers" / "night owls" / "ATL builders" kind of thing. v1 has the schema for groups but only Holden's pre-seeded "default" group.

Head-to-head is its own surface: `/holden/vs/@mira` shows side-by-side stat-by-stat comparison.

## 6. Badge + persona system

### Badges

Badges are explicit, discoverable, earnable. Each has: `slug`, `name`, `tier` (common/rare/legendary), `color` (one of the palette), `description`, `criteria` (a function over user data), `earnedAt` (per user).

**v1 badge catalog (target ~50):**

- **Volume:** `million-token-day`, `10M-week`, `100M-all-time`
- **Streaks:** `7d-streak`, `14d-streak`, `30d-streak`, `90d-streak`, `365d-streak`
- **Model loyalty:** `opus-pilled` (>95% opus week), `sonnet-loyalist`, `haiku-haiku`
- **Time:** `night-owl` (peak hour 22:00+), `early-bird` (peak hour <8:00), `weekend-warrior`
- **Multi-machine:** `two-machine`, `three-machine`
- **Ship cadence:** `daily-shipper` (commits 7/7 days), `ship-streak`, `pr-merged-week`
- **Deep work:** `deep-work` (>4h continuous session), `marathon` (>8h session)
- **Skills:** `skill-collector` (used >10 distinct skills/week), `skill-builder` (created custom skill)
- **Projects:** `polymath` (3+ active projects), `mono-builder` (one project all week)
- **Social (v2):** `first-friend`, `squad-leader`, `top-3-week`, `dethroned`

Each badge is rendered as a pill in the user's chosen palette color. New unlocks trigger a small celebration (animation, toast). Locked badges show grayed out with progress bars toward unlock.

### Personas

Personas are **auto-inferred from behavior**, re-evaluated weekly. Up to 3 active at a time (primary + 2 secondary). The catalog is curated but assignment is algorithmic.

**v1 persona catalog (target ~12):**

- `THE FOUNDER` — many concurrent projects, broad model use, high token volume
- `THE CRAFTSMAN` — fewer projects, deep sessions, polish-focused, lots of edits per project
- `THE MARATHONER` — long sessions, deep-work badge frequent
- `THE SPRINTER` — short bursts, high token velocity
- `THE OPUS-PILLED` — >95% Opus
- `THE NIGHT OWL` — peak hours after 22:00
- `THE EARLY BIRD` — peak hours before 8:00
- `THE SHIPPER` — high commit + PR velocity
- `THE SCHOLAR` — heavy notes, builds new skills, asks questions
- `THE TINKERER` — many one-off scripts and short projects
- `THE ARCHITECT` — long planning sessions, lots of writing-plans use
- `THE COMMUNITY` — high friend / group activity (v2)

**Inference approach v1:** rules-based scoring. Each persona has a scoring function over the user's last-30-day stats. Top score = primary, next 2 = secondary (with min threshold so we don't force a label on no data). Re-runs weekly via cron.

**v1.5 / v2:** consider LLM-based persona inference (call Claude API with summarized stats + persona catalog + reasoning prompt). More interesting/surprising but costs money per user per week. Defer.

## 7. Stack + deployment

- **Framework:** Next.js (App Router, React Server Components, server actions)
- **Language:** TypeScript
- **Database:** Supabase (Postgres + Auth + Storage)
- **Auth:** Supabase Auth via **GitHub OAuth**, minimum scope (`read:user` only — handle, name, avatar). No `repo` scope. Ship counts come from local `git log` via the Stop hook, not from GitHub API, so private-repo work counts toward dashboard numbers without ever leaving the Mac as named data.
- **Styling:** Tailwind CSS + custom CSS variables for the palette
- **Charts:** custom components (no chart lib for v1 — TUI styling is too specific to lean on Recharts/Chart.js). Build with divs + grid + gradients. We may add `d3-scale` for axis math only.
- **Animation:** Framer Motion for badge unlocks + leaderboard transitions
- **Deploy:** Cloudflare Pages (Next.js on Pages is mature; Holden already has CF accounts)
- **Domain:** `vibecodestats.dev`

## 8. Data layer

**Source of truth (Approach A — locked, real-time variant):**

- **Existing `refresh-stats.py` is not touched.** Your `/stats` command keeps working exactly as today.
- A new **`Stop` hook** in `~/.claude/settings.json` runs after every Claude Code turn. The hook calls a new local script `dashboard-push.py` (sibling to `refresh-stats.py`) that:
  - Reads token totals from the same source `refresh-stats.py` uses.
  - Walks `~/.claude/projects/` to count sessions, measure deep-work minutes, and list projects touched.
  - Runs `git log` locally across known repos to count commits/PRs/ships (private repo work counted; names omitted unless project is opted public).
  - POSTs the delta to `https://vibecodestats.dev/api/ingest` with a per-machine HMAC signature.
- The webhook upserts `daily_stats` in Supabase.
- The browser tab subscribes via **Supabase Realtime** — when `daily_stats` changes, the dashboard pushes the update without a refresh: token counter ticks up live, today's heatmap cell pulses, badge unlocks animate the moment criteria are met.
- The **git-based pipeline stays** as a backup persistence layer. If the dashboard goes down or a Mac is offline, your `/stats` command and the git JSON files are unaffected.
- **Derived data** (badges earned, persona assignments, notes, goals, group memberships, friendships) lives natively in Supabase as the source of truth.

**Supabase schema (v1):**

```
users
  id, github_id, github_handle, display_name, primary_persona, secondary_personas[], created_at

daily_stats
  user_id, date, tokens_total, tokens_by_model (jsonb), sessions, deep_work_minutes, machines[],
  projects_touched (jsonb), ships (jsonb), source_synced_at
  PK (user_id, date)

badges_catalog
  slug, name, tier, color, description, criteria_version

user_badges
  user_id, badge_slug, earned_at, progress (0..1)
  PK (user_id, badge_slug)

persona_catalog
  slug, name, color, description, scoring_version

groups
  id, slug, name, description, color, owner_id, created_at

group_members
  group_id, user_id, role, joined_at

notes
  id, user_id, body, created_at, tags[]

goals
  id, user_id, metric, target, window (week/month), period_start, period_end

friendships
  user_id, friend_id, created_at  (symmetric, both directions stored)
```

**Ingestion path (other users, v2):** Each user installs a small CLI helper (`vibecoders push`) that authenticates and POSTs their stats to a dashboard ingestion endpoint. Holden's git-based path stays unchanged.

## 9. Routes (v1)

| Route                  | Purpose                                             | Auth        |
| ---------------------- | --------------------------------------------------- | ----------- |
| `/`                    | Marketing-light landing. "vibecoder profiles." CTA to sign in or view Holden | public |
| `/holden`              | Holden's profile — the full TUI dashboard            | public      |
| `/:handle`             | Any user's profile (just Holden in v1)               | public      |
| `/:handle/vs/:handle`  | Head-to-head between two users                       | public      |
| `/me`                  | Redirects to your own profile if signed in           | auth        |
| `/me/edit`             | Profile settings, group memberships, goals, notes    | auth        |
| `/leaderboard`         | Global leaderboards with all filters                 | public      |
| `/groups/:slug`        | Group leaderboards and bar comparisons               | public      |
| `/badges`              | Full catalog with unlock requirements                | public      |
| `/personas`            | Full persona catalog with criteria                   | public      |
| `/api/refresh-stats`   | Webhook for CF Worker cron to push fresh stats       | service key |

All public routes get full SSR with structured data (Person schema for profiles, ItemList for leaderboards), OG images generated per profile, and AEO-friendly meta tags.

## 10. Stats freshness — real-time

- **Push, not poll.** The Claude Code `Stop` hook on each Mac fires after every turn. `dashboard-push.py` computes the delta and POSTs it to `/api/ingest`.
- **Real-time UI.** The open browser tab subscribes to Supabase Realtime on `daily_stats` for the visible user. Tokens tick up live, heatmap cell for today pulses on new data, badge unlocks animate on criteria.
- **Profile load:** reads from Supabase only. SSR is fast, no remote-fetch in the request path.
- **Badge eval:** runs server-side after every `daily_stats` upsert for the affected user. Newly-earned badges flow back to the browser via the same Realtime channel.
- **Persona re-eval:** runs nightly (cron in CF Worker) — personas are weekly-averaged so daily oscillation isn't useful.
- **Manual refresh button:** small refresh icon on the profile re-checks the local Mac data and forces a push, in case a Stop hook is misconfigured.

### Per-machine sync

- Each of Holden's two Macs (iMac + MacBook-Air) runs the same Stop hook independently.
- Each push includes a `machine` field so the dashboard can show per-machine breakdown (the "machines" section already in the design).
- HMAC signature on each push — Supabase rejects pushes without a valid signature for the claimed machine, so a rogue actor can't ingest fake data for your profile.

## 11. v1 scope — what's in, what's out

### In
- Holden's profile, fully populated, at `/holden`
- Powerline status bar, 3-pane hero, 30d charts, you-vs-you, leaderboard (only him), group bar comparison (with seeded fake squad for visual), head-to-head (with seeded sample opponent), stats explorer with 5+ chart types
- Badge catalog of ~50 badges with earned/unlocked rendering
- Persona inference with ~12 personas, rules-based scoring, weekly re-eval
- Supabase schema for users, daily_stats, badges, personas, groups, notes, goals, friendships
- GitHub OAuth sign-in (only Holden's account active)
- CF Worker pulling stats from git remote every 10 min
- Public profile SSR + AEO metadata + OG images
- Deploy on Cloudflare Pages at `vibecoders.club`

### Out (v2+)
- Other real users signing up
- `vibecoders push` CLI for non-Holden ingestion
- Real group creation/management UI
- Friend system real connections
- LLM-based persona inference
- Mobile-optimized layout (v1 is desktop-first; mobile reads but doesn't shine)
- Race chart animation
- Profile customization (palette, layout)

## 12. Decisions (resolved 2026-05-13)

All five open questions answered before plan:

1. **Domain:** `vibecodestats.dev`.
2. **Stats history:** derived externally. New `dashboard-push.py` script reads CC project data + local git logs; `refresh-stats.py` is not modified.
3. **Public stats + privacy:** stats numbers public from day one; project names default-private; Holden opts individual projects public-by-name.
4. **LLM persona inference:** deferred to v2. v1 uses free rules-based scoring.
5. **GitHub OAuth scope:** `read:user` only. Ship metrics come from local `git log`, never from GitHub API, so no `repo` scope is ever requested.

## 13. Non-goals

- This is **not** a Claude Code coaching tool — it doesn't tell you to do better. It shows you what you did.
- This is **not** a productivity tracker in the discipline sense (no "you missed yesterday, shame on you" UX). All copy is dopaminergic — celebrate the streak, never punish the gap.
- This is **not** competitive surveillance — head-to-head is opt-in, and rankings on opaque metrics (tokens) are explicitly framed as fun, not real value judgments.
- This is **not** a Claude Code admin tool — no usage management, no team billing, no API key handling.
