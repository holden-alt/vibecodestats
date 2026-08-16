import { getBindings } from '@/lib/db/cloudflare';

export async function GET(
  _request: Request,
  context: { params: Promise<{ filename: string }> },
): Promise<Response> {
  const { filename } = await context.params;
  if (!/^(?:_root|[A-Za-z0-9-]{1,80})\.png$/.test(filename)) {
    return new Response('not found', { status: 404 });
  }
  const { OG_IMAGES } = await getBindings();
  const object = await OG_IMAGES.get(filename);
  if (!object) return new Response('not found', { status: 404 });

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=3600, s-maxage=3600');
  return new Response(object.body, { headers });
}
