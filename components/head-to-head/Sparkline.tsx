type SparklineProps = {
  seriesA: number[];
  seriesB: number[];
  ariaLabel: string;
};

const VIEW_W = 100;
const VIEW_H = 30;

// Builds a "x,y x,y x,y" polyline points string.
function buildPoints(series: number[], max: number): string {
  if (series.length === 0) return '';
  const step = series.length > 1 ? VIEW_W / (series.length - 1) : 0;
  return series
    .map((v, i) => {
      const x = i * step;
      const y = max > 0 ? VIEW_H - (v / max) * VIEW_H : VIEW_H;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

export function Sparkline({ seriesA, seriesB, ariaLabel }: SparklineProps) {
  const n = Math.min(seriesA.length, seriesB.length);
  const a = seriesA.slice(0, n);
  const b = seriesB.slice(0, n);

  const sumA = a.reduce((s, v) => s + v, 0);
  const sumB = b.reduce((s, v) => s + v, 0);
  const allZero = sumA === 0 && sumB === 0;

  const max = Math.max(1, ...a, ...b);

  return (
    <svg
      role="img"
      aria-label={ariaLabel}
      viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
      preserveAspectRatio="none"
      className="w-full h-[30px]"
    >
      {allZero ? (
        <line
          data-baseline=""
          x1={0}
          y1={VIEW_H - 0.5}
          x2={VIEW_W}
          y2={VIEW_H - 0.5}
          stroke="var(--color-dim)"
          strokeWidth={0.5}
        />
      ) : (
        <>
          <polyline
            data-series="A"
            fill="none"
            stroke="var(--color-orange)"
            strokeWidth={1}
            points={buildPoints(a, max)}
          />
          <polyline
            data-series="B"
            fill="none"
            stroke="var(--color-cyan)"
            strokeWidth={1}
            points={buildPoints(b, max)}
          />
        </>
      )}
    </svg>
  );
}
