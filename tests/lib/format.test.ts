import { describe, it, expect } from 'vitest';
import { formatNumber, formatCompact, formatDelta, formatDuration } from '@/lib/format';

describe('formatNumber', () => {
  it('groups thousands with commas', () => {
    expect(formatNumber(2418302)).toBe('2,418,302');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });
});

describe('formatCompact', () => {
  it('returns K/M/B suffixes', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(2418)).toBe('2.4K');
    expect(formatCompact(2418302)).toBe('2.4M');
    expect(formatCompact(1_500_000_000)).toBe('1.5B');
  });
});

describe('formatDelta', () => {
  it('signs deltas and converts to percent', () => {
    expect(formatDelta(0.38)).toBe('+38%');
    expect(formatDelta(-0.12)).toBe('-12%');
    expect(formatDelta(0)).toBe('+0%');
  });
});

describe('formatDuration', () => {
  it('renders minutes as Hh Mm', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h 0m');
    expect(formatDuration(372)).toBe('6h 12m');
  });
});
