/**
 * Tests for /admin/signups — now a redirect to /admin.
 */
import { describe, it, expect, vi } from 'vitest';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

describe('GET /admin/signups', () => {
  it('redirects to /admin', async () => {
    const { default: AdminSignupsPage } = await import(
      '../../app/admin/signups/page'
    );
    expect(() => AdminSignupsPage()).toThrow(/NEXT_REDIRECT:\/admin$/);
  });
});
