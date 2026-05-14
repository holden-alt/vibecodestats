import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PersonaPane } from '@/components/PersonaPane';

describe('PersonaPane', () => {
  it('renders the primary persona name', () => {
    render(<PersonaPane primary="THE FOUNDER" secondary={['NIGHT-OWL']} />);
    expect(screen.getByText(/THE FOUNDER/)).toBeInTheDocument();
    expect(screen.getByText(/NIGHT-OWL/)).toBeInTheDocument();
  });
  it('renders "NO PERSONA YET" placeholder when primary is null', () => {
    render(<PersonaPane primary={null} secondary={[]} />);
    expect(screen.getByText(/NO PERSONA YET/)).toBeInTheDocument();
  });
  it('renders "· badges" and "· next up" subheadings', () => {
    render(<PersonaPane primary="THE FOUNDER" secondary={[]} />);
    expect(screen.getByText(/· badges/i)).toBeInTheDocument();
    expect(screen.getByText(/· next up/i)).toBeInTheDocument();
  });
});
