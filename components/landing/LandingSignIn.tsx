'use client';

import { useState, useEffect } from 'react';

// Homepage-only foil-styled sign-in CTA. Mirrors SignInWithGithubButton's
// debounce (prevents the double-click PKCE-verifier overwrite bug) but wears
// the Neon Arcade foil look instead of the terminal-orange button. Kept
// separate from the shared SignInWithGithubButton so the layout/profile chrome
// stays the plain terminal style and only the landing hero goes full arcade.

type Props = {
  next?: string;
  children?: React.ReactNode;
};

export function LandingSignIn({ next = '/me', children }: Props) {
  const [clicked, setClicked] = useState(false);

  // Re-enable if the user comes back via the browser back button.
  useEffect(() => {
    const onPageShow = () => setClicked(false);
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, []);

  const href = `/auth/signin?next=${encodeURIComponent(next)}`;

  return (
    <a
      href={href}
      onClick={(e) => {
        if (clicked) {
          e.preventDefault();
          return;
        }
        setClicked(true);
        setTimeout(() => setClicked(false), 8000);
      }}
      aria-disabled={clicked}
      className="vcs-cta-primary"
      style={{
        opacity: clicked ? 0.7 : 1,
        pointerEvents: clicked ? 'none' : 'auto',
        cursor: clicked ? 'wait' : 'pointer',
      }}
    >
      {clicked ? 'Redirecting to GitHub…' : (children ?? 'Drop your GitHub handle')}
    </a>
  );
}
