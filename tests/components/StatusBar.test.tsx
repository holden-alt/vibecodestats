import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '@/components/StatusBar';

describe('StatusBar', () => {
  it('renders handle, persona, streak, rank, tokens, badges segments', () => {
    render(<StatusBar handle="holden" primaryPersona="THE FOUNDER" />);
    expect(screen.getByText(/\$ holden/)).toBeInTheDocument();
    expect(screen.getByText(/THE FOUNDER/)).toBeInTheDocument();
    expect(screen.getByText(/streak/i)).toBeInTheDocument();
    expect(screen.getByText(/#\d+/)).toBeInTheDocument();
    expect(screen.getByText(/tokens/i)).toBeInTheDocument();
    expect(screen.getByText(/badges/i)).toBeInTheDocument();
  });

  it('uses NO PERSONA placeholder when primaryPersona is null', () => {
    render(<StatusBar handle="holden" primaryPersona={null} />);
    expect(screen.getByText(/NO PERSONA YET/)).toBeInTheDocument();
  });
});
