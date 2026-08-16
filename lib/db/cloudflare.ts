import { getCloudflareContext } from '@opennextjs/cloudflare';

export type D1Value = string | number | null | ArrayBuffer;

export interface D1Result<Row = Record<string, unknown>> {
  results: Row[];
  success: boolean;
  meta?: Record<string, unknown>;
}

export interface D1PreparedStatement {
  bind(...values: D1Value[]): D1PreparedStatement;
  all<Row = Record<string, unknown>>(): Promise<D1Result<Row>>;
  first<Row = Record<string, unknown>>(): Promise<Row | null>;
  run(): Promise<D1Result>;
}

export interface D1Database {
  prepare(query: string): D1PreparedStatement;
  batch<Row = Record<string, unknown>>(
    statements: D1PreparedStatement[],
  ): Promise<D1Result<Row>[]>;
}

export interface R2ObjectBody {
  body: ReadableStream;
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
}

export interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | Blob | ReadableStream | string,
    options?: { httpMetadata?: { contentType?: string; cacheControl?: string } },
  ): Promise<unknown>;
}

export type AppBindings = {
  DB: D1Database;
  OG_IMAGES: R2Bucket;
  GITHUB_CLIENT_ID: string;
  GITHUB_OAUTH_CLIENT_SECRET: string;
  CC_INTERNAL_TOKEN: string;
};

export async function getBindings(): Promise<AppBindings> {
  const { env } = await getCloudflareContext({ async: true });
  return env as unknown as AppBindings;
}
