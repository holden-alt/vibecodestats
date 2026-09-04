import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('app/layout.tsx', () => {
  const src = readFileSync(resolve(__dirname, '../../app/layout.tsx'), 'utf8');
  it('declares <html lang="en">', () => {
    expect(src).toMatch(/<html lang="en"/);
  });
  it('loads the RAI brand type (IBM Plex Sans + Mono) via next/font', () => {
    expect(src).toMatch(/IBM_Plex_Sans/);
    expect(src).toMatch(/IBM_Plex_Mono/);
    expect(src).toMatch(/--font-plex-sans/);
    expect(src).toMatch(/--font-plex-mono/);
  });
  it('points the site Open Graph card at the brand export', () => {
    expect(src).toMatch(/\/brand\/og-image\.png/);
  });
  it('renders {children}', () => {
    expect(src).toMatch(/\{children\}/);
  });
});
