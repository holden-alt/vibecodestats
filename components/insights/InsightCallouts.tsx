// Insight callouts — 3–5 computed one-liners, plain rule-based (no LLM calls).
// Rendered as terminal log lines with a leading orange prompt glyph. Degrades
// gracefully: renders nothing if no callout cleared its sample-size gate.
export function InsightCallouts({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <section
      className="term-panel"
      style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}
      aria-label="Computed insights"
    >
      {lines.map((line, i) => (
        <div
          key={i}
          style={{ display: 'flex', gap: 10, alignItems: 'baseline', fontSize: '0.76rem', lineHeight: 1.45 }}
        >
          <span aria-hidden style={{ color: 'var(--color-orange)', flexShrink: 0 }}>
            ›
          </span>
          <span style={{ color: 'var(--color-text)' }}>{line}</span>
        </div>
      ))}
    </section>
  );
}
