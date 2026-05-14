import { describe, it, expect } from 'vitest';
import { signPayload, verifyPayload } from '@/lib/ingest/hmac';

const secret = 'test-secret-abc123';
const body = '{"github_handle":"holden-alt","date":"2026-05-14"}';

describe('hmac sign/verify', () => {
  it('a signature it produced verifies true', async () => {
    const sig = await signPayload(body, secret);
    expect(await verifyPayload(body, sig, secret)).toBe(true);
  });

  it('a tampered body fails verification', async () => {
    const sig = await signPayload(body, secret);
    expect(await verifyPayload(body + 'x', sig, secret)).toBe(false);
  });

  it('a wrong secret fails verification', async () => {
    const sig = await signPayload(body, secret);
    expect(await verifyPayload(body, sig, 'wrong-secret')).toBe(false);
  });

  it('a malformed signature fails verification, does not throw', async () => {
    expect(await verifyPayload(body, 'not-hex!!', secret)).toBe(false);
    expect(await verifyPayload(body, '', secret)).toBe(false);
  });

  it('signature is lowercase hex', async () => {
    const sig = await signPayload(body, secret);
    expect(sig).toMatch(/^[0-9a-f]{64}$/);
  });
});
