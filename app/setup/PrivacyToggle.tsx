'use client';
import { useState } from 'react';

export function PrivacyToggle({ initial }: { initial: boolean }) {
  const [enabled, setEnabled] = useState(initial);
  const [busy, setBusy] = useState(false);
  const flip = async () => {
    setBusy(true);
    const res = await fetch('/api/me/privacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ private_project_names: !enabled }),
    });
    setBusy(false);
    if (res.ok) setEnabled(!enabled);
    else alert('toggle failed: ' + (await res.text()));
  };
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: '0.85rem' }}>
      <input type="checkbox" checked={enabled} onChange={flip} disabled={busy} />
      <span>hide my real project names on public profile <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>(replaces with &quot;project 1&quot;, &quot;project 2&quot;, etc when others view your profile)</span></span>
    </label>
  );
}
