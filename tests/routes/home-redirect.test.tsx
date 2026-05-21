import { describe, it, expect } from 'vitest';

describe('GET /', () => {
  it('homepage module exports a default component', async () => {
    // The homepage is now a real landing page, not a redirect.
    // Verify the module exports a default function without throwing.
    const mod = await import('../../app/page');
    expect(typeof mod.default).toBe('function');
  });
});
