import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('app/layout.tsx', () => {
  const src = readFileSync(resolve(__dirname, '../../app/layout.tsx'), 'utf8');
  it('declares <html lang="en">', () => {
    expect(src).toMatch(/<html lang="en">/);
  });
  it('does not import a sans-serif Google font', () => {
    expect(src).not.toMatch(/next\/font\/google/);
  });
  it('renders {children}', () => {
    expect(src).toMatch(/\{children\}/);
  });
});
