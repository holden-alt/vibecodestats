import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuildsPane } from '@/components/BuildsPane';

describe('BuildsPane', () => {
  it('renders the "· builds" header', () => {
    render(<BuildsPane />);
    expect(screen.getByText(/· builds/i)).toBeInTheDocument();
  });
  it('renders placeholder build rows', () => {
    render(<BuildsPane />);
    const rows = screen.getAllByTestId('build-row');
    expect(rows.length).toBeGreaterThanOrEqual(3);
  });
});
