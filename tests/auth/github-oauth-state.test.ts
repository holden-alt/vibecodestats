import { describe, expect, it } from 'vitest';
import { oauthReturnPath } from '@/lib/auth/github';

describe('oauthReturnPath', () => {
  it('recovers a safe local return path from verified OAuth state', () => {
    const encoded = btoa('/onboarding?step=profile')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    expect(oauthReturnPath(`nonce.${encoded}`))
      .toBe('/onboarding?step=profile');
  });

  it.each([
    null,
    'nonce',
    `nonce.${btoa('https://evil.example')}`,
    `nonce.${btoa('//evil.example')}`,
    'nonce.***',
  ])('falls back to /me for invalid state %s', (state) => {
    expect(oauthReturnPath(state)).toBe('/me');
  });
});
