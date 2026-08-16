import { describe, expect, it, vi } from 'vitest';
import { DatabaseClient } from '@/lib/db/client';
import type { D1Database, D1PreparedStatement, D1Result } from '@/lib/db/cloudflare';

function recordingDatabase() {
  const queries: string[] = [];

  const db: D1Database = {
    prepare(query: string): D1PreparedStatement {
      queries.push(query);
      const statement: D1PreparedStatement = {
        bind: vi.fn(() => statement),
        all: vi.fn(async () => ({ results: [], success: true })),
        first: vi.fn(async () => null),
        run: vi.fn(async (): Promise<D1Result> => ({ results: [], success: true })),
      };
      return statement;
    },
    batch: vi.fn(async () => []),
  };

  return { db, queries };
}

describe('D1 query adapter', () => {
  it('does not invent an updated_at column for daily_stats upserts', async () => {
    const { db, queries } = recordingDatabase();
    const database = new DatabaseClient(db);

    const result = await database.from('daily_stats').upsert(
      {
        user_id: 'user-1',
        date: '2026-08-16',
        tokens_total: 10,
        source_synced_at: '2026-08-16T04:30:00.000Z',
      },
      { onConflict: 'user_id,date' },
    );

    expect(result.error).toBeNull();
    expect(queries).toHaveLength(1);
    expect(queries[0]).toContain('"source_synced_at"');
    expect(queries[0]).not.toContain('"updated_at"');
  });
});
