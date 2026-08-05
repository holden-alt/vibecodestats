import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('palette CSS variables', () => {
  const css = readFileSync(resolve(__dirname, '../../app/globals.css'), 'utf8');
  it('defines --color-orange #d97757', () => { expect(css).toMatch(/--color-orange:\s*#d97757/); });
  // cyan + green re-stepped 2026-08-04: old pair was dE 10.4 apart (validator fail)
  it('defines --color-cyan #45c6ee', () => { expect(css).toMatch(/--color-cyan:\s*#45c6ee/); });
  it('defines --color-magenta #c47cb8', () => { expect(css).toMatch(/--color-magenta:\s*#c47cb8/); });
  it('defines --color-yellow #e3c466', () => { expect(css).toMatch(/--color-yellow:\s*#e3c466/); });
  it('defines --color-green #84d95a', () => { expect(css).toMatch(/--color-green:\s*#84d95a/); });
  it('defines --color-blue #7a9cd9', () => { expect(css).toMatch(/--color-blue:\s*#7a9cd9/); });
  it('defines --color-red #d97373', () => { expect(css).toMatch(/--color-red:\s*#d97373/); });
  it('sets body to bg #0d0d0d, text #ece6dc, monospace', () => {
    expect(css).toMatch(/--color-bg:\s*#0d0d0d/);
    expect(css).toMatch(/--color-text:\s*#ece6dc/);
    expect(css).toMatch(/ui-monospace/);
  });
});
