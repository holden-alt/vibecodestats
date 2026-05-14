import { describe, it, expect } from 'vitest';
import { validateIngestPayload } from '@/lib/ingest/payload';

const valid = {
  github_handle: 'holden-alt',
  machine: 'iMac',
  date: '2026-05-14',
  tokens_total: 487231,
  tokens_by_model: { 'claude-opus-4-7': 480000, 'claude-sonnet-4-6': 7231 },
  sessions: 6,
  deep_work_minutes: 240,
  projects_touched: { 'holden-alt/cc-dashboard': 300000, 'realsavvy/agnt-portal': 187231 },
  ships: { commits: 12, repos: 3 },
};

describe('validateIngestPayload', () => {
  it('accepts a well-formed payload', () => {
    const result = validateIngestPayload(valid);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.github_handle).toBe('holden-alt');
  });

  it('rejects a missing github_handle', () => {
    const { github_handle, ...rest } = valid;
    const result = validateIngestPayload(rest);
    expect(result.ok).toBe(false);
  });

  it('rejects a malformed date', () => {
    const result = validateIngestPayload({ ...valid, date: '05/14/2026' });
    expect(result.ok).toBe(false);
  });

  it('rejects negative tokens_total', () => {
    const result = validateIngestPayload({ ...valid, tokens_total: -5 });
    expect(result.ok).toBe(false);
  });

  it('rejects a non-object body', () => {
    expect(validateIngestPayload(null).ok).toBe(false);
    expect(validateIngestPayload('hello').ok).toBe(false);
  });
});
