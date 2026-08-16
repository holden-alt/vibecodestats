import { getBindings, type AppBindings } from '@/lib/db/cloudflare';

function equalSecret(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

export async function authorizeInternal(
  request: Request,
): Promise<{ ok: true; bindings: AppBindings } | { ok: false; response: Response }> {
  const bindings = await getBindings();
  const authorization = request.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ') ? authorization.slice(7).trim() : '';
  if (!bindings.CC_INTERNAL_TOKEN || !equalSecret(token, bindings.CC_INTERNAL_TOKEN)) {
    return {
      ok: false,
      response: Response.json({ error: 'unauthorized' }, { status: 401 }),
    };
  }
  return { ok: true, bindings };
}
