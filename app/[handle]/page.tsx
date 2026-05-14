import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getProfileData } from '@/lib/stats/profile-data';
import { ProfileLive } from '@/components/ProfileLive';

export const runtime = 'edge';

type ProfilePageProps = {
  params: Promise<{ handle: string }>;
};

export default async function ProfilePage({ params }: ProfilePageProps) {
  const { handle } = await params;
  const supabase = await createClient();

  const data = await getProfileData(supabase, handle);
  if (!data) {
    notFound();
  }

  // Server-compute "today" so SSR and client hydration agree.
  const today = new Date().toISOString().slice(0, 10);

  return <ProfileLive initialData={data} today={today} />;
}
