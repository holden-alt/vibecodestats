// Day-boundary helper. The dashboard reports usage by the user's LOCAL day, not
// UTC. Using `new Date().toISOString().slice(0,10)` (UTC) rolls "today" forward
// at UTC midnight — 8pm US-Eastern — so the evening's work appears to vanish.
// The push script keys rows by the machine's local date; this keeps the web's
// notion of "today" on the same clock.
//
// (Single-tz for now — America/New_York. Per-user timezones are a follow-up; at
// that point `tz` comes from the profile instead of this default.)
const DEFAULT_TZ = 'America/New_York';

/** Current calendar date ('YYYY-MM-DD') in the given timezone. */
export function todayLocal(tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  // en-CA renders as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}
