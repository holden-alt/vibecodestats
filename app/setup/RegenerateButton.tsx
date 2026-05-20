'use client';

import { useState } from 'react';

export function RegenerateButton() {
  const [busy, setBusy] = useState(false);

  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (
          !confirm(
            'Regenerate your ingest token? Your current install will stop working until you re-run the installer with the new token.',
          )
        )
          return;
        setBusy(true);
        const res = await fetch('/api/me/regenerate-token', { method: 'POST' });
        if (res.ok) {
          window.location.reload();
        } else {
          alert('regenerate failed: ' + (await res.text()));
          setBusy(false);
        }
      }}
      style={{
        marginTop: 8,
        background: 'transparent',
        border: '1px dashed var(--color-red, #d97373)',
        color: 'var(--color-red, #d97373)',
        padding: '4px 10px',
        borderRadius: 2,
        cursor: busy ? 'default' : 'pointer',
        fontFamily: 'inherit',
        fontSize: '0.7rem',
        opacity: busy ? 0.6 : 1,
      }}
    >
      {busy ? 'regenerating…' : 'regenerate token'}
    </button>
  );
}
