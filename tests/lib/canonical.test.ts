import { describe, it, expect } from 'vitest';
import { canonicalRedirectUrl } from '@/lib/canonical';

describe('canonicalRedirectUrl', () => {
  it('redirects the bare apex to www, preserving path + query', () => {
    expect(canonicalRedirectUrl('https://vibecodestats.dev/auth/callback?code=abc&next=/me'))
      .toBe('https://www.vibecodestats.dev/auth/callback?code=abc&next=/me');
  });

  it('returns null for the www host (already canonical, no redirect)', () => {
    expect(canonicalRedirectUrl('https://www.vibecodestats.dev/me')).toBeNull();
  });

  it('does not touch localhost (dev)', () => {
    expect(canonicalRedirectUrl('http://localhost:3000/auth/signin')).toBeNull();
  });

  it('does not touch preview/pages.dev or workers.dev hosts', () => {
    expect(canonicalRedirectUrl('https://cc-dashboard-qab.pages.dev/')).toBeNull();
    expect(canonicalRedirectUrl('https://cc-dashboard.holden-aa7.workers.dev/holden-alt')).toBeNull();
  });

  it('preserves path, query, and hash on the apex', () => {
    expect(canonicalRedirectUrl('https://vibecodestats.dev/holden-alt?tab=week#x'))
      .toBe('https://www.vibecodestats.dev/holden-alt?tab=week#x');
  });
});
