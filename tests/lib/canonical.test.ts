import { describe, it, expect } from 'vitest';
import { canonicalRedirectUrl } from '@/lib/canonical';

describe('canonicalRedirectUrl', () => {
  it('redirects www to the apex host, preserving path + query', () => {
    expect(canonicalRedirectUrl('https://www.vibecodestats.dev/auth/callback?code=abc&next=/me'))
      .toBe('https://vibecodestats.dev/auth/callback?code=abc&next=/me');
  });

  it('returns null for the apex host (no redirect)', () => {
    expect(canonicalRedirectUrl('https://vibecodestats.dev/me')).toBeNull();
  });

  it('does not touch localhost (dev)', () => {
    expect(canonicalRedirectUrl('http://localhost:3000/auth/signin')).toBeNull();
  });

  it('does not touch preview/pages.dev hosts', () => {
    expect(canonicalRedirectUrl('https://cc-dashboard-qab.pages.dev/')).toBeNull();
  });

  it('preserves path, query, and hash on www', () => {
    expect(canonicalRedirectUrl('https://www.vibecodestats.dev/holden-alt?tab=week#x'))
      .toBe('https://vibecodestats.dev/holden-alt?tab=week#x');
  });
});
