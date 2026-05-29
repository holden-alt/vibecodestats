import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingForm } from './OnboardingForm';

export const runtime = 'edge';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();

  if (!authUser) {
    redirect('/auth/signin?next=/onboarding');
  }

  const { data: profile } = await supabase
    .from('users')
    .select('github_handle, team')
    .eq('auth_id', authUser.id)
    .single();

  if (!profile) {
    redirect('/');
  }

  // Already onboarded — don't re-run the flow.
  if (profile.team) {
    redirect(`/${profile.github_handle}`);
  }

  // Prefill with the GitHub email from auth metadata (may be null/empty).
  const defaultEmail =
    authUser.email ??
    (authUser.user_metadata?.email as string | undefined) ??
    '';

  const sectionStyle: React.CSSProperties = {
    border: '1px solid var(--color-border)',
    borderRadius: 3,
    padding: '20px 24px',
  };

  return (
    <main
      style={{
        maxWidth: 520,
        margin: '0 auto',
        padding: '64px 24px 80px',
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
        color: 'var(--color-text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 24,
      }}
    >
      <div>
        <div
          style={{
            fontSize: '0.65rem',
            opacity: 0.55,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            color: 'var(--color-orange)',
            marginBottom: 8,
          }}
        >
          one-time setup
        </div>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, margin: '0 0 8px', letterSpacing: '-0.01em' }}>
          Pick your camp.
        </h1>
        <p style={{ fontSize: '0.9rem', opacity: 0.75, margin: 0, lineHeight: 1.55 }}>
          Team Claude Code or Team Codex. One free switch, then it&apos;s locked. The scoreboard
          swings daily.
        </p>
      </div>

      <section style={sectionStyle}>
        <OnboardingForm defaultEmail={defaultEmail} />
      </section>
    </main>
  );
}
