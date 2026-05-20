import { describe, it, expect, vi } from 'vitest';

const redirectMock = vi.fn(() => { throw new Error('NEXT_REDIRECT'); });
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

describe('GET /', () => {
  it('redirects to /holden-alt', async () => {
    const { default: Page } = await import('../../app/page');
    expect(() => Page()).toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith('/holden-alt');
  });
});
