import { describe, expect, it } from 'vitest';
import { oauthReturnPath } from '@/lib/auth/github';

describe('oauthReturnPath', () => {
  it('recovers a safe local return path from verified OAuth state', () => {
    expect(oauthReturnPath(`nonce.${encodeURIComponent('/onboarding?step=profile')}`))
      .toBe('/onboarding?step=profile');
  });

  it.each([
    null,
    'nonce',
    'nonce.https%3A%2F%2Fevil.example',
    'nonce.%2F%2Fevil.example',
    'nonce.%E0%A4%A',
  ])('falls back to /me for invalid state %s', (state) => {
    expect(oauthReturnPath(state)).toBe('/me');
  });
});
