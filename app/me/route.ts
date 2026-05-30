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
    .select('github_handle, team')
    .eq('auth_id', user.id)
    .single();

  if (!row?.github_handle) {
    return new Response(null, { status: 302, headers: { location: `${origin}/` } });
  }

  // New users who haven't picked a team yet go through onboarding first.
  if (!row.team) {
    return new Response(null, { status: 302, headers: { location: `${origin}/onboarding` } });
  }

  return new Response(null, { status: 302, headers: { location: `${origin}/${row.github_handle}` } });
}
