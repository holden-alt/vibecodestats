import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/types/database';
import { canSwitchTeam, SWITCH_COOLDOWN_DAYS } from '@/lib/stats/team-switch';


type Team = 'claude_code' | 'codex';

function serviceClient() {
  return createServiceClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(request: Request) {
  // 1. Authenticate via SSR client.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Resolve the caller's public users row by auth_id (server-resolved — never trust a body id).
  const { data: publicUser } = await supabase
    .from('users')
    .select('id, github_handle, team, team_switched_at')
    .eq('auth_id', user.id)
    .single();

  if (!publicUser) {
    return Response.json({ error: 'user not found' }, { status: 404 });
  }

  // 3. Parse + validate body.
  let body: { team?: string } | null = null;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'invalid JSON' }, { status: 400 });
  }

  const team = body?.team;
  if (team !== 'claude_code' && team !== 'codex') {
    return Response.json({ error: 'team must be claude_code or codex' }, { status: 400 });
  }

  // 4. Same-team no-op → 400 (clear signal; client shouldn't be offering a switch to the same team).
  if (publicUser.team === team) {
    return Response.json({ ok: false, error: 'already on that team' }, { status: 400 });
  }

  // 5. Cooldown guard.
  const now = new Date();
  if (!canSwitchTeam(publicUser.team_switched_at, now)) {
    const msSinceLast = now.getTime() - new Date(publicUser.team_switched_at!).getTime();
    const daysSinceLast = msSinceLast / (24 * 60 * 60 * 1000);
    const daysLeft = Math.ceil(SWITCH_COOLDOWN_DAYS - daysSinceLast);
    return Response.json(
      { ok: false, error: 'switch_cooldown', daysLeft },
      { status: 409 },
    );
  }

  // 6. Perform the switch via service role — keyed on server-resolved id only.
  const svc = serviceClient();
  const { error: updateErr } = await svc
    .from('users')
    .update({ team: team as Team, team_switched_at: now.toISOString() })
    .eq('id', publicUser.id);

  if (updateErr) {
    return Response.json({ error: updateErr.message }, { status: 500 });
  }

  // A fresh switch is always within the defector window.
  return Response.json({ ok: true, team, defector: true });
}
