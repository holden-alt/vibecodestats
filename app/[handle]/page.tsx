import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { StatusBar } from '@/components/StatusBar';
import { BuildsPane } from '@/components/BuildsPane';
import { ActivityPane } from '@/components/ActivityPane';
import { PersonaPane } from '@/components/PersonaPane';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const { data: user } = await supabase
    .from('users')
    .select('id, github_handle, display_name, avatar_url, primary_persona, secondary_personas')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!user) {
    notFound();
  }

  return (
    <main className="min-h-screen px-6 py-4 max-w-[1400px] mx-auto">
      <StatusBar handle={user.github_handle} primaryPersona={user.primary_persona ?? null} />

      <section className="grid grid-cols-1 lg:grid-cols-[1.2fr_2fr_1.2fr] gap-3 mt-4">
        <BuildsPane />
        <ActivityPane />
        <PersonaPane primary={user.primary_persona ?? null} secondary={user.secondary_personas ?? []} />
      </section>
    </main>
  );
}
