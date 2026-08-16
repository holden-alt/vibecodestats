import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';

const redirectMock = vi.fn((path: string) => {
  throw new Error(`NEXT_REDIRECT:${path}`);
});
vi.mock('next/navigation', () => ({ redirect: redirectMock }));

function mockSsrClient(
  authUser: { id: string; email?: string } | null,
  profile: { github_handle: string; team: string | null } | null,
) {
  return {
    auth: {
      getUser: vi.fn(async () => ({
        data: { user: authUser },
        error: null,
      })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(async () => ({ data: profile, error: profile ? null : new Error('not found') })),
        })),
      })),
    })),
  };
}

describe('OnboardingPage', () => {
  it('redirects to /auth/signin when not authenticated', async () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/db/server', () => ({
      createClient: vi.fn(async () => mockSsrClient(null, null)),
    }));
    const { default: OnboardingPage } = await import('../../app/onboarding/page');
    await expect(OnboardingPage()).rejects.toThrow(/NEXT_REDIRECT:\/auth\/signin\?next=\/onboarding/);
  });

  it('redirects to profile when team is already set', async () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/db/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient(
          { id: 'auth-1', email: 'user@github.com' },
          { github_handle: 'alice', team: 'claude_code' },
        ),
      ),
    }));
    const { default: OnboardingPage } = await import('../../app/onboarding/page');
    await expect(OnboardingPage()).rejects.toThrow(/NEXT_REDIRECT:\/alice/);
  });

  it('renders both team options and opt-in checkbox (default unchecked) for a new user', async () => {
    vi.resetModules();
    vi.doMock('next/navigation', () => ({ redirect: redirectMock }));
    vi.doMock('@/lib/db/server', () => ({
      createClient: vi.fn(async () =>
        mockSsrClient(
          { id: 'auth-2', email: 'newuser@example.com' },
          { github_handle: 'bob', team: null },
        ),
      ),
    }));
    // OnboardingForm is a client component — render it directly to check the DOM.
    const { OnboardingForm } = await import('../../app/onboarding/OnboardingForm');
    const { container } = render(<OnboardingForm defaultEmail="newuser@example.com" />);

    // Both team buttons present
    const buttons = container.querySelectorAll('button[type="button"]');
    const texts = Array.from(buttons).map((b) => b.textContent ?? '');
    expect(texts.some((t) => t.includes('Team Claude Code'))).toBe(true);
    expect(texts.some((t) => t.includes('Team Codex'))).toBe(true);

    // Opt-in checkbox present and unchecked by default
    const checkbox = container.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(checkbox).not.toBeNull();
    expect(checkbox?.checked).toBe(false);

    // Email input prefilled
    const emailInput = container.querySelector('input[type="email"]') as HTMLInputElement | null;
    expect(emailInput?.value).toBe('newuser@example.com');
  });
});
