import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: 'unauthorized' }, { status: 401 });
  const body = await request.json().catch(() => null) as { private_project_names?: boolean } | null;
  if (!body || typeof body.private_project_names !== 'boolean') {
    return Response.json({ error: 'invalid body' }, { status: 400 });
  }
  const { error } = await supabase
    .from('users')
    .update({ private_project_names: body.private_project_names })
    .eq('auth_id', user.id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
