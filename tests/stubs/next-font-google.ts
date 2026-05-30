// Stub for `next/font/google` under vitest. The real module is a Next.js
// compiler transform that only runs during `next build` / `next dev`, so any
// font loader (Orbitron, Rajdhani, ...) is undefined in the test runtime and
// calling it throws. This stub returns the same { className, variable, style }
// shape Next produces. Wired via resolve.alias in vitest.config.ts. Used by
// app/page.tsx (the Neon Arcade landing), which imports Orbitron + Rajdhani.
function fontLoader() {
  return {
    className: 'mock-font',
    variable: 'mock-font-variable',
    style: { fontFamily: 'mock-font' },
  };
}

export const Orbitron = fontLoader;
export const Rajdhani = fontLoader;
