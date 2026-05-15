import { describe, it, expect } from 'vitest';
import { formatValue } from '@/components/leaderboard/format';

describe('formatValue', () => {
  it('formats millions with two decimals and an M suffix', () => {
    expect(formatValue(2_500_000)).toBe('2.50M');
  });
  it('formats thousands rounded with a K suffix', () => {
    expect(formatValue(1500)).toBe('2K');
    expect(formatValue(48_200)).toBe('48K');
  });
  it('returns small numbers as-is', () => {
    expect(formatValue(0)).toBe('0');
    expect(formatValue(7)).toBe('7');
    expect(formatValue(999)).toBe('999');
  });
});
