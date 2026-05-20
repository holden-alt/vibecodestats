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
