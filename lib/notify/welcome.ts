/**
 * Onboarding notification helpers.
 *
 * Both functions follow the same Resend gate + soft-fail pattern as
 * emailOwnerForSignupEvent in lib/notify/signup.ts:
 *   - gated on RESEND_API_KEY (no-op when unset)
 *   - wrapped in try/catch (never throws)
 *   - all awaited (no fire-and-forget on CF edge)
 */

type Team = 'claude_code' | 'codex';

function resendKey() {
  return process.env.RESEND_API_KEY;
}

function fromAddress() {
  return process.env.NOTIFY_FROM_EMAIL ?? 'vibecodestats <noreply@vibecodestats.dev>';
}

function ownerAddress() {
  return process.env.OWNER_EMAIL ?? 'holden@holdengr.com';
}

/**
 * Send a welcome email to a new user who opted into updates.
 * No-op when RESEND_API_KEY is not set. Never throws.
 */
export async function sendWelcomeEmail(toEmail: string): Promise<void> {
  const apiKey = resendKey();
  if (!apiKey) return;

  const subject = 'You joined vibecodestats';

  const body = [
    "Hey, you're on the board.",
    '',
    'You just picked a team on vibecodestats.dev and opted in for updates from me (@realholdengr). Here is what that means:',
    '',
    '- You will get occasional notes when something meaningful changes on the site (new stats, team standings, tier milestones).',
    '- No spam. No drip sequences. Just the real stuff worth knowing.',
    '',
    'Track where you stand any time at vibecodestats.dev.',
    '',
    '-- Holden',
    'vibecodestats.dev',
  ].join('\n');

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [toEmail],
        subject,
        text: body,
      }),
    });
  } catch {
    // never throw from notification path
  }
}

/**
 * Notify the site owner that a user picked a team during onboarding.
 * Includes their handle, which team they joined, and whether they opted
 * into email. No-op when RESEND_API_KEY is not set. Never throws.
 */
export async function notifyOwnerOfTeamPick(opts: {
  handle: string;
  team: Team;
  optedIn: boolean;
}): Promise<void> {
  const apiKey = resendKey();
  if (!apiKey) return;

  const teamLabel = opts.team === 'claude_code' ? 'Team Claude Code' : 'Team Codex';
  const subject = `vibecodestats: @${opts.handle} joined ${teamLabel}`;

  const lines = [
    `Handle: @${opts.handle}`,
    `Team: ${teamLabel}`,
    `Email opt-in: ${opts.optedIn ? 'yes' : 'no'}`,
    '',
    'View leaderboard: https://vibecodestats.dev',
  ];

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress(),
        to: [ownerAddress()],
        subject,
        text: lines.join('\n'),
      }),
    });
  } catch {
    // never throw from notification path
  }
}
