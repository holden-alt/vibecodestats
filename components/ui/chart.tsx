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
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; name?: string; color?: string; value?: number; payload?: Record<string, any> }>;
  label?: string | number;
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
        {payload.map((item: any, i: number) => {
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
