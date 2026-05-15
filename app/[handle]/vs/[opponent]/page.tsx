import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { getHeadToHeadData } from '@/lib/stats/head-to-head-data';
import { HeadToHead } from '@/components/head-to-head/HeadToHead';

export const runtime = 'edge';

type HeadToHeadPageProps = {
  params: Promise<{ handle: string; opponent: string }>;
};

export default async function HeadToHeadPage({ params }: HeadToHeadPageProps) {
  const { handle, opponent } = await params;

  // Self-vs-self has no meaning; reject early without a database round-trip.
  if (handle === opponent) {
    notFound();
  }

  const supabase = await createClient();
  const data = await getHeadToHeadData(supabase, handle, opponent);
  if (!data) {
    notFound();
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <main className="min-h-screen px-6 py-4 max-w-[900px] mx-auto">
      <h1
        className="text-[0.7rem] uppercase tracking-[0.14em] font-semibold mb-3"
        style={{ color: 'var(--color-yellow)' }}
      >
        · head to head
      </h1>
      <HeadToHead data={data} today={today} />
    </main>
  );
}
