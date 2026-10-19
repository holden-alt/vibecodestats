'use client';

import { useEffect, useState, type ReactNode } from 'react';

type Tab = 'overview' | 'detail';
const TABS: { id: Tab; label: string; hint: string }[] = [
  { id: 'overview', label: 'Overview', hint: 'Claude vs. Codex, all time' },
  { id: 'detail', label: 'Detail', hint: 'records, hours, projects, ships, efficiency' },
];

/** Overview first; the deeper panels wait one click away under Detail. Both are
 *  server-rendered and stay mounted, so switching never refetches. #detail
 *  deep-links to the second tab. */
export function StationTabs({ overview, detail }: { overview: ReactNode; detail: ReactNode }) {
  const [tab, setTab] = useState<Tab>('overview');

  useEffect(() => {
    const sync = () => setTab(window.location.hash === '#detail' ? 'detail' : 'overview');
    sync();
    window.addEventListener('hashchange', sync);
    return () => window.removeEventListener('hashchange', sync);
  }, []);

  function choose(next: Tab) {
    setTab(next);
    const url = next === 'detail' ? '#detail' : window.location.pathname + window.location.search;
    window.history.replaceState(null, '', url);
  }

  return (
    <>
      <div
        role="tablist"
        aria-label="Station view"
        style={{ display: 'flex', gap: 22, borderBottom: '1px solid var(--color-border)', marginTop: 4 }}
      >
        {TABS.map((t) => {
          const active = t.id === tab;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={active}
              aria-controls={`panel-${t.id}`}
              title={t.hint}
              onClick={() => choose(t.id)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: `2px solid ${active ? 'var(--color-accent)' : 'transparent'}`,
                marginBottom: -1,
                padding: '8px 0 9px',
                cursor: 'pointer',
                fontFamily: 'var(--font-sans)',
                fontSize: '0.82rem',
                fontWeight: active ? 600 : 500,
                color: active ? 'var(--color-text)' : 'var(--color-dim)',
              }}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        role="tabpanel"
        id="panel-overview"
        aria-labelledby="tab-overview"
        hidden={tab !== 'overview'}
        style={{ display: tab === 'overview' ? 'flex' : undefined, flexDirection: 'column', gap: 14 }}
      >
        {overview}
      </div>
      <div
        role="tabpanel"
        id="panel-detail"
        aria-labelledby="tab-detail"
        hidden={tab !== 'detail'}
        style={{ display: tab === 'detail' ? 'flex' : undefined, flexDirection: 'column', gap: 14 }}
      >
        {detail}
      </div>
    </>
  );
}
