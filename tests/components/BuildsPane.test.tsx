import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BuildsPane } from '@/components/BuildsPane';

describe('BuildsPane', () => {
  it('renders the "· builds" header', () => {
    render(<BuildsPane projects={{}} />);
    expect(screen.getByText(/· builds/i)).toBeInTheDocument();
  });
  it('renders a row per project, sorted by tokens descending', () => {
    render(<BuildsPane projects={{
      'realsavvy/agnt-portal': 50000,
      'holden-alt/cc-dashboard': 300000,
      'holdengr': 10000,
    }} />);
    const rows = screen.getAllByTestId('build-row');
    expect(rows).toHaveLength(3);
    // first row is the highest-token project
    expect(rows[0]).toHaveTextContent('holden-alt/cc-dashboard');
  });
  it('shows an empty hint when there are no projects today', () => {
    render(<BuildsPane projects={{}} />);
    expect(screen.getByText(/no builds yet today/i)).toBeInTheDocument();
  });
});
