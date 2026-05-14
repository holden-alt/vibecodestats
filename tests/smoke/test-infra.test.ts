import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { resolve } from 'path';

describe('test infra', () => {
  it('vitest.config.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../../vitest.config.ts'))).toBe(true);
  });
  it('playwright.config.ts exists', () => {
    expect(existsSync(resolve(__dirname, '../../playwright.config.ts'))).toBe(true);
  });
  it('jest-dom is loaded (toBeInTheDocument is a matcher)', () => {
    const div = document.createElement('div');
    document.body.appendChild(div);
    expect(div).toBeInTheDocument();
    document.body.removeChild(div);
  });
});
