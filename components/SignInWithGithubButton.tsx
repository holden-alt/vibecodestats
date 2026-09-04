'use client';

import { useState, useEffect } from 'react';

// Debounced sign-in button. Prevents the multi-click PKCE bug: tapping the
// button twice in a row generates two PKCE verifiers and overwrites the
// cookie, so when GitHub redirects back the verifier no longer matches the
// auth code → "code challenge does not match" exchange failure.
//
// First click: navigates and disables the button for 8s (or until the page
// unloads, whichever comes first).

type Props = {
  next?: string;
  className?: string;
  children?: React.ReactNode;
};

export function SignInWithGithubButton({ next = '/me', className, children }: Props) {
  const [clicked, setClicked] = useState(false);

  // Re-enable if the user comes back via browser back button (pageshow fires)
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
        // Failsafe: re-enable after 8s in case navigation didn't happen
        setTimeout(() => setClicked(false), 8000);
      }}
      aria-disabled={clicked}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        background: 'transparent',
        color: 'var(--color-text)',
        border: '1px solid var(--color-text)',
        padding: '7px 14px',
        borderRadius: 3,
        fontFamily: 'var(--font-mono)',
        fontSize: '0.78rem',
        fontWeight: 500,
        letterSpacing: '0.02em',
        textDecoration: 'none',
        opacity: clicked ? 0.6 : 1,
        pointerEvents: clicked ? 'none' : 'auto',
        cursor: clicked ? 'wait' : 'pointer',
        transition: 'opacity 150ms',
      }}
      className={className}
    >
      {clicked ? 'redirecting to github…' : (children ?? 'sign in with github →')}
    </a>
  );
}
