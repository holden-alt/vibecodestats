import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { Sparkline } from '@/components/head-to-head/Sparkline';

describe('Sparkline', () => {
  it('renders one SVG with two polylines (A in orange, B in cyan)', () => {
    const { container } = render(
      <Sparkline seriesA={[1, 2, 3]} seriesB={[3, 2, 1]} ariaLabel="tokens 3 days" />,
    );
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('aria-label')).toBe('tokens 3 days');
    const polylines = container.querySelectorAll('polyline');
    expect(polylines.length).toBe(2);
    expect((polylines[0] as SVGPolylineElement).getAttribute('data-series')).toBe('A');
    expect((polylines[1] as SVGPolylineElement).getAttribute('data-series')).toBe('B');
  });

  it('renders a baseline placeholder when both series are all-zero', () => {
    const { container } = render(<Sparkline seriesA={[0, 0, 0]} seriesB={[0, 0, 0]} ariaLabel="x" />);
    // Polylines aren't drawn for all-zero series; a single baseline path is rendered instead.
    expect(container.querySelector('[data-baseline]')).toBeTruthy();
    expect(container.querySelectorAll('polyline').length).toBe(0);
  });

  it('handles series of unequal length by sampling each to the same x-axis length', () => {
    // The component requires both arrays to be the same length (length 30 in production).
    // If they aren't, it falls back to the shorter length.
    const { container } = render(
      <Sparkline seriesA={[1, 2, 3, 4]} seriesB={[1, 2]} ariaLabel="x" />,
    );
    const pointsA = container.querySelector('polyline[data-series="A"]')?.getAttribute('points');
    expect(pointsA?.split(' ').length).toBe(2); // truncated to len-2 of B
  });
});
