import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { SegmentedControl } from '@/components/SegmentedControl';

const OPTIONS = [
  { id: 'a', label: 'Alpha' },
  { id: 'b', label: 'Beta' },
  { id: 'c', label: 'Gamma' },
];

describe('SegmentedControl', () => {
  it('renders one button per option', () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="a" onChange={() => {}} />,
    );
    expect(container.querySelectorAll('[data-segment]').length).toBe(3);
  });

  it('marks the active option', () => {
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="b" onChange={() => {}} />,
    );
    expect(container.querySelector('[data-segment="b"]')?.getAttribute('data-active')).toBe('true');
    expect(container.querySelector('[data-segment="a"]')?.getAttribute('data-active')).toBe('false');
  });

  it('calls onChange with the option id when a segment is clicked', () => {
    const onChange = vi.fn();
    const { container } = render(
      <SegmentedControl options={OPTIONS} value="a" onChange={onChange} />,
    );
    fireEvent.click(container.querySelector('[data-segment="c"]')!);
    expect(onChange).toHaveBeenCalledWith('c');
  });
});
