type BuildStatus = 'active' | 'shipped' | 'live' | 'paused' | 'work';

type Build = {
  name: string;
  status: BuildStatus;
  hint: string;
};

const PLACEHOLDER_BUILDS: Build[] = [
  { name: 'cc-dashboard', status: 'active', hint: 'new' },
  { name: 'holdengr.com', status: 'live', hint: 'live' },
  { name: 'watch-whisperer', status: 'shipped', hint: 'shipped 1w' },
];

const DOT_COLOR: Record<BuildStatus, string> = {
  active: 'var(--color-orange)',
  shipped: 'var(--color-green)',
  live: 'var(--color-green)',
  paused: '#333',
  work: 'var(--color-yellow)',
};

export function BuildsPane() {
  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-cyan)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-cyan)' }}>
        · builds
      </h4>
      {PLACEHOLDER_BUILDS.map((b) => (
        <div key={b.name} data-testid="build-row" className="flex items-center gap-2 py-0.5">
          <span className="inline-block w-2 h-2 rounded-full" style={{ background: DOT_COLOR[b.status] }} />
          <span className="text-[0.7rem]">{b.name}</span>
          <span className="text-[0.6rem] ml-auto" style={{ color: 'var(--color-dim)' }}>
            {b.hint}
          </span>
        </div>
      ))}
    </div>
  );
}
