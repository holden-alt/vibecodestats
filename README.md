# vibecodestats

Public Claude Code usage stats — Strava-style global leaderboard, live token counter, persistent profiles.

Live at https://vibecodestats.dev. Pick any handle, e.g. https://vibecodestats.dev/holden-alt.

## What it does

- Reads your local Claude Code session logs (`~/.claude/projects/*/*.jsonl`)
- Aggregates daily token totals, sessions, deep work, ships (git commits), per-project breakdowns
- Pushes to a public profile page that updates live as you code
- Ranks you against every other user on a global leaderboard

## What it doesn't do

- Does not read or upload your code, prompts, model responses, or anything else from the session logs
- Only token counts, timestamps, model names, and the current project's directory name are sent
- Per-user Bearer token authenticates each push — no shared secret

## Install (macOS)

After signing in with GitHub at https://vibecodestats.dev, you'll get a one-line command on `/setup`:

```bash
curl -fsSL https://vibecodestats.dev/install.sh | TOKEN=<your-token> HANDLE=<your-handle> URL=https://vibecodestats.dev bash
```

That installs the push script at `~/.config/cc-dashboard/dashboard_push.py`, drops a Stop hook into `~/.claude/settings.json`, and verifies the first push lands.

## Stack

- Next.js 15 on Cloudflare Pages (edge runtime)
- Supabase Postgres (with realtime publication on daily_stats)
- Recharts + @uiw/react-heat-map
- Tailwind 4

## Privacy

- Profiles are public by default. The whole point is sharing your stats.
- Source data (Claude Code JSONL logs) never leaves your machine.
- The push script POSTs aggregated daily totals + project names — no message content.
- Tokens are per-user; revoke/regenerate from `/setup`.

## License

MIT — see LICENSE
