import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// The station wears the Richardson Applied AI system. These hexes are the
// brand tokens from the canonical kit (BRAND-SPEC.md); if they change here
// they must change there first.
const css = readFileSync(resolve(__dirname, '../../app/globals.css'), 'utf8');

describe('RAI brand tokens in globals.css', () => {
  it('defines Ink Navy #0E1B2C as the ground', () => {
    expect(css).toMatch(/--rai-ink:\s*#0E1B2C/i);
    expect(css).toMatch(/--color-bg:\s*var\(--rai-ink\)/);
  });
  it('defines Navy Lift #16283F for raised surfaces', () => {
    expect(css).toMatch(/--rai-lift:\s*#16283F/i);
    expect(css).toMatch(/--color-bg-2:\s*var\(--rai-lift\)/);
  });
  it('defines Warm Paper #F6F5F1 as the ink', () => {
    expect(css).toMatch(/--rai-paper:\s*#F6F5F1/i);
    expect(css).toMatch(/--color-text:\s*var\(--rai-paper\)/);
  });
  it('defines Safety Amber #FFB020 as the single accent', () => {
    expect(css).toMatch(/--rai-amber:\s*#FFB020/i);
    expect(css).toMatch(/--color-accent:\s*var\(--rai-amber\)/);
  });
  it('defines Mist #9AA5B1 for secondary text on dark', () => {
    expect(css).toMatch(/--rai-mist:\s*#9AA5B1/i);
    expect(css).toMatch(/--color-dim:\s*var\(--rai-mist\)/);
  });
  it('keeps vendor chart anchors separate from brand tokens', () => {
    expect(css).toMatch(/--color-anthropic:\s*#d97757/);
    expect(css).toMatch(/--color-openai:\s*#4f8ff7/);
    expect(css).toMatch(/--color-xai:\s*#d6d4cf/);
  });
  it('uses IBM Plex Sans for body and IBM Plex Mono for numbers', () => {
    expect(css).toMatch(/--font-sans:[^;]*IBM Plex Sans/);
    expect(css).toMatch(/--font-mono:[^;]*IBM Plex Mono/);
    expect(css).toMatch(/font-family:\s*var\(--font-sans\)/);
  });
  it('carries no gradient, glow, or shadow treatments on the station surface', () => {
    const station = css.split('LEGACY COMPATIBILITY SHIM')[0]!;
    expect(station).not.toMatch(/linear-gradient|radial-gradient|text-shadow/);
  });
});
