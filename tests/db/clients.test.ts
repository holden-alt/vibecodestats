import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'http://test';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'test';
});

describe('supabase clients', () => {
  it('server.ts exports createClient', async () => {
    const mod = await import('../../lib/supabase/server');
    expect(typeof mod.createClient).toBe('function');
  });
  it('browser.ts exports createClient', async () => {
    const mod = await import('../../lib/supabase/browser');
    expect(typeof mod.createClient).toBe('function');
  });
  it('middleware.ts exports updateSession', async () => {
    const mod = await import('../../lib/supabase/middleware');
    expect(typeof mod.updateSession).toBe('function');
  });
});
