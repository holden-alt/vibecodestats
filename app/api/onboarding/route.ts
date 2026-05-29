import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';

export const runtime = 'edge';

type Team = 'claude_code' | 'codex';

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  // 1. Authenticate the calling user via SSR client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Resolve their public users row — we need the UUID, not auth_id, for
  //    service-role writes that must target exactly their own row.
  const { data: publicUser } = await supabase
    .from('users')
    .select('id, github_handle')
    .eq('auth_id', user.id)
    .single();

  if (!publicUser) {
    return Response.json({ error: 'user not found' }, { status: 404 });
  }

  // 3. Parse + validate the form body.
  let body: { team?: string; email?: string; email_opt_in?: boolean } | null = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const team = body?.team;
  if (team !== 'claude_code' && team !== 'codex') {
    return Response.json(
      { error: 'team must be claude_code or codex' },
      { status: 400 },
    );
  }

  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  const emailOptIn = body?.email_opt_in === true;

  // 4. Service-role writes — all awaited (no fire-and-forget on CF edge).
  const svc = serviceClient();

  // Write team to users (only this user's own row, keyed by their resolved id).
  const { error: teamErr } = await svc
    .from('users')
    .update({ team: team as Team, team_switched_at: new Date().toISOString() })
    .eq('id', publicUser.id);

  if (teamErr) {
    return Response.json({ error: teamErr.message }, { status: 500 });
  }

  // Write user_private only when opted in with a non-empty email.
  if (emailOptIn && email) {
    const { error: privErr } = await svc
      .from('user_private')
      .upsert(
        {
          user_id: publicUser.id,
          email,
          email_opt_in: true,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' },
      );

    if (privErr) {
      // Non-fatal — team was already set; log but don't abort.
      console.error('user_private upsert failed:', privErr.message);
    }
  }

  // 5. Return the handle so the client can redirect.
  return Response.json({ ok: true, handle: publicUser.github_handle });
}
