import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ActivityPane } from '@/components/ActivityPane';

describe('ActivityPane', () => {
  it('renders "tokens today", "vs avg", "streak", "machines" stat labels', () => {
    render(<ActivityPane />);
    expect(screen.getByText(/tokens today/i)).toBeInTheDocument();
    expect(screen.getByText(/vs avg/i)).toBeInTheDocument();
    expect(screen.getByText(/streak/i)).toBeInTheDocument();
    expect(screen.getByText(/machines/i)).toBeInTheDocument();
  });
  it('renders model stack legend (opus, sonnet, haiku)', () => {
    render(<ActivityPane />);
    expect(screen.getByText(/opus/i)).toBeInTheDocument();
    expect(screen.getByText(/sonnet/i)).toBeInTheDocument();
    expect(screen.getByText(/haiku/i)).toBeInTheDocument();
  });
  it('embeds the heatmap (role=img)', () => {
    render(<ActivityPane />);
    expect(screen.getByRole('img', { name: /52-week activity heatmap/i })).toBeInTheDocument();
  });
});
