import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ModelDonut } from '@/components/charts/ModelDonut';

describe('ModelDonut', () => {
  it('renders a legend entry per model class with rounded percentages', () => {
    const { container } = render(
      <ModelDonut totals={{ opus: 750, sonnet: 250, haiku: 0, other: 0 }} />,
    );
    expect(container.querySelector('[data-legend="opus"]')?.getAttribute('data-pct')).toBe('75');
    expect(container.querySelector('[data-legend="sonnet"]')?.getAttribute('data-pct')).toBe('25');
    expect(container.querySelector('[data-legend="haiku"]')?.getAttribute('data-pct')).toBe('0');
  });

  it('renders the donut element', () => {
    const { container } = render(
      <ModelDonut totals={{ opus: 1, sonnet: 0, haiku: 0, other: 0 }} />,
    );
    expect(container.querySelector('[data-donut]')).toBeTruthy();
  });

  it('does not divide by zero on all-zero totals', () => {
    const { container } = render(
      <ModelDonut totals={{ opus: 0, sonnet: 0, haiku: 0, other: 0 }} />,
    );
    expect(container.querySelector('[data-legend="opus"]')?.getAttribute('data-pct')).toBe('0');
  });
});
