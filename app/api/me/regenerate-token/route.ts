import { createClient } from '@/lib/db/server';


export async function POST() {
  const database = await createClient();
  const {
    data: { user },
  } = await database.auth.getUser();

  if (!user) {
    return Response.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Generate a 48-char hex token (two random UUIDs, dashes stripped).
  const newToken =
    crypto.randomUUID().replace(/-/g, '') +
    crypto.randomUUID().replace(/-/g, '');

  const { error } = await database
    .from('users')
    .update({ ingest_token: newToken })
    .eq('auth_id', user.id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true });
}
