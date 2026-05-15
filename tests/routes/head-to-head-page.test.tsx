import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const h2hData = {
  userA: { id: 'u1', github_handle: 'holden-alt', display_name: 'Holden' },
  userB: { id: 'u2', github_handle: 'mira-builds', display_name: 'Mira' },
  statsA: [{ user_id: 'u1', date: '2026-05-14', tokens_total: 100, tokens_by_model: {},
    sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null }],
  statsB: [{ user_id: 'u2', date: '2026-05-14', tokens_total: 500, tokens_by_model: {},
    sessions: 1, deep_work_minutes: 0, machines: [], projects_touched: {},
    ships: {}, hourly_tokens: {}, source_synced_at: null }],
};

const notFoundMock = vi.fn(() => {
  throw new Error('NEXT_NOT_FOUND');
});
vi.mock('next/navigation', () => ({ notFound: notFoundMock }));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({})),
}));

const getH2HMock = vi.fn(async () => h2hData);
vi.mock('@/lib/stats/head-to-head-data', () => ({
  getHeadToHeadData: getH2HMock,
}));

describe('/[handle]/vs/[opponent] route', () => {
  it('renders both users + the 5 stat rows when both handles resolve', async () => {
    getH2HMock.mockResolvedValueOnce(h2hData);
    const { default: H2HPage } = await import('../../app/[handle]/vs/[opponent]/page');
    const ui = await H2HPage({
      params: Promise.resolve({ handle: 'holden-alt', opponent: 'mira-builds' }),
    });
    const { container } = render(ui);
    expect(container.querySelector('[data-head-to-head]')).toBeTruthy();
    expect(container.textContent).toContain('Holden');
    expect(container.textContent).toContain('Mira');
    expect(container.querySelectorAll('[data-stat-row]').length).toBe(5);
  });

  it('calls notFound() when either handle is missing', async () => {
    getH2HMock.mockResolvedValueOnce(null as unknown as typeof h2hData);
    const { default: H2HPage } = await import('../../app/[handle]/vs/[opponent]/page');
    await expect(
      H2HPage({ params: Promise.resolve({ handle: 'holden-alt', opponent: 'no-such-user' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it('calls notFound() when handle === opponent (self-vs-self)', async () => {
    const { default: H2HPage } = await import('../../app/[handle]/vs/[opponent]/page');
    await expect(
      H2HPage({ params: Promise.resolve({ handle: 'holden-alt', opponent: 'holden-alt' }) }),
    ).rejects.toThrow('NEXT_NOT_FOUND');
    // getHeadToHeadData should not be called for self-vs-self
    expect(getH2HMock).not.toHaveBeenCalledWith(expect.anything(), 'holden-alt', 'holden-alt');
  });
});
