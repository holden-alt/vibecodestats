import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { StatRow } from '@/components/head-to-head/StatRow';

describe('StatRow', () => {
  it('renders metric label, both values, and a sparkline', () => {
    const { container } = render(
      <StatRow
        metric="tokens"
        valueA={150}
        valueB={700}
        winner="B"
        sparkA={[1, 2, 3]}
        sparkB={[3, 2, 1]}
      />,
    );
    expect(container.textContent?.toLowerCase()).toContain('tokens');
    expect(container.querySelector('[data-stat-value="A"]')?.textContent).toContain('150');
    expect(container.querySelector('[data-stat-value="B"]')?.textContent).toContain('700');
    expect(container.querySelector('svg')).toBeTruthy();
  });

  it('marks the winning cell with data-winner=true', () => {
    const { container } = render(
      <StatRow metric="tokens" valueA={150} valueB={700} winner="B" sparkA={[]} sparkB={[]} />,
    );
    expect(container.querySelector('[data-stat-value="A"]')?.getAttribute('data-winner')).toBe('false');
    expect(container.querySelector('[data-stat-value="B"]')?.getAttribute('data-winner')).toBe('true');
  });

  it('marks neither cell as winner on a tie', () => {
    const { container } = render(
      <StatRow metric="tokens" valueA={100} valueB={100} winner="tie" sparkA={[]} sparkB={[]} />,
    );
    expect(container.querySelector('[data-stat-value="A"]')?.getAttribute('data-winner')).toBe('false');
    expect(container.querySelector('[data-stat-value="B"]')?.getAttribute('data-winner')).toBe('false');
  });

  it('shows the deepwork suffix "h" on the deepwork metric', () => {
    const { container } = render(
      <StatRow metric="deepwork" valueA={3} valueB={5} winner="B" sparkA={[]} sparkB={[]} />,
    );
    expect(container.querySelector('[data-stat-value="A"]')?.textContent).toMatch(/3\s*h/);
    expect(container.querySelector('[data-stat-value="B"]')?.textContent).toMatch(/5\s*h/);
  });
});
