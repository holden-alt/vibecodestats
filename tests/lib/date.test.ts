import { describe, it, expect } from 'vitest';
import { todayLocal } from '@/lib/date';

describe('todayLocal', () => {
  it('returns the local (ET) day, not the UTC day, for a late-evening instant', () => {
    // 2026-05-29T00:39Z is 2026-05-28 20:39 EDT — still the user's 05-28.
    // The UTC date (05-29) is what emptied "today" on the dashboard at 8pm ET.
    expect(todayLocal('America/New_York', new Date('2026-05-29T00:39:00Z'))).toBe('2026-05-28');
  });

  it('agrees with UTC during the daytime when ET and UTC dates coincide', () => {
    expect(todayLocal('America/New_York', new Date('2026-05-28T16:00:00Z'))).toBe('2026-05-28');
  });

  it('formats as YYYY-MM-DD', () => {
    expect(todayLocal('America/New_York', new Date('2026-01-02T15:00:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('defaults to America/New_York', () => {
    expect(todayLocal(undefined, new Date('2026-05-29T00:39:00Z'))).toBe('2026-05-28');
  });
});
