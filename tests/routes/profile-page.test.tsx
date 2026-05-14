import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { notFound } from 'next/navigation';

vi.mock('next/navigation', () => ({
  notFound: vi.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));

function mockSupabase(handle: string, exists: boolean) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn(async () => ({
            data: exists
              ? {
                  id: 'u1',
                  github_handle: handle,
                  display_name: 'Holden',
                  avatar_url: null,
                  primary_persona: null,
                  secondary_personas: [],
                }
              : null,
            error: null,
          })),
        })),
      })),
    })),
  };
}

describe('GET /[handle]', () => {
  it('renders the handle when user exists', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase('holden', true)) }));
    const { default: Page } = await import('../../app/[handle]/page');
    const ui = await Page({ params: Promise.resolve({ handle: 'holden' }) });
    render(ui as any);
    expect(screen.getByText(/\$ holden/)).toBeInTheDocument();
    vi.doUnmock('@/lib/supabase/server');
  });

  it('calls notFound when user is missing', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => mockSupabase('ghost', false)) }));
    const { default: Page } = await import('../../app/[handle]/page');
    await expect(Page({ params: Promise.resolve({ handle: 'ghost' }) })).rejects.toThrow('NEXT_NOT_FOUND');
    expect(notFound).toHaveBeenCalled();
    vi.doUnmock('@/lib/supabase/server');
  });
});
