// Homepage-only interactive styling for the Neon Arcade landing CTAs + chips.
// Rendered as a plain <style> element (not a CSS Module / not globals.css) so
// it ships only with the landing route and never touches shared CSS. Class
// names are vcs-prefixed to stay self-scoped.
//
// Why a <style> element and not a CSS Module: importing a .module.css pulls the
// project's Tailwind PostCSS pipeline into the vitest transform and breaks the
// homepage route test. A literal <style> sidesteps that entirely.
//
// MOTION POLICY: the primary CTA carries a slow foil-flow (one accent surface,
// not page-wide flashing); everything else is hover-only. The
// prefers-reduced-motion block calms the foil to a placed gradient and removes
// hover transforms. GPU-only props (background-position / transform / box-shadow).

const CSS = `
.vcs-cta-primary {
  position: relative;
  display: inline-flex;
  align-items: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: #110018;
  border: none;
  padding: 17px 30px;
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  background-image: var(--foil-flow);
  background-size: 300% 100%;
  background-position: 0% 50%;
  box-shadow: 0 0 30px var(--neon-glow-foil), 0 10px 40px -8px var(--neon-glow-cyan);
  animation: neon-foil-flow 5s linear infinite;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
}
@media (hover: hover) {
  .vcs-cta-primary:hover {
    transform: translateY(-3px) scale(1.03);
    box-shadow: 0 0 50px rgba(255, 90, 200, 0.9), 0 16px 50px -8px rgba(60, 216, 255, 0.7);
  }
}
.vcs-cta-ghost {
  display: inline-flex;
  align-items: center;
  font-family: var(--font-display);
  font-weight: 700;
  font-size: 15px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--neon-txt);
  background: transparent;
  border: 1.5px solid rgba(60, 216, 255, 0.55);
  padding: 16px 26px;
  border-radius: 14px;
  cursor: pointer;
  text-decoration: none;
  box-shadow: inset 0 0 22px rgba(60, 216, 255, 0.12), 0 0 22px rgba(60, 216, 255, 0.18);
  transition: border-color 0.25s ease, color 0.25s ease, box-shadow 0.25s ease, transform 0.25s ease;
}
@media (hover: hover) {
  .vcs-cta-ghost:hover {
    border-color: var(--team-cx);
    color: #fff;
    box-shadow: inset 0 0 30px rgba(60, 216, 255, 0.28), 0 0 34px rgba(60, 216, 255, 0.4);
    transform: translateY(-3px);
  }
}
.vcs-chip {
  transition: color 0.25s ease, border-color 0.25s ease, box-shadow 0.25s ease, background 0.25s ease;
}
@media (hover: hover) {
  .vcs-chip:hover {
    color: #fff;
    border-color: rgba(60, 216, 255, 0.6);
    background: rgba(60, 216, 255, 0.08);
    box-shadow: 0 0 18px rgba(60, 216, 255, 0.3);
  }
}
@media (prefers-reduced-motion: reduce) {
  .vcs-cta-primary {
    animation: none !important;
    background-image: var(--foil-gradient);
    background-position: center !important;
  }
  .vcs-cta-primary,
  .vcs-cta-ghost,
  .vcs-chip { transition: none !important; }
}
`;

export function LandingStyles() {
  return <style dangerouslySetInnerHTML={{ __html: CSS }} />;
}
