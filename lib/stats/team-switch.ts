// Team-switch throttle + defector window. Pure date logic; no I/O.
const DAY_MS = 24 * 60 * 60 * 1000
export const SWITCH_COOLDOWN_DAYS = 30
export const DEFECTOR_WINDOW_DAYS = 14

export function canSwitchTeam(teamSwitchedAt: string | null, now: Date): boolean {
  if (!teamSwitchedAt) return true
  const last = new Date(teamSwitchedAt).getTime()
  if (Number.isNaN(last)) return true
  return now.getTime() - last >= SWITCH_COOLDOWN_DAYS * DAY_MS
}

export function isRecentDefector(teamSwitchedAt: string | null, now: Date): boolean {
  if (!teamSwitchedAt) return false
  const last = new Date(teamSwitchedAt).getTime()
  if (Number.isNaN(last)) return false
  return now.getTime() - last < DEFECTOR_WINDOW_DAYS * DAY_MS
}
