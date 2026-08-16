import { cookies } from 'next/headers';
import { GithubAuth } from '@/lib/auth/github';
import { DatabaseClient } from '@/lib/db/client';
import { getBindings } from '@/lib/db/cloudflare';

export class AppClient extends DatabaseClient {
  constructor(
    db: ConstructorParameters<typeof DatabaseClient>[0],
    readonly auth: GithubAuth,
  ) {
    super(db);
  }
}

export async function createClient(): Promise<AppClient> {
  const [cookieStore, bindings] = await Promise.all([cookies(), getBindings()]);
  const auth = new GithubAuth(
    bindings.DB,
    cookieStore,
    bindings.GITHUB_CLIENT_ID,
    bindings.GITHUB_OAUTH_CLIENT_SECRET,
  );
  return new AppClient(bindings.DB, auth);
}

export async function createServiceClient(): Promise<DatabaseClient> {
  const bindings = await getBindings();
  return new DatabaseClient(bindings.DB);
}
