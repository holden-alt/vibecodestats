# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every hand-rolled SVG chart with a production chart-library stack (Recharts via shadcn Chart + Tremor BarList + @uiw/react-heat-map) and recompose the profile page into a dense-but-rhythmic bento layout with a live cockpit hero, cinematic motion, and proper hover-tooltip interactivity.

**Architecture:** New components live in `components/dashboard/` (primitives + composition) and `components/charts/v2/` (the new charts) so they coexist with the existing hand-rolled charts until the final cleanup task. The new shadcn Chart wrapper reads Tailwind CSS variables (`--chart-1..5`) mapped to the existing terminal palette. ProfileLive gets recomposed to consume the new components without touching the realtime subscription or data-fetch layer.

**Tech Stack:** Next.js 15 App Router (edge runtime), Tailwind 4, Recharts, shadcn `chart` registry component, Tremor's `<BarList>`, `@uiw/react-heat-map`, Supabase realtime (existing), Vitest + RTL for unit tests, Playwright for e2e (existing infra).

**Spec:** `docs/superpowers/specs/2026-05-19-dashboard-redesign-design.md`

---

## Phase 1 — Foundation

### Task 1: Install dependencies

**Files:**
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

- [ ] **Step 1: Install runtime deps**

Run from repo root:
```bash
pnpm add recharts @uiw/react-heat-map @tremor/react
```

Expected: `package.json` `dependencies` gains `recharts`, `@uiw/react-heat-map`, `@tremor/react`. Lockfile updates.

- [ ] **Step 2: Verify build still passes**

Run: `pnpm run build`
Expected: build completes successfully (no type errors, no missing peer deps).

- [ ] **Step 3: Commit**

```bash
git add package.json pnpm-lock.yaml
git commit -m "build(deps): add recharts, @uiw/react-heat-map, @tremor/react for dashboard redesign"
```

---

### Task 2: Add chart color tokens to globals.css

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Add chart-1..5 CSS variables inside `:root`**

Open `app/globals.css`. Find the existing `:root` block that defines `--color-orange`, `--color-cyan`, etc. Inside the SAME `:root` block, append after the existing color definitions:

```css
/* shadcn chart tokens — map to existing terminal palette */
--chart-1: #d97757; /* orange — tokens, hero */
--chart-2: #6bbfd9; /* cyan — machines, sonnet */
--chart-3: #8fbc8f; /* green — sessions, haiku, positive deltas */
--chart-4: #c47cb8; /* magenta — persona, "now" indicators */
--chart-5: #e3c466; /* yellow — rank, ships */
```

- [ ] **Step 2: Verify it's referenced correctly by sampling in DevTools**

Run: `pnpm dev` in a separate terminal. Open http://localhost:3000/holden-alt. Open DevTools → Elements → :root → Computed. Confirm `--chart-1` resolves to `#d97757`.

Stop the dev server (Ctrl+C).

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(theme): add --chart-1..5 CSS vars mapping terminal palette to shadcn slots"
```

---

## Phase 2 — Primitives

### Task 3: Number formatting utilities + tests

**Files:**
- Create: `lib/format.ts`
- Test: `tests/lib/format.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/lib/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { formatNumber, formatCompact, formatDelta, formatDuration } from '@/lib/format';

describe('formatNumber', () => {
  it('groups thousands with commas', () => {
    expect(formatNumber(2418302)).toBe('2,418,302');
    expect(formatNumber(0)).toBe('0');
    expect(formatNumber(999)).toBe('999');
  });
});

describe('formatCompact', () => {
  it('returns K/M/B suffixes', () => {
    expect(formatCompact(950)).toBe('950');
    expect(formatCompact(2418)).toBe('2.4K');
    expect(formatCompact(2418302)).toBe('2.4M');
    expect(formatCompact(1_500_000_000)).toBe('1.5B');
  });
});

describe('formatDelta', () => {
  it('signs deltas and converts to percent', () => {
    expect(formatDelta(0.38)).toBe('+38%');
    expect(formatDelta(-0.12)).toBe('-12%');
    expect(formatDelta(0)).toBe('+0%');
  });
});

describe('formatDuration', () => {
  it('renders minutes as Hh Mm', () => {
    expect(formatDuration(0)).toBe('0m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(60)).toBe('1h 0m');
    expect(formatDuration(372)).toBe('6h 12m');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/lib/format.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `lib/format.ts`**

Create `lib/format.ts`:

```typescript
export function formatNumber(n: number): string {
  return n.toLocaleString('en-US');
}

export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export function formatDelta(ratio: number): string {
  const pct = Math.round(ratio * 100);
  const sign = pct >= 0 ? '+' : '-';
  return `${sign}${Math.abs(pct)}%`;
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m}m`;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/lib/format.test.ts`
Expected: PASS — all four describes green.

- [ ] **Step 5: Commit**

```bash
git add lib/format.ts tests/lib/format.test.ts
git commit -m "feat(lib): add format utilities (formatNumber, formatCompact, formatDelta, formatDuration)"
```

---

### Task 4: RollingNumber component + tests

**Files:**
- Create: `components/dashboard/RollingNumber.tsx`
- Test: `tests/components/dashboard/RollingNumber.test.tsx`

Component renders a target number with a CSS-driven roll animation from a previous value. On first mount it animates from 0 → target. On prop change it animates from previous → new target. Honors `prefers-reduced-motion`.

- [ ] **Step 1: Write the failing test**

Create `tests/components/dashboard/RollingNumber.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RollingNumber } from '@/components/dashboard/RollingNumber';

describe('RollingNumber', () => {
  it('renders the formatted final value', () => {
    render(<RollingNumber value={2418302} />);
    expect(screen.getByText('2,418,302')).toBeInTheDocument();
  });

  it('renders compact format when prop is set', () => {
    render(<RollingNumber value={2418302} compact />);
    expect(screen.getByText('2.4M')).toBeInTheDocument();
  });

  it('exposes the raw value via data-value for tests/screen readers', () => {
    const { container } = render(<RollingNumber value={487231} />);
    expect(container.querySelector('[data-value="487231"]')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/dashboard/RollingNumber.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/dashboard/RollingNumber.tsx`**

Create the file:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { formatNumber, formatCompact } from '@/lib/format';

type Props = {
  value: number;
  compact?: boolean;
  /** ms — total animation duration. Default 600ms. */
  durationMs?: number;
  className?: string;
};

export function RollingNumber({ value, compact, durationMs = 600, className }: Props) {
  const [display, setDisplay] = useState(value);
  const rafRef = useRef<number | null>(null);
  const fromRef = useRef(value);

  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || value === fromRef.current) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const start = performance.now();
    const from = fromRef.current;
    const delta = value - from;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(Math.round(from + delta * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = value;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, [value, durationMs]);

  const text = compact ? formatCompact(display) : formatNumber(display);
  return (
    <span className={className} data-value={value} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {text}
    </span>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm vitest run tests/components/dashboard/RollingNumber.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/dashboard/RollingNumber.tsx tests/components/dashboard/RollingNumber.test.tsx
git commit -m "feat(dashboard): RollingNumber component with reduced-motion respect"
```

---

### Task 5: BentoTile component + tests

**Files:**
- Create: `components/dashboard/BentoTile.tsx`
- Test: `tests/components/dashboard/BentoTile.test.tsx`

Generic wrapper providing the standard tile shell: optional `label` (uppercase mini), main content area, optional `sub` line, hover state, optional click handler (turns into an `<a>` if `href` is set).

- [ ] **Step 1: Write the failing test**

Create `tests/components/dashboard/BentoTile.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BentoTile } from '@/components/dashboard/BentoTile';

describe('BentoTile', () => {
  it('renders label, children, and sub', () => {
    render(
      <BentoTile label="tokens today" sub="across 4 projects">
        <span>2,418,302</span>
      </BentoTile>,
    );
    expect(screen.getByText('tokens today')).toBeInTheDocument();
    expect(screen.getByText('2,418,302')).toBeInTheDocument();
    expect(screen.getByText('across 4 projects')).toBeInTheDocument();
  });

  it('renders as an anchor when href is provided', () => {
    render(
      <BentoTile label="rank" href="/leaderboard">
        <span>#3</span>
      </BentoTile>,
    );
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/leaderboard');
  });

  it('applies column/row span via inline grid styles', () => {
    const { container } = render(
      <BentoTile label="trends" colSpan={4} rowSpan={2}>
        <span>chart</span>
      </BentoTile>,
    );
    const el = container.firstChild as HTMLElement;
    expect(el.style.gridColumn).toBe('span 4');
    expect(el.style.gridRow).toBe('span 2');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm vitest run tests/components/dashboard/BentoTile.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `components/dashboard/BentoTile.tsx`**

```tsx
import Link from 'next/link';
import type { CSSProperties, ReactNode } from 'react';

type Props = {
  label?: string;
  sub?: string;
  href?: string;
  colSpan?: number;
  rowSpan?: number;
  className?: string;
  children: ReactNode;
};

export function BentoTile({ label, sub, href, colSpan, rowSpan, className, children }: Props) {
  const style: CSSProperties = {
    background: 'var(--color-bg-2, #14110e)',
    border: '1px solid var(--color-border, #2a2622)',
    borderRadius: 3,
    padding: '10px 12px',
    transition: 'border-color 200ms ease-out, box-shadow 200ms ease-out',
    gridColumn: colSpan ? `span ${colSpan}` : undefined,
    gridRow: rowSpan ? `span ${rowSpan}` : undefined,
    color: 'inherit',
    textDecoration: 'none',
    display: 'block',
  };

  const content = (
    <>
      {label && (
        <div
          style={{
            fontSize: '0.55rem',
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            marginBottom: 4,
          }}
        >
          {label}
        </div>
      )}
      <div>{children}</div>
      {sub && (
        <div style={{ fontSize: '0.6rem', opacity: 0.6, marginTop: 4 }}>{sub}</div>
      )}
    </>
  );

  if (href) {
    return (
      <Link href={href} prefetch={false} style={style} className={`bento-tile ${className ?? ''}`}>
        {content}
      </Link>
    );
  }
  return (
    <div style={style} className={`bento-tile ${className ?? ''}`}>
      {content}
    </div>
  );
}
```

- [ ] **Step 4: Add hover styles to globals.css**

Open `app/globals.css`. At the end of the file, append:

```css
.bento-tile { cursor: default; }
a.bento-tile:hover {
  border-color: var(--color-orange, #d97757) !important;
  box-shadow: inset 0 0 0 1px rgba(217, 119, 87, 0.15);
  cursor: pointer;
}
@media (prefers-reduced-motion: reduce) {
  .bento-tile { transition: none !important; }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `pnpm vitest run tests/components/dashboard/BentoTile.test.tsx`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/dashboard/BentoTile.tsx tests/components/dashboard/BentoTile.test.tsx app/globals.css
git commit -m "feat(dashboard): BentoTile shell with label/sub/href + hover ripple"
```

---

### Task 6: Vendor the shadcn Chart wrapper

shadcn ships chart components as copy-paste source. We vendor it directly.

**Files:**
- Create: `components/ui/chart.tsx`

- [ ] **Step 1: Vendor the shadcn chart component**

Create `components/ui/chart.tsx` with the canonical shadcn chart implementation. The full source (verbatim from `ui.shadcn.com/docs/components/chart` as of 2026-05-19, MIT-licensed):

```tsx
'use client';

import * as React from 'react';
import * as RechartsPrimitive from 'recharts';

const THEMES = { light: '', dark: '.dark' } as const;

export type ChartConfig = {
  [k in string]: {
    label?: React.ReactNode;
    icon?: React.ComponentType;
  } & ({ color?: string; theme?: never } | { color?: never; theme: Record<keyof typeof THEMES, string> });
};

type ChartContextProps = { config: ChartConfig };
const ChartContext = React.createContext<ChartContextProps | null>(null);

function useChart() {
  const ctx = React.useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used within <ChartContainer />');
  return ctx;
}

export function ChartContainer({
  id,
  className,
  children,
  config,
  ...props
}: React.ComponentProps<'div'> & {
  config: ChartConfig;
  children: React.ComponentProps<typeof RechartsPrimitive.ResponsiveContainer>['children'];
}) {
  const uniqueId = React.useId();
  const chartId = `chart-${id ?? uniqueId.replace(/:/g, '')}`;
  return (
    <ChartContext.Provider value={{ config }}>
      <div
        data-slot="chart"
        data-chart={chartId}
        className={className}
        style={{ width: '100%', height: '100%' }}
        {...props}
      >
        <ChartStyle id={chartId} config={config} />
        <RechartsPrimitive.ResponsiveContainer>{children}</RechartsPrimitive.ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

function ChartStyle({ id, config }: { id: string; config: ChartConfig }) {
  const colorConfig = Object.entries(config).filter(
    ([, cfg]) => 'color' in cfg || 'theme' in cfg,
  );
  if (!colorConfig.length) return null;
  return (
    <style
      dangerouslySetInnerHTML={{
        __html: Object.entries(THEMES)
          .map(([theme, prefix]) => `
${prefix} [data-chart=${id}] {
${colorConfig.map(([key, cfg]) => {
  const color = ('theme' in cfg && cfg.theme?.[theme as keyof typeof THEMES]) || ('color' in cfg ? cfg.color : undefined);
  return color ? `  --color-${key}: ${color};` : null;
}).filter(Boolean).join('\n')}
}`)
          .join('\n'),
      }}
    />
  );
}

export const ChartTooltip = RechartsPrimitive.Tooltip;

export function ChartTooltipContent({
  active,
  payload,
  label,
  hideLabel = false,
  hideIndicator = false,
  indicator = 'dot',
  className,
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> & {
  hideLabel?: boolean;
  hideIndicator?: boolean;
  indicator?: 'line' | 'dot' | 'dashed';
  className?: string;
}) {
  const { config } = useChart();
  if (!active || !payload?.length) return null;
  return (
    <div
      className={className}
      style={{
        background: 'var(--color-bg, #0d0d0d)',
        border: '1px solid var(--color-border, #2a2622)',
        padding: '6px 8px',
        borderRadius: 3,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        fontSize: '0.65rem',
        color: 'var(--color-text, #ece6dc)',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {!hideLabel && label != null && (
        <div style={{ opacity: 0.7, marginBottom: 4 }}>{String(label)}</div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {payload.map((item, i) => {
          const key = (item.dataKey as string) || (item.name as string) || 'value';
          const cfg = config[key];
          const color = (item.payload && item.payload.fill) || item.color || 'var(--chart-1)';
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {!hideIndicator && (
                <span
                  style={{
                    width: 8,
                    height: 8,
                    background: color,
                    borderRadius: indicator === 'dot' ? '50%' : 1,
                  }}
                />
              )}
              <span style={{ opacity: 0.7 }}>{cfg?.label ?? key}</span>
              <span style={{ marginLeft: 'auto', fontWeight: 600 }}>
                {Number(item.value).toLocaleString('en-US')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ChartLegend = RechartsPrimitive.Legend;
```

- [ ] **Step 2: Verify the file type-checks**

Run: `pnpm exec tsc --noEmit`
Expected: no errors related to `components/ui/chart.tsx`.

- [ ] **Step 3: Commit**

```bash
git add components/ui/chart.tsx
git commit -m "feat(ui): vendor shadcn chart wrapper (Recharts + terminal-themed tooltip)"
```

---

## Phase 3 — New Chart Components

Each chart is built in `components/charts/v2/` alongside the old one. The old charts stay live until Task 17 swaps them in via ProfileLive.

### Task 7: TokenTrendChart v2 (30-day area chart)

**Files:**
- Create: `components/charts/v2/TokenTrendChart.tsx`

- [ ] **Step 1: Implement `components/charts/v2/TokenTrendChart.tsx`**

```tsx
'use client';

import { useMemo, useState } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatCompact } from '@/lib/format';
import type { DailyStat } from '@/lib/stats/profile-data';

const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-1)' },
};

type Props = { stats: DailyStat[] };

type Range = '7d' | '30d' | '90d' | 'all';
const RANGES: Range[] = ['7d', '30d', '90d', 'all'];
const RANGE_DAYS: Record<Range, number> = { '7d': 7, '30d': 30, '90d': 90, 'all': 366 };

export function TokenTrendChart({ stats }: Props) {
  const [range, setRange] = useState<Range>('30d');
  const data = useMemo(() => {
    const days = RANGE_DAYS[range];
    return [...stats]
      .sort((a, b) => (a.date < b.date ? -1 : 1))
      .slice(-days)
      .map((s) => ({ date: s.date, tokens: s.tokens_total }));
  }, [stats, range]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          tokens trend
        </div>
        <div style={{ display: 'flex', gap: 4, fontSize: '0.55rem' }}>
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              style={{
                background: 'transparent',
                border: `1px solid ${r === range ? 'var(--chart-1)' : 'var(--color-border)'}`,
                color: r === range ? 'var(--chart-1)' : 'inherit',
                padding: '1px 6px',
                borderRadius: 2,
                cursor: 'pointer',
                fontFamily: 'inherit',
                fontSize: 'inherit',
              }}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      <ChartContainer config={config} style={{ height: 120 }}>
        <AreaChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
          <defs>
            <linearGradient id="ttc-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.4} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="var(--color-border)" strokeDasharray="2 2" vertical={false} />
          <XAxis
            dataKey="date"
            tickLine={false}
            axisLine={false}
            tickMargin={6}
            tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
            tickFormatter={(d) => d.slice(5)}
            minTickGap={24}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-dim)' }}
            tickFormatter={(v) => formatCompact(v)}
            width={36}
          />
          <ChartTooltip cursor={{ stroke: 'var(--chart-1)', strokeOpacity: 0.4 }} content={<ChartTooltipContent />} />
          <Area
            type="monotone"
            dataKey="tokens"
            stroke="var(--chart-1)"
            fill="url(#ttc-fill)"
            strokeWidth={1.5}
            isAnimationActive
            animationDuration={1200}
          />
        </AreaChart>
      </ChartContainer>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/TokenTrendChart.tsx
git commit -m "feat(charts): v2 TokenTrendChart (shadcn area chart, range pills, terminal tooltip)"
```

---

### Task 8: ModelMix donut v2

**Files:**
- Create: `components/charts/v2/ModelMix.tsx`

- [ ] **Step 1: Implement `components/charts/v2/ModelMix.tsx`**

```tsx
'use client';

import { Pie, PieChart, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompact } from '@/lib/format';

const MODEL_COLOR: Record<string, string> = {
  opus: 'var(--chart-1)',
  sonnet: 'var(--chart-2)',
  haiku: 'var(--chart-3)',
  other: 'var(--color-dim)',
};
const MODEL_LABEL: Record<string, string> = {
  opus: 'opus',
  sonnet: 'sonnet',
  haiku: 'haiku',
  other: 'other',
};

function classify(modelKey: string): 'opus' | 'sonnet' | 'haiku' | 'other' {
  const k = modelKey.toLowerCase();
  if (k.includes('opus')) return 'opus';
  if (k.includes('sonnet')) return 'sonnet';
  if (k.includes('haiku')) return 'haiku';
  return 'other';
}

type Props = { tokensByModel: Record<string, number> };

export function ModelMix({ tokensByModel }: Props) {
  const buckets: Record<'opus' | 'sonnet' | 'haiku' | 'other', number> = {
    opus: 0, sonnet: 0, haiku: 0, other: 0,
  };
  for (const [k, v] of Object.entries(tokensByModel)) {
    buckets[classify(k)] += v;
  }
  const total = buckets.opus + buckets.sonnet + buckets.haiku + buckets.other;
  if (total === 0) {
    return <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>no model data yet</div>;
  }
  const data = (['opus', 'sonnet', 'haiku', 'other'] as const)
    .filter((k) => buckets[k] > 0)
    .map((k) => ({ name: MODEL_LABEL[k], value: buckets[k], color: MODEL_COLOR[k] }));

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 56, height: 56 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="value" innerRadius={16} outerRadius={26} stroke="none" isAnimationActive animationDuration={1200}>
              {data.map((d, i) => (<Cell key={i} fill={d.color} />))}
            </Pie>
            <Tooltip
              contentStyle={{ background: 'var(--color-bg)', border: '1px solid var(--color-border)', borderRadius: 3, fontFamily: 'ui-monospace, monospace', fontSize: '0.65rem' }}
              formatter={(v: number, name) => [`${formatCompact(v)} (${Math.round((v / total) * 100)}%)`, name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: '0.6rem' }}>
        {data.map((d) => (
          <div key={d.name} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: d.color, display: 'inline-block' }} />
            <span style={{ opacity: 0.85 }}>{d.name}</span>
            <span style={{ opacity: 0.55, marginLeft: 'auto' }}>{Math.round((d.value / total) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/ModelMix.tsx
git commit -m "feat(charts): v2 ModelMix donut (Recharts PieChart + bucketed legend)"
```

---

### Task 9: TimeOfDayHistogram v2

**Files:**
- Create: `components/charts/v2/TimeOfDayHistogram.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { formatCompact } from '@/lib/format';

const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-4)' },
};

type Props = { hourlyTokens: Record<string, number> };

export function TimeOfDayHistogram({ hourlyTokens }: Props) {
  const data = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    tokens: hourlyTokens[String(h)] ?? 0,
  }));
  return (
    <ChartContainer config={config} style={{ height: 90 }}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis
          dataKey="hour"
          tickLine={false}
          axisLine={false}
          tickFormatter={(h) => (h % 6 === 0 ? String(h) : '')}
          tick={{ fontSize: 9, fill: 'var(--color-dim)' }}
        />
        <YAxis hide tickFormatter={(v) => formatCompact(v)} />
        <ChartTooltip
          cursor={{ fill: 'var(--chart-4)', fillOpacity: 0.1 }}
          content={<ChartTooltipContent indicator="dashed" />}
        />
        <Bar dataKey="tokens" fill="var(--chart-4)" radius={[1, 1, 0, 0]} isAnimationActive animationDuration={1200} />
      </BarChart>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/TimeOfDayHistogram.tsx
git commit -m "feat(charts): v2 TimeOfDayHistogram (24-bar hour-of-day with tooltips)"
```

---

### Task 10: DayOfWeekChart v2

**Files:**
- Create: `components/charts/v2/DayOfWeekChart.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import type { DailyStat } from '@/lib/stats/profile-data';

const config: ChartConfig = {
  tokens: { label: 'tokens', color: 'var(--chart-5)' },
};
const DAY_LABEL = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

type Props = { stats: DailyStat[] };

export function DayOfWeekChart({ stats }: Props) {
  const buckets = [0, 0, 0, 0, 0, 0, 0];
  for (const s of stats) {
    // s.date is YYYY-MM-DD in local time; Date(...) treats it as UTC midnight.
    // For day-of-week purposes we use UTC day so the bucketing is deterministic.
    const dow = new Date(s.date + 'T00:00:00Z').getUTCDay();
    buckets[dow] += s.tokens_total;
  }
  const data = buckets.map((tokens, i) => ({ day: DAY_LABEL[i], tokens }));

  return (
    <ChartContainer config={config} style={{ height: 90 }}>
      <BarChart data={data} margin={{ left: 0, right: 0, top: 4, bottom: 0 }}>
        <XAxis dataKey="day" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: 'var(--color-dim)' }} />
        <YAxis hide />
        <ChartTooltip cursor={{ fill: 'var(--chart-5)', fillOpacity: 0.1 }} content={<ChartTooltipContent />} />
        <Bar dataKey="tokens" fill="var(--chart-5)" radius={[2, 2, 0, 0]} isAnimationActive animationDuration={1200} />
      </BarChart>
    </ChartContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/DayOfWeekChart.tsx
git commit -m "feat(charts): v2 DayOfWeekChart (UTC-bucketed 7-bar with tooltips)"
```

---

### Task 11: ContributionHeatmap v2

**Files:**
- Create: `components/charts/v2/ContributionHeatmap.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import HeatMap from '@uiw/react-heat-map';
import { useMemo } from 'react';
import type { DailyStat } from '@/lib/stats/profile-data';
import { formatNumber } from '@/lib/format';

type Props = { stats: DailyStat[]; weeks?: number };

const HEAT_COLORS = ['#1a1715', '#3a2a1f', '#6b3e26', '#a8623f', '#d97757'];

export function ContributionHeatmap({ stats, weeks = 52 }: Props) {
  const values = useMemo(
    () =>
      stats.map((s) => ({ date: s.date.replace(/-/g, '/'), count: s.tokens_total })),
    [stats],
  );
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - weeks * 7);

  return (
    <HeatMap
      width={'100%' as unknown as number}
      height={120}
      value={values}
      startDate={start}
      endDate={today}
      space={2}
      rectSize={11}
      panelColors={{
        0: HEAT_COLORS[0],
        100_000: HEAT_COLORS[1],
        500_000: HEAT_COLORS[2],
        1_500_000: HEAT_COLORS[3],
        3_000_000: HEAT_COLORS[4],
      }}
      legendCellSize={0}
      rectRender={(props, data) => {
        const tokens = (data as { count?: number }).count ?? 0;
        return (
          <rect
            {...props}
            rx={1}
            ry={1}
          >
            <title>{`${data.date}: ${formatNumber(tokens)} tokens`}</title>
          </rect>
        );
      }}
    />
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/ContributionHeatmap.tsx
git commit -m "feat(charts): v2 ContributionHeatmap (uiw react-heat-map with terminal palette)"
```

---

### Task 12: ProjectsBarList v2

**Files:**
- Create: `components/charts/v2/ProjectsBarList.tsx`

We render our own BarList rather than pulling `@tremor/react` if the bundle cost is high; this keeps the dependency lighter while matching the visual. Re-eval if Tremor adds value elsewhere.

- [ ] **Step 1: Implement**

```tsx
import { formatCompact, formatNumber } from '@/lib/format';

type Props = {
  projects: Record<string, number>;
  limit?: number;
};

export function ProjectsBarList({ projects, limit = 6 }: Props) {
  const entries = Object.entries(projects)
    .filter(([, v]) => v > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit);
  const max = entries[0]?.[1] ?? 1;
  if (entries.length === 0) {
    return <div style={{ fontSize: '0.6rem', opacity: 0.6 }}>no projects touched yet today</div>;
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {entries.map(([name, value]) => (
        <div
          key={name}
          style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.65rem', fontVariantNumeric: 'tabular-nums' }}
          title={`${name}: ${formatNumber(value)} tokens`}
        >
          <span style={{ width: 110, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          <div style={{ flex: 1, background: 'var(--color-bg-2)', height: 7, borderRadius: 1, overflow: 'hidden' }}>
            <div
              style={{
                width: `${(value / max) * 100}%`,
                background: 'var(--chart-1)',
                height: '100%',
                transition: 'width 800ms ease-out',
              }}
            />
          </div>
          <span style={{ opacity: 0.75, minWidth: 42, textAlign: 'right' }}>{formatCompact(value)}</span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/ProjectsBarList.tsx
git commit -m "feat(charts): v2 ProjectsBarList (animated bars, tabular-nums, hover title)"
```

---

### Task 13: Sparkline v2

**Files:**
- Create: `components/charts/v2/Sparkline.tsx`

- [ ] **Step 1: Implement**

```tsx
'use client';

import { Line, LineChart, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCompact } from '@/lib/format';

type SeriesPoint = { date: string; you: number; them?: number };

type Props = {
  data: SeriesPoint[];
  height?: number;
  showThem?: boolean;
};

export function Sparkline({ data, height = 28, showThem }: Props) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ left: 0, right: 0, top: 2, bottom: 2 }}>
        <Tooltip
          contentStyle={{
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 3,
            fontFamily: 'ui-monospace, monospace',
            fontSize: '0.6rem',
          }}
          formatter={(v: number, name) => [formatCompact(v), name]}
          labelFormatter={(d) => String(d)}
        />
        <Line
          dataKey="you"
          name="you"
          stroke="var(--chart-1)"
          strokeWidth={1.2}
          dot={false}
          isAnimationActive
          animationDuration={1000}
        />
        {showThem && (
          <Line
            dataKey="them"
            name="them"
            stroke="var(--chart-2)"
            strokeWidth={1.2}
            dot={false}
            isAnimationActive
            animationDuration={1000}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/charts/v2/Sparkline.tsx
git commit -m "feat(charts): v2 Sparkline (Recharts LineChart with optional comparison line)"
```

---

## Phase 4 — Profile Page Composition

### Task 14: IdentityStrip component

**Files:**
- Create: `components/dashboard/profile/IdentityStrip.tsx`

- [ ] **Step 1: Implement**

```tsx
import type { ProfileUser } from '@/lib/stats/profile-data';

type Props = {
  user: ProfileUser;
  rank: number | null;
  squadSize: number | null;
  streakDays: number;
  nowProject: string | null;
};

export function IdentityStrip({ user, rank, squadSize, streakDays, nowProject }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '8px 12px',
        border: '1px solid var(--color-border)',
        background: 'var(--color-bg-2)',
        borderRadius: 3,
      }}
    >
      <div
        style={{
          width: 32,
          height: 32,
          borderRadius: '50%',
          background: user.avatar_url
            ? `url(${user.avatar_url}) center/cover`
            : 'linear-gradient(135deg, var(--chart-4), var(--chart-1))',
          flexShrink: 0,
        }}
      />
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <span style={{ fontSize: '0.85rem' }}>@{user.github_handle}</span>
        {user.display_name && (
          <span style={{ fontSize: '0.55rem', opacity: 0.6 }}>{user.display_name}</span>
        )}
      </div>
      {user.primary_persona && (
        <span style={pill('var(--chart-4)', true)}>{user.primary_persona}</span>
      )}
      {user.secondary_personas.slice(0, 2).map((p) => (
        <span key={p} style={pill('var(--chart-2)', false)}>{p}</span>
      ))}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
        {rank != null && squadSize != null && (
          <span style={pill('var(--chart-5)', true)}>rank #{rank} / {squadSize}</span>
        )}
        <span style={pill('var(--chart-3)', true)}>{streakDays}d streak</span>
        {nowProject && (
          <span style={{
            ...pill('var(--chart-4)', false),
            border: '1px dashed var(--chart-4)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--chart-4)', animation: 'cc-pulse 1.5s ease-in-out infinite' }} />
            now: {nowProject}
          </span>
        )}
      </div>
    </div>
  );
}

function pill(color: string, filled: boolean): React.CSSProperties {
  return {
    fontSize: '0.55rem',
    padding: '2px 6px',
    borderRadius: 2,
    background: filled ? color : 'transparent',
    color: filled ? 'var(--color-bg)' : color,
    border: filled ? 'none' : `1px solid ${color}`,
    fontFamily: 'ui-monospace, monospace',
  };
}
```

- [ ] **Step 2: Add `cc-pulse` keyframes to `app/globals.css`**

Append to `app/globals.css`:

```css
@keyframes cc-pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
}
@media (prefers-reduced-motion: reduce) {
  [style*="cc-pulse"] { animation: none !important; }
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/profile/IdentityStrip.tsx app/globals.css
git commit -m "feat(dashboard): IdentityStrip with persona pills, rank, streak, live-now indicator"
```

---

### Task 15: HeroBlock component

**Files:**
- Create: `components/dashboard/profile/HeroBlock.tsx`

- [ ] **Step 1: Add the hero-token CSS class to `app/globals.css`**

Append to `app/globals.css`:

```css
.hero-token {
  font-size: 2.4rem;
  font-weight: 700;
  color: var(--chart-1);
  letter-spacing: -0.02em;
  line-height: 1;
}
```

- [ ] **Step 2: Implement `components/dashboard/profile/HeroBlock.tsx`**

```tsx
'use client';

import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { formatDelta, formatDuration } from '@/lib/format';
import type { DailyStat } from '@/lib/stats/profile-data';

type Props = {
  tokensToday: number;
  sessionsToday: number;
  deepWorkMinutes: number;
  shipsToday: { commits: number; repos: number };
  projectsTouchedCount: number;
  trendStats: DailyStat[]; // last ~30 days for the ghosted sparkline
  deltaVsYesterday: number; // 0.38 → +38%
};

export function HeroBlock({
  tokensToday,
  sessionsToday,
  deepWorkMinutes,
  shipsToday,
  projectsTouchedCount,
  trendStats,
  deltaVsYesterday,
}: Props) {
  const sparkData = [...trendStats]
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .slice(-30)
    .map((s) => ({ d: s.date, v: s.tokens_total }));
  const deltaColor = deltaVsYesterday >= 0 ? 'var(--chart-3)' : 'var(--color-red, #d97373)';
  return (
    <div
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: '14px 16px 12px',
        border: '1px solid var(--color-border)',
        borderLeft: '3px solid var(--chart-1)',
        background: 'linear-gradient(180deg, var(--color-bg-2), var(--color-bg))',
        borderRadius: 3,
      }}
    >
      <div style={{ position: 'absolute', inset: 0, opacity: 0.22, pointerEvents: 'none' }}>
        <ResponsiveContainer>
          <LineChart data={sparkData} margin={{ left: 0, right: 0, top: 8, bottom: 4 }}>
            <Line dataKey="v" stroke="var(--chart-1)" strokeWidth={1} dot={false} isAnimationActive animationDuration={1500} />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div style={{ position: 'relative' }}>
        <div style={{ fontSize: '0.55rem', opacity: 0.55, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          tokens today
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginTop: 4 }}>
          <RollingNumber value={tokensToday} className="hero-token" durationMs={900} />
          <span style={{ fontSize: '0.75rem', color: deltaColor }}>
            {deltaVsYesterday >= 0 ? '▲' : '▼'} {formatDelta(deltaVsYesterday)} vs yesterday
          </span>
        </div>
        <div style={{ fontSize: '0.65rem', opacity: 0.65, marginTop: 6 }}>
          {sessionsToday} sessions · {formatDuration(deepWorkMinutes)} deep work · {shipsToday.commits} ships · across {projectsTouchedCount} projects
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/profile/HeroBlock.tsx app/globals.css
git commit -m "feat(dashboard): HeroBlock with rolling tokens, delta, ghosted sparkline"
```

---

### Task 16: BentoGrid composer

**Files:**
- Create: `components/dashboard/profile/BentoGrid.tsx`

This is a thin grid container — the parent passes tile children with explicit `colSpan` / `rowSpan` props.

- [ ] **Step 1: Implement**

```tsx
import type { ReactNode } from 'react';

type Props = { children: ReactNode };

export function BentoGrid({ children }: Props) {
  return (
    <div className="cc-bento-grid">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Add the grid styles to `app/globals.css`**

Append to `app/globals.css`:

```css
.cc-bento-grid {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 6px;
}
@media (max-width: 768px) {
  .cc-bento-grid { grid-template-columns: 1fr; }
  .cc-bento-grid > * { grid-column: span 1 !important; grid-row: span 1 !important; }
}
```

- [ ] **Step 3: Commit**

```bash
git add components/dashboard/profile/BentoGrid.tsx app/globals.css
git commit -m "feat(dashboard): BentoGrid 6-col composer with mobile single-column stack"
```

---

### Task 17: Recompose ProfileLive

**Files:**
- Modify: `components/ProfileLive.tsx` (full rewrite)

The new ProfileLive keeps the realtime subscription wiring identical, but replaces the StatusBar/BuildsPane/ActivityPane/PersonaPane/TrendsSection layout above the fold with the new IdentityStrip + HeroBlock + BentoGrid composition. The below-the-fold StatsExplorer/LeaderboardSection/GroupLeaderboardSection components stay as-is for this task — they'll be updated in later tasks.

- [ ] **Step 1: Capture the existing realtime subscription block as a reference**

Open `components/ProfileLive.tsx` and read it end-to-end. The block from `useEffect(() => { const supabase = createClient(); ... }, [user.id])` is the realtime wiring. It must be preserved verbatim.

- [ ] **Step 2: Rewrite ProfileLive**

Replace the entire file with:

```tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/browser';
import { StatsExplorer } from '@/components/StatsExplorer';
import { LeaderboardSection } from '@/components/LeaderboardSection';
import { GroupLeaderboardSection } from '@/components/GroupLeaderboardSection';
import { IdentityStrip } from '@/components/dashboard/profile/IdentityStrip';
import { HeroBlock } from '@/components/dashboard/profile/HeroBlock';
import { BentoGrid } from '@/components/dashboard/profile/BentoGrid';
import { BentoTile } from '@/components/dashboard/BentoTile';
import { TokenTrendChart } from '@/components/charts/v2/TokenTrendChart';
import { ModelMix } from '@/components/charts/v2/ModelMix';
import { TimeOfDayHistogram } from '@/components/charts/v2/TimeOfDayHistogram';
import { DayOfWeekChart } from '@/components/charts/v2/DayOfWeekChart';
import { ProjectsBarList } from '@/components/charts/v2/ProjectsBarList';
import { ContributionHeatmap } from '@/components/charts/v2/ContributionHeatmap';
import { RollingNumber } from '@/components/dashboard/RollingNumber';
import { formatCompact, formatDuration } from '@/lib/format';
import { computeStreak } from '@/lib/stats/aggregations';
import type { ProfileData, DailyStat } from '@/lib/stats/profile-data';
import type { LeaderboardData } from '@/lib/stats/leaderboard';

type ProfileLiveProps = {
  initialData: ProfileData;
  leaderboardData: LeaderboardData;
  today: string;
};

export function ProfileLive({ initialData, leaderboardData, today }: ProfileLiveProps) {
  const [dailyStats, setDailyStats] = useState<DailyStat[]>(initialData.dailyStats);
  const { user, machineStats } = initialData;

  useEffect(() => {
    const supabase = createClient();
    const baseChannel: RealtimeChannel = supabase.channel(`daily_stats:${user.id}`);
    const channel = (
      baseChannel.on as unknown as (
        event: 'postgres_changes',
        filter: { event: string; schema: string; table: string; filter: string },
        callback: (payload: { new?: DailyStat }) => void,
      ) => RealtimeChannel
    )(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'daily_stats', filter: `user_id=eq.${user.id}` },
      (payload: { new?: DailyStat }) => {
        const row = payload.new;
        if (!row) return;
        setDailyStats((prev) => {
          const without = prev.filter((r) => r.date !== row.date);
          return [row, ...without].sort((a, b) => (a.date < b.date ? 1 : -1));
        });
      },
    ).subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user.id]);

  const todayRow = useMemo(() => dailyStats.find((s) => s.date === today), [dailyStats, today]);
  const yesterdayRow = useMemo(() => {
    const d = new Date(today + 'T00:00:00Z');
    d.setUTCDate(d.getUTCDate() - 1);
    const key = d.toISOString().slice(0, 10);
    return dailyStats.find((s) => s.date === key);
  }, [dailyStats, today]);

  const tokensToday = todayRow?.tokens_total ?? 0;
  const tokensYesterday = yesterdayRow?.tokens_total ?? 0;
  const deltaVsYesterday = tokensYesterday > 0 ? (tokensToday - tokensYesterday) / tokensYesterday : 0;

  const sessionsToday = todayRow?.sessions ?? 0;
  const deepWorkMinutes = todayRow?.deep_work_minutes ?? 0;
  const shipsToday = (todayRow?.ships as { commits?: number; repos?: number } | undefined) ?? {};
  const projectsTouched = (todayRow?.projects_touched as Record<string, number>) ?? {};
  const tokensByModel = (todayRow?.tokens_by_model as Record<string, number>) ?? {};
  const hourlyTokens = (todayRow?.hourly_tokens as Record<string, number>) ?? {};
  const machinesToday = todayRow?.machines ?? [];

  const projectsTouchedCount = Object.keys(projectsTouched).length;
  const streakDays = computeStreak(dailyStats, today);
  const nowProject = pickNowProject(projectsTouched);

  const rank = leaderboardData?.userRank ?? null;
  const squadSize = leaderboardData?.totalUsers ?? null;

  // Per-machine sub-totals for today, for the machines tile
  const machineRowsToday = machineStats.filter((m) => m.date === today);

  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: '16px 16px 48px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <IdentityStrip
        user={user}
        rank={rank}
        squadSize={squadSize}
        streakDays={streakDays}
        nowProject={nowProject}
      />
      <HeroBlock
        tokensToday={tokensToday}
        sessionsToday={sessionsToday}
        deepWorkMinutes={deepWorkMinutes}
        shipsToday={{ commits: shipsToday.commits ?? 0, repos: shipsToday.repos ?? 0 }}
        projectsTouchedCount={projectsTouchedCount}
        trendStats={dailyStats}
        deltaVsYesterday={deltaVsYesterday}
      />

      <BentoGrid>
        <BentoTile label="30-day tokens" colSpan={4} rowSpan={2}>
          <TokenTrendChart stats={dailyStats} />
        </BentoTile>
        <BentoTile
          label="rank in squad"
          sub={squadSize != null ? `of ${squadSize} members` : undefined}
          colSpan={2}
          href="/leaderboard"
        >
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--chart-5)' }}>
            {rank != null ? `#${rank}` : '—'}
          </span>
        </BentoTile>
        <BentoTile label="streak" sub="days in a row" colSpan={2}>
          <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--chart-3)' }}>
            <RollingNumber value={streakDays} />d
          </span>
        </BentoTile>

        <BentoTile label="model mix" colSpan={2}>
          <ModelMix tokensByModel={tokensByModel} />
        </BentoTile>
        <BentoTile label="hour of day" colSpan={2}>
          <TimeOfDayHistogram hourlyTokens={hourlyTokens} />
        </BentoTile>
        <BentoTile label="day of week" colSpan={2}>
          <DayOfWeekChart stats={dailyStats} />
        </BentoTile>

        <BentoTile label="top projects today" colSpan={3}>
          <ProjectsBarList projects={projectsTouched} />
        </BentoTile>
        <BentoTile label="machines" colSpan={2}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: '0.6rem' }}>
            {machineRowsToday.length === 0 && <div style={{ opacity: 0.6 }}>no machine data today</div>}
            {machineRowsToday.map((m) => (
              <div key={m.machine} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ width: 10, height: 10, border: '1px solid var(--chart-2)', borderRadius: 2 }} />
                <span>{m.machine}</span>
                <span style={{ marginLeft: 'auto', opacity: 0.7 }}>{formatCompact(m.tokens_total)}</span>
              </div>
            ))}
          </div>
        </BentoTile>
        <BentoTile label="ships" sub={`across ${shipsToday.repos ?? 0} repos`} colSpan={1}>
          <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--chart-5)' }}>
            <RollingNumber value={shipsToday.commits ?? 0} />
          </span>
        </BentoTile>
      </BentoGrid>

      <BentoTile label="52-week activity">
        <ContributionHeatmap stats={dailyStats} />
      </BentoTile>

      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', opacity: 0.7, fontSize: '0.7rem' }}>deep dive — trends, projects, machines, leaderboard</summary>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 12 }}>
          <StatsExplorer
            dailyStats={dailyStats}
            machineStats={machineStats}
            today={today}
          />
          <LeaderboardSection data={leaderboardData} userId={user.id} />
          <GroupLeaderboardSection userId={user.id} today={today} />
        </div>
      </details>

      <style>{`
        @media (prefers-reduced-motion: reduce) {
          * { animation: none !important; transition: none !important; }
        }
      `}</style>
    </main>
  );
}

function pickNowProject(projects: Record<string, number>): string | null {
  const entries = Object.entries(projects).sort((a, b) => b[1] - a[1]);
  return entries[0]?.[0] ?? null;
}
```

- [ ] **Step 3: Type-check and run existing tests**

Run: `pnpm exec tsc --noEmit`
Expected: passes. If the existing `ProfileLive` test relied on now-removed components, update those expectations to assert the new top-of-page content. See Step 4.

- [ ] **Step 4: Update or remove the existing ProfileLive test**

Open `tests/components/ProfileLive.test.tsx`. Replace its assertions with the following minimal set that targets the new layout:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProfileLive } from '@/components/ProfileLive';
import type { ProfileData } from '@/lib/stats/profile-data';

const initialData: ProfileData = {
  user: {
    id: 'u1',
    github_handle: 'holden-alt',
    display_name: 'Holden',
    avatar_url: null,
    primary_persona: 'vibe-coder',
    secondary_personas: ['ai-builder'],
  },
  dailyStats: [{
    user_id: 'u1', date: '2026-05-19', tokens_total: 487231,
    tokens_by_model: { 'claude-opus-4-7': 480000 },
    sessions: 6, deep_work_minutes: 240, machines: ['mbp'],
    projects_touched: { 'cc-dashboard': 320000, 'holden': 167231 },
    ships: { commits: 3, repos: 2 }, hourly_tokens: { '14': 100000 },
    source_synced_at: null,
  }] as any,
  machineStats: [],
};

const leaderboardData = { userRank: 3, totalUsers: 6 } as any;

describe('ProfileLive (new layout)', () => {
  it('renders the handle in the identity strip', () => {
    render(<ProfileLive initialData={initialData} leaderboardData={leaderboardData} today="2026-05-19" />);
    expect(screen.getByText('@holden-alt')).toBeInTheDocument();
  });
  it('renders the rank tile with a numeric rank', () => {
    render(<ProfileLive initialData={initialData} leaderboardData={leaderboardData} today="2026-05-19" />);
    expect(screen.getByText('#3')).toBeInTheDocument();
  });
});
```

- [ ] **Step 5: Run all unit tests**

Run: `pnpm vitest run`
Expected: PASS (some legacy tests for ActivityPane/StatusBar/etc may still exist and pass against the old components since those files still exist — they just aren't imported by ProfileLive anymore).

- [ ] **Step 6: Verify build**

Run: `pnpm run build`
Expected: build succeeds.

- [ ] **Step 7: Commit**

```bash
git add components/ProfileLive.tsx tests/components/ProfileLive.test.tsx
git commit -m "feat(profile): recompose ProfileLive into bento layout with v2 charts"
```

---

## Phase 5 — Other Surfaces

### Task 18: Update Leaderboard visuals

**Files:**
- Modify: `components/leaderboard/RankList.tsx` (or equivalent)
- Modify: `components/leaderboard/BarComparison.tsx`

- [ ] **Step 1: Read the existing files**

Run: `find components/leaderboard -type f` and read each. Note the props each component takes — the rewrite must preserve the public interface (component name, props) so calling sites in `Leaderboard.tsx`, `LeaderboardSection.tsx`, `GroupLeaderboardSection.tsx`, and `app/leaderboard/page.tsx` continue to work unchanged.

- [ ] **Step 2: Replace `BarComparison` internals with `ProjectsBarList` styling**

Substitute the hand-rolled bar markup inside `BarComparison.tsx` with the same animated-bar idiom from `components/charts/v2/ProjectsBarList.tsx`. Keep the component signature identical. Each row should be `[rank] [handle] [animated bar] [value]` and include a `title` attribute with the exact value for hover.

(Show complete replacement code for the implementer):

```tsx
import { formatCompact, formatNumber } from '@/lib/format';

type Row = { rank: number; handle: string; value: number };
type Props = { rows: Row[]; highlightHandle?: string | null };

export function BarComparison({ rows, highlightHandle }: Props) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {rows.map((r) => {
        const isMe = r.handle === highlightHandle;
        return (
          <div
            key={r.handle}
            title={`${r.handle}: ${formatNumber(r.value)}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: '0.7rem',
              fontVariantNumeric: 'tabular-nums',
              background: isMe ? 'rgba(217,119,87,0.08)' : 'transparent',
              padding: '3px 4px',
              borderRadius: 2,
            }}
          >
            <span style={{ width: 22, textAlign: 'right', opacity: 0.6 }}>#{r.rank}</span>
            <span style={{ width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              @{r.handle}
            </span>
            <div style={{ flex: 1, background: 'var(--color-bg-2)', height: 7, borderRadius: 1, overflow: 'hidden' }}>
              <div
                style={{
                  width: `${(r.value / max) * 100}%`,
                  background: isMe ? 'var(--chart-1)' : 'var(--chart-2)',
                  height: '100%',
                  transition: 'width 800ms ease-out',
                }}
              />
            </div>
            <span style={{ opacity: 0.85, minWidth: 52, textAlign: 'right' }}>{formatCompact(r.value)}</span>
          </div>
        );
      })}
    </div>
  );
}
```

If the existing `Props` shape differs, keep the existing one and only swap the internal markup.

- [ ] **Step 3: Run leaderboard tests**

Run: `pnpm vitest run tests/components/Leaderboard.test.tsx tests/components/LeaderboardSection.test.tsx`
Expected: PASS. If tests assert old DOM structures, update assertions to match the new markup while keeping behavioral coverage intact.

- [ ] **Step 4: Commit**

```bash
git add components/leaderboard tests/components/Leaderboard.test.tsx tests/components/LeaderboardSection.test.tsx
git commit -m "feat(leaderboard): swap BarComparison internals to animated v2 bars"
```

---

### Task 19: Update head-to-head sparklines

**Files:**
- Modify: `components/head-to-head/StatRow.tsx` (or equivalent — file that uses the old `Sparkline`)
- Modify: `components/HeadToHead.tsx`

- [ ] **Step 1: Find consumers of the old sparkline**

Run: `grep -rn "components/head-to-head/Sparkline" components/ app/`
For each consumer, replace the `import { Sparkline } from '@/components/head-to-head/Sparkline'` with `import { Sparkline } from '@/components/charts/v2/Sparkline'`. The new API takes `{ data: { date, you, them? }[], height?, showThem? }` — adapt the call site mapping accordingly.

- [ ] **Step 2: Verify**

Run: `pnpm exec tsc --noEmit` and `pnpm vitest run`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add components/head-to-head components/HeadToHead.tsx
git commit -m "feat(h2h): swap to v2 Sparkline with tooltips"
```

---

### Task 20: Update groups page

**Files:**
- Modify: `app/groups/[slug]/page.tsx`
- Modify: `components/GroupLeaderboardSection.tsx`

- [ ] **Step 1: Verify group leaderboard uses the updated BarComparison**

The leaderboard surface is shared. Open `components/GroupLeaderboardSection.tsx` and confirm it composes the (already-updated) `BarComparison`. No code change needed unless it imports the old hand-rolled chart directly.

- [ ] **Step 2: If GroupLeaderboardSection embeds its own visuals, replace them with `BarComparison` from Task 18**

Show the implementer how to adapt: `import { BarComparison } from '@/components/leaderboard/BarComparison'` and feed `rows` mapped from the group leaderboard data.

- [ ] **Step 3: Verify build**

Run: `pnpm run build`
Expected: succeeds.

- [ ] **Step 4: Commit (only if files changed)**

```bash
git add components/GroupLeaderboardSection.tsx app/groups/[slug]/page.tsx
git commit -m "feat(groups): use shared BarComparison for group leaderboard"
```

---

## Phase 6 — Polish & Cleanup

### Task 21: Tile entrance stagger + reduced-motion sanity

**Files:**
- Modify: `app/globals.css`
- Modify: `components/dashboard/BentoTile.tsx`

- [ ] **Step 1: Add entrance keyframes and bento children animation**

Append to `app/globals.css`:

```css
@keyframes cc-tile-in {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}
.cc-bento-grid > .bento-tile,
main > .bento-tile {
  animation: cc-tile-in 400ms ease-out both;
}
.cc-bento-grid > .bento-tile:nth-child(1) { animation-delay: 0ms; }
.cc-bento-grid > .bento-tile:nth-child(2) { animation-delay: 50ms; }
.cc-bento-grid > .bento-tile:nth-child(3) { animation-delay: 100ms; }
.cc-bento-grid > .bento-tile:nth-child(4) { animation-delay: 150ms; }
.cc-bento-grid > .bento-tile:nth-child(5) { animation-delay: 200ms; }
.cc-bento-grid > .bento-tile:nth-child(6) { animation-delay: 250ms; }
.cc-bento-grid > .bento-tile:nth-child(7) { animation-delay: 300ms; }
.cc-bento-grid > .bento-tile:nth-child(8) { animation-delay: 350ms; }
.cc-bento-grid > .bento-tile:nth-child(9) { animation-delay: 400ms; }
.cc-bento-grid > .bento-tile:nth-child(n+10) { animation-delay: 450ms; }
@media (prefers-reduced-motion: reduce) {
  .cc-bento-grid > .bento-tile,
  main > .bento-tile { animation: none !important; }
}
```

- [ ] **Step 2: Verify by visual inspection (dev server)**

Run: `pnpm dev`. Open http://localhost:3000/holden-alt. Hard refresh. Confirm tiles fade up in document order. Toggle "Emulate prefers-reduced-motion: reduce" in Chrome DevTools rendering pane; confirm animation disappears.

Stop server.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css
git commit -m "feat(motion): bento tile entrance stagger + reduced-motion respect"
```

---

### Task 22: Mobile pass

**Files:**
- Modify: `app/globals.css`
- Modify: `components/dashboard/profile/IdentityStrip.tsx`

- [ ] **Step 1: Confirm bento mobile collapse**

The grid mobile rule from Task 16 already collapses to single column at `<768px`. Verify in dev server with Chrome DevTools device emulation set to iPhone 14. Hard refresh /holden-alt.

- [ ] **Step 2: Fix identity strip wrapping on mobile**

Update `components/dashboard/profile/IdentityStrip.tsx`'s outer `<div>` `style` to add:

```ts
flexWrap: 'wrap',
rowGap: 6,
```

- [ ] **Step 3: Add mobile heatmap horizontal scroll**

Append to `app/globals.css`:

```css
@media (max-width: 768px) {
  main > .bento-tile :where([class*="HeatMap"], svg) {
    overflow-x: auto;
  }
}
```

(If the heatmap renders as an `<svg>` directly without a wrapping div, wrap it in `BentoTile`'s content area at the call site to enable horizontal scroll. See implementer note in Task 17 — `ContributionHeatmap` is already inside a `<BentoTile>`, so the wrapper is in place.)

- [ ] **Step 4: Visual verify in DevTools mobile mode**

Toggle mobile mode at 375px width. Confirm bento stacks, identity strip wraps cleanly, heatmap scrolls.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css components/dashboard/profile/IdentityStrip.tsx
git commit -m "feat(mobile): bento single-column stack + identity strip wrap + heatmap scroll"
```

---

### Task 23: Delete the old chart components

**Files:**
- Delete: `components/charts/TokenTrendChart.tsx`
- Delete: `components/charts/TimeOfDayHistogram.tsx`
- Delete: `components/charts/DayOfWeekChart.tsx`
- Delete: `components/charts/ModelAreaChart.tsx`
- Delete: `components/charts/ModelDonut.tsx`
- Delete: `components/Heatmap.tsx`
- Delete: `components/RankedBarList.tsx`
- Delete: `components/head-to-head/Sparkline.tsx`
- Delete: `components/ActivityPane.tsx`
- Delete: `components/BuildsPane.tsx`
- Delete: `components/PersonaPane.tsx`
- Delete: `components/StatusBar.tsx`
- Delete: `components/TrendsSection.tsx`

The new ProfileLive doesn't import any of these. StatsExplorer + LeaderboardSection + GroupLeaderboardSection are still imported (Task 17) and stay.

- [ ] **Step 1: Find any remaining imports**

Run from repo root:
```bash
grep -rn "from '@/components/charts/TokenTrendChart'\|from '@/components/charts/TimeOfDayHistogram'\|from '@/components/charts/DayOfWeekChart'\|from '@/components/charts/ModelAreaChart'\|from '@/components/charts/ModelDonut'\|from '@/components/Heatmap'\|from '@/components/RankedBarList'\|from '@/components/head-to-head/Sparkline'\|from '@/components/ActivityPane'\|from '@/components/BuildsPane'\|from '@/components/PersonaPane'\|from '@/components/StatusBar'\|from '@/components/TrendsSection'" app components
```

Expected: zero hits OR only `tests/` hits. Tests that import these will be deleted in Step 3.

If any non-test, non-trivial import remains, abort Step 2 and fix the import first (the new ProfileLive should be the only consumer of the new components; if something else still uses the legacy chart, replace that consumer with the v2 equivalent or remove it from scope).

- [ ] **Step 2: Delete the source files**

```bash
git rm components/charts/TokenTrendChart.tsx \
       components/charts/TimeOfDayHistogram.tsx \
       components/charts/DayOfWeekChart.tsx \
       components/charts/ModelAreaChart.tsx \
       components/charts/ModelDonut.tsx \
       components/Heatmap.tsx \
       components/RankedBarList.tsx \
       components/head-to-head/Sparkline.tsx \
       components/ActivityPane.tsx \
       components/BuildsPane.tsx \
       components/PersonaPane.tsx \
       components/StatusBar.tsx \
       components/TrendsSection.tsx
```

- [ ] **Step 3: Delete corresponding tests**

```bash
git rm -f tests/components/ActivityPane.test.tsx \
          tests/components/BuildsPane.test.tsx \
          tests/components/PersonaPane.test.tsx \
          tests/components/StatusBar.test.tsx \
          tests/components/Heatmap.test.tsx 2>/dev/null
```

If any of these don't exist, the `2>/dev/null` swallows the error — that's fine.

- [ ] **Step 4: Verify build + tests still pass**

Run: `pnpm run build && pnpm vitest run`
Expected: both PASS.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: remove legacy hand-rolled chart components and tests"
```

---

### Task 24: End-to-end visual verification + ship

**Files:** none.

- [ ] **Step 1: Start dev server**

Run: `pnpm dev` (in a separate terminal).

- [ ] **Step 2: Verification checklist**

Open http://localhost:3000/holden-alt and visually verify each row:

- [ ] Identity strip: avatar, handle, persona pills, rank pill, streak pill, pulsing "now coding" pill all visible
- [ ] Hero: giant orange token number, ghosted sparkline behind, delta with up/down arrow, sub-line shows sessions / deep work / ships / projects
- [ ] Hovering the 30d marquee chart shows a tooltip with the date and exact token count
- [ ] Clicking range pills (7d / 30d / 90d / all) changes the chart domain
- [ ] Model mix donut renders with legend and percentages
- [ ] Hour-of-day shows 24 bars with hover values
- [ ] Day-of-week shows 7 bars labeled S M T W T F S
- [ ] Top projects list shows top 6 sorted by tokens, with bar widths reflecting relative values
- [ ] Machines tile shows current machines with token counts
- [ ] Ships tile shows commit count
- [ ] Heatmap renders 52 weeks, cells have native title tooltips with date + tokens
- [ ] "deep dive" details element expands to show StatsExplorer / LeaderboardSection
- [ ] Tiles fade-up in stagger on initial load
- [ ] Hovering any clickable tile (rank tile) brightens its border
- [ ] At ≤768px width, bento collapses to single column

- [ ] **Step 3: Verify signed-out users still see the dashboard publicly**

Open in incognito → http://localhost:3000/holden-alt. Auth widget top-right says "not signed in". Profile fully renders. Confirm `/api/whoami` returns `{"signed_in":false}`.

- [ ] **Step 4: Stop dev server, run full build + tests**

```bash
pnpm vitest run
pnpm run build
```

Both must pass.

- [ ] **Step 5: Push to deploy**

```bash
git push
```

Then watch CF Pages auto-deploy. Once `deploy:success`, smoke-test the production URL: https://cc-dashboard-qab.pages.dev/holden-alt.

- [ ] **Step 6: Final commit if any verification revealed issues**

Only if Step 2 surfaced visual issues — fix them in a follow-up commit, push again, re-verify.

---

## Out of scope (deferred follow-ups)

- Day-detail click-through modal on heatmap cells.
- New routes for project-filtered profile views.
- Per-user customizable layouts (drag-to-rearrange).
- A dedicated mobile design beyond stack-and-go.
- Replacing `StatsExplorer`'s internal hand-rolled tabs with v2 charts (it's below the fold; remains usable; future task).
- Migrating to `@tremor/react` if a future tile needs Tremor primitives — for now we render our own BarList (see Task 12).
