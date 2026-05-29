import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── fetch mock ────────────────────────────────────────────────────────────────
// We replace the global fetch with a vi.fn() so tests never hit the real Resend
// API. Each test controls the mock independently via fetchMock.
const fetchMock = vi.fn(async () => new Response('{}', { status: 200 }));

beforeEach(() => {
  vi.stubGlobal('fetch', fetchMock);
  vi.resetModules();
  fetchMock.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

type FetchCall = [url: string, init: RequestInit];

/** Pull the parsed JSON body from the first fetch call. */
function firstCallBody(): Record<string, unknown> {
  const calls = fetchMock.mock.calls as unknown as FetchCall[];
  const init = calls[0]?.[1];
  return JSON.parse(init?.body as string) as Record<string, unknown>;
}

/** Pull the URL from the first fetch call. */
function firstCallUrl(): string {
  const calls = fetchMock.mock.calls as unknown as FetchCall[];
  return calls[0]?.[0] ?? '';
}

/** Pull the init from the first fetch call. */
function firstCallInit(): RequestInit {
  const calls = fetchMock.mock.calls as unknown as FetchCall[];
  return calls[0]?.[1] ?? {};
}

// ─────────────────────────────────────────────────────────────────────────────
// sendWelcomeEmail
// ─────────────────────────────────────────────────────────────────────────────
describe('sendWelcomeEmail', () => {
  it('calls Resend when RESEND_API_KEY is set', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const { sendWelcomeEmail } = await import('../../lib/notify/welcome');

    await sendWelcomeEmail('user@example.com');

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(firstCallUrl()).toBe('https://api.resend.com/emails');

    expect(firstCallInit().headers).toMatchObject({
      Authorization: 'Bearer test-resend-key',
    });

    const body = firstCallBody();
    expect(body.to).toContain('user@example.com');
    expect(body.subject).toBeTruthy();
    expect(typeof body.text).toBe('string');
    expect(body.text as string).toContain('@realholdengr');
  });

  it('is a no-op (no fetch call) when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.resetModules();
    const { sendWelcomeEmail } = await import('../../lib/notify/welcome');

    await sendWelcomeEmail('user@example.com');

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when fetch rejects', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    const { sendWelcomeEmail } = await import('../../lib/notify/welcome');

    await expect(sendWelcomeEmail('user@example.com')).resolves.toBeUndefined();
  });

  it('never throws when fetch resolves with an error status', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    fetchMock.mockResolvedValueOnce(new Response('{"message":"Unauthorized"}', { status: 401 }));
    const { sendWelcomeEmail } = await import('../../lib/notify/welcome');

    await expect(sendWelcomeEmail('user@example.com')).resolves.toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// notifyOwnerOfTeamPick
// ─────────────────────────────────────────────────────────────────────────────
describe('notifyOwnerOfTeamPick', () => {
  it('posts to Resend with handle + team name in subject and body', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const { notifyOwnerOfTeamPick } = await import('../../lib/notify/welcome');

    await notifyOwnerOfTeamPick({ handle: 'alice', team: 'claude_code', optedIn: true });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(firstCallUrl()).toBe('https://api.resend.com/emails');

    const body = firstCallBody();
    expect(body.subject as string).toContain('@alice');
    expect(body.subject as string).toContain('Team Claude Code');
    expect(body.text as string).toContain('@alice');
    expect(body.text as string).toContain('Team Claude Code');
    expect(body.text as string).toContain('yes');
  });

  it('uses "Team Codex" label for codex team', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    const { notifyOwnerOfTeamPick } = await import('../../lib/notify/welcome');

    await notifyOwnerOfTeamPick({ handle: 'bob', team: 'codex', optedIn: false });

    const body = firstCallBody();
    expect(body.subject as string).toContain('Team Codex');
    expect(body.text as string).toContain('Team Codex');
    expect(body.text as string).toContain('no');
  });

  it('sends to OWNER_EMAIL (defaults to holden@holdengr.com)', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    // Do not stub OWNER_EMAIL — undefined triggers the default fallback
    const { notifyOwnerOfTeamPick } = await import('../../lib/notify/welcome');

    await notifyOwnerOfTeamPick({ handle: 'carol', team: 'claude_code', optedIn: false });

    const body = firstCallBody();
    expect(body.to).toContain('holden@holdengr.com');
  });

  it('is a no-op (no fetch call) when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.resetModules();
    const { notifyOwnerOfTeamPick } = await import('../../lib/notify/welcome');

    await notifyOwnerOfTeamPick({ handle: 'dave', team: 'codex', optedIn: false });

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('never throws when fetch rejects', async () => {
    vi.stubEnv('RESEND_API_KEY', 'test-resend-key');
    fetchMock.mockRejectedValueOnce(new Error('network error'));
    const { notifyOwnerOfTeamPick } = await import('../../lib/notify/welcome');

    await expect(
      notifyOwnerOfTeamPick({ handle: 'eve', team: 'claude_code', optedIn: true }),
    ).resolves.toBeUndefined();
  });
});
