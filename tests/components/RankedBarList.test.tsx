import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { RankedBarList } from '@/components/RankedBarList';

describe('RankedBarList', () => {
  it('renders one row per item', () => {
    const { container } = render(
      <RankedBarList items={[
        { label: 'project-a', value: 1000 },
        { label: 'project-b', value: 500 },
      ]} />,
    );
    expect(container.querySelectorAll('[data-row]').length).toBe(2);
  });

  it('scales the largest item bar to 100% and others proportionally', () => {
    const { container } = render(
      <RankedBarList items={[
        { label: 'big', value: 200 },
        { label: 'small', value: 50 },
      ]} />,
    );
    expect(container.querySelector('[data-label="big"] [data-bar]')?.getAttribute('data-pct')).toBe('100');
    expect(container.querySelector('[data-label="small"] [data-bar]')?.getAttribute('data-pct')).toBe('25');
  });

  it('renders an empty state when there are no items', () => {
    const { container } = render(<RankedBarList items={[]} />);
    expect(container.querySelector('[data-empty]')).toBeTruthy();
    expect(container.querySelectorAll('[data-row]').length).toBe(0);
  });
});
