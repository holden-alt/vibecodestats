// Team Claude Code vs Team Codex. Codex = sum of gpt-* model tokens; Claude = the rest.
// Allegiance (users.team) is a CHOSEN tag stored separately; this module is the
// token-derived split used for the daily scoreboard and the per-card model readout.

export type Camp = 'claude_code' | 'codex'

export interface CampSplit { claude: number; codex: number }

const isCodexModel = (model: string) => model.trim().toLowerCase().startsWith('gpt')

export function splitTokensByCamp(tokensByModel: Record<string, number> | null | undefined): CampSplit {
  const out: CampSplit = { claude: 0, codex: 0 }
  if (!tokensByModel) return out
  for (const [model, count] of Object.entries(tokensByModel)) {
    const n = Number(count) || 0
    if (isCodexModel(model)) out.codex += n
    else out.claude += n
  }
  return out
}

export interface Scoreboard {
  claude: number; codex: number
  claudePct: number; codexPct: number
  leader: Camp
}

export function campScoreboard(maps: Array<Record<string, number> | null | undefined>): Scoreboard {
  const total: CampSplit = { claude: 0, codex: 0 }
  for (const m of maps) {
    const s = splitTokensByCamp(m)
    total.claude += s.claude
    total.codex += s.codex
  }
  const sum = total.claude + total.codex
  const claudePct = sum > 0 ? Math.round((total.claude / sum) * 100) : 50
  return {
    claude: total.claude,
    codex: total.codex,
    claudePct,
    codexPct: 100 - claudePct,
    leader: total.codex > total.claude ? 'codex' : 'claude_code',
  }
}
