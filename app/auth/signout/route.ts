import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST(_request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return new Response(null, {
    status: 302,
    headers: { location: '/' },
  });
}
