import { createClient } from '@/lib/supabase/server';

export const runtime = 'edge';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ signed_in: false });
  }

  return Response.json({
    signed_in: true,
    auth_id: user.id,
    github_handle:
      user.user_metadata?.user_name ||
      user.user_metadata?.preferred_username ||
      null,
    email: user.email ?? null,
    last_sign_in_at: user.last_sign_in_at ?? null,
  });
}
