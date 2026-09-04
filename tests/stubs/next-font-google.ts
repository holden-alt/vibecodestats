// Stub for `next/font/google` under vitest. The real module is a Next.js
// compiler transform that only runs during `next build` / `next dev`, so any
// font loader (Chakra_Petch, Sora, ...) is undefined in the test runtime and
// calling it throws. This stub returns the same { className, variable, style }
// shape Next produces. Wired via resolve.alias in vitest.config.ts. Used by
// app/page.tsx + app/[handle]/page.tsx (the Neon Arcade v2 surfaces), which
// import Chakra_Petch + Sora + JetBrains_Mono.
function fontLoader() {
  return {
    className: 'mock-font',
    variable: 'mock-font-variable',
    style: { fontFamily: 'mock-font' },
  };
}

// RAI brand type (app/layout.tsx).
export const IBM_Plex_Sans = fontLoader;
export const IBM_Plex_Mono = fontLoader;

// v2 type (demoted profile surface).
export const Chakra_Petch = fontLoader;
export const Sora = fontLoader;
export const JetBrains_Mono = fontLoader;

// Legacy loaders kept so any lingering importer still resolves.
export const Orbitron = fontLoader;
export const Rajdhani = fontLoader;
