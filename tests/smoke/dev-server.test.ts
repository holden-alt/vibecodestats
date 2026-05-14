import { describe, it, expect } from 'vitest';

describe('dev server smoke', () => {
  it('package.json declares Next.js 15 and pnpm', async () => {
    const pkg = await import('../../package.json');
    expect(pkg.dependencies?.next).toMatch(/^15\./);
    expect(pkg.packageManager).toMatch(/^pnpm@/);
  });
});
