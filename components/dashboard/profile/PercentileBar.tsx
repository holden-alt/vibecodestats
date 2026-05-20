type Props = {
  percentile: number; // 0..1
  height?: number;
};

export function PercentileBar({ percentile, height = 14 }: Props) {
  const pct = Math.max(0, Math.min(1, percentile));
  // Position the marker: higher percentile = further right
  const markerLeft = `${pct * 100}%`;
  return (
    <div style={{ position: 'relative', height: height + 16, width: '100%' }}>
      <div
        style={{
          position: 'absolute', top: 8, left: 0, right: 0, height,
          background: 'linear-gradient(90deg, #2a1818 0%, #553030 25%, #3a3a1f 50%, #2f5a2f 75%, #d97757 100%)',
          borderRadius: 2,
          border: '1px solid var(--color-border)',
        }}
      />
      <div
        style={{
          position: 'absolute', top: 4, left: markerLeft, transform: 'translateX(-50%)',
          width: 2, height: height + 8,
          background: 'var(--color-text)',
          boxShadow: '0 0 0 1px var(--color-bg)',
        }}
      />
      <div
        style={{
          position: 'absolute', top: 0, left: markerLeft, transform: 'translateX(-50%)',
          fontSize: '0.55rem', color: 'var(--chart-1)', whiteSpace: 'nowrap',
        }}
      >
        ▼
      </div>
    </div>
  );
}
