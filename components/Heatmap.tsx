type Day = { date: string; tokens: number };

type HeatmapProps = {
  days: Day[];
  today: Date;
};

const COLS = 52;
const ROWS = 7;
const MS_PER_DAY = 86_400_000;

const LEVEL_COLORS = [
  'var(--color-heat-0)',
  'var(--color-heat-1)',
  'var(--color-heat-2)',
  'var(--color-heat-3)',
  'var(--color-heat-4)',
];

function levelFor(tokens: number): 0 | 1 | 2 | 3 | 4 {
  if (tokens >= 300_000) return 4;
  if (tokens >= 100_000) return 3;
  if (tokens >= 10_000) return 2;
  if (tokens >= 1_000) return 1;
  return 0;
}

function toUtcIso(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function Heatmap({ days, today }: HeatmapProps) {
  const byDate = new Map(days.map((d) => [d.date, d.tokens]));
  const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());

  const cells: { date: string; level: 0 | 1 | 2 | 3 | 4 }[] = [];
  for (let i = 0; i < COLS * ROWS; i++) {
    const offset = COLS * ROWS - 1 - i;
    const ms = todayUtc - offset * MS_PER_DAY;
    const iso = toUtcIso(new Date(ms));
    cells.push({ date: iso, level: levelFor(byDate.get(iso) ?? 0) });
  }

  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
      role="img"
      aria-label="52-week activity heatmap"
    >
      {cells.map((c) => (
        <div
          key={c.date}
          data-cell
          data-date={c.date}
          data-level={c.level}
          title={`${c.date} · level ${c.level}`}
          className="h-[9px] rounded-[1px]"
          style={{ background: LEVEL_COLORS[c.level] }}
        />
      ))}
    </div>
  );
}
