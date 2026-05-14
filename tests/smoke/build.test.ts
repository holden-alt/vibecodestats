import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe.skipIf(!process.env.RUN_BUILD_SMOKE)('production build', () => {
  it('builds without errors', () => {
    expect(() => execSync('pnpm build', { stdio: 'pipe', timeout: 180_000 })).not.toThrow();
  }, 180_000);
});
