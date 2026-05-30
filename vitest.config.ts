import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: true,
    exclude: ['node_modules', 'e2e/**', '.next/**'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
      // next/font/google is a Next.js compiler transform with no runtime under
      // vitest. Alias it to a stub so importing app/page.tsx (the Neon Arcade
      // landing, which loads Orbitron/Rajdhani) doesn't throw in tests.
      'next/font/google': resolve(__dirname, 'tests/stubs/next-font-google.ts'),
    },
  },
});
