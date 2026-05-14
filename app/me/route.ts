import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const origin = new URL(request.url).origin;

  if (!user) {
    return new Response(null, { status: 302, headers: { location: `${origin}/` } });
  }

  const { data: row } = await supabase
    .from('users')
    .select('github_handle')
    .eq('id', user.id)
    .single();

  if (!row?.github_handle) {
    return new Response(null, { status: 302, headers: { location: `${origin}/` } });
  }

  return new Response(null, { status: 302, headers: { location: `${origin}/${row.github_handle}` } });
}
