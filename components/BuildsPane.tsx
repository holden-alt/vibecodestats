type BuildsPaneProps = {
  projects: Record<string, number>;
};

function formatTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return Math.round(n / 1_000) + 'K';
  return String(n);
}

export function BuildsPane({ projects }: BuildsPaneProps) {
  const sorted = Object.entries(projects).sort((a, b) => b[1] - a[1]);

  return (
    <div
      className="rounded border p-2.5 min-h-[210px]"
      style={{ borderColor: 'var(--color-border)', borderTop: '2px solid var(--color-cyan)' }}
    >
      <h4 className="text-[0.6rem] uppercase tracking-[0.1em] font-semibold mb-2" style={{ color: 'var(--color-cyan)' }}>
        · builds
      </h4>
      {sorted.length === 0 ? (
        <div className="text-[0.6rem]" style={{ color: 'var(--color-dim)' }}>
          no builds yet today — start a session
        </div>
      ) : (
        sorted.map(([name, tokens]) => (
          <div key={name} data-testid="build-row" className="flex items-center gap-2 py-0.5">
            <span className="inline-block w-2 h-2 rounded-full" style={{ background: 'var(--color-orange)' }} />
            <span className="text-[0.7rem]">{name}</span>
            <span className="text-[0.6rem] ml-auto" style={{ color: 'var(--color-dim)' }}>
              {formatTokens(tokens)}
            </span>
          </div>
        ))
      )}
    </div>
  );
}
