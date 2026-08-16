import type { D1Database, D1PreparedStatement, D1Value } from './cloudflare';

export type DatabaseError = { message: string };

// Query data intentionally stays dynamic: this small adapter mirrors the fluent
// subset the application used before D1, while the durable row types remain in
// lib/types/database.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type QueryResult = { data: any; error: DatabaseError | null };

type Filter = {
  column: string;
  operator: '=' | '>=' | '<=' | 'IN' | 'IS NOT';
  value: unknown;
};

type Mutation =
  | { kind: 'insert'; values: Record<string, unknown> | Record<string, unknown>[] }
  | { kind: 'update'; values: Record<string, unknown> }
  | {
      kind: 'upsert';
      values: Record<string, unknown> | Record<string, unknown>[];
      conflict: string[];
    };

const JSON_COLUMNS = new Set([
  'daily_stats.tokens_by_model',
  'daily_stats.machines',
  'daily_stats.projects_touched',
  'daily_stats.ships',
  'daily_stats.hourly_tokens',
  'daily_stats.vbw_components',
  'machine_daily_stats.tokens_by_model',
  'machine_daily_stats.projects_touched',
  'machine_daily_stats.ships',
  'machine_daily_stats.hourly_tokens',
  'machine_daily_stats.vbw_components',
  'session_outcomes.friction_notes',
  'session_outcomes.problems',
  'signup_events.metadata',
  'users.secondary_personas',
]);

const BOOLEAN_COLUMNS = new Set([
  'llm_hourly.approx',
  'llm_model_daily.approx',
  'llm_project_model_daily.approx',
  'signup_events.is_new_user',
  'user_private.email_opt_in',
  'users.private_project_names',
]);

const UUID_DEFAULT_TABLES = new Set(['groups', 'signup_events']);
const UPDATED_AT_TABLES = new Set([
  'dim_anchor',
  'llm_hourly',
  'llm_model_daily',
  'llm_project_model_daily',
  'machine_daily_stats',
  'problem_events',
  'repo_ships_daily',
  'session_outcomes',
  'system_health_daily',
  'user_dim_baseline',
  'user_intraday_share',
  'user_private',
  'users',
]);

function identifier(value: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`unsafe database identifier: ${value}`);
  }
  return `"${value}"`;
}

function normalizeColumns(columns: string): string {
  return columns.replace(/\s+/g, ' ').trim();
}

function serialize(table: string, column: string, value: unknown): D1Value {
  if (value == null) return null;
  const key = `${table}.${column}`;
  if (JSON_COLUMNS.has(key)) return JSON.stringify(value);
  if (BOOLEAN_COLUMNS.has(key)) return value ? 1 : 0;
  if (typeof value === 'string' || typeof value === 'number') return value;
  if (typeof value === 'boolean') return value ? 1 : 0;
  if (value instanceof ArrayBuffer) return value;
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength).slice().buffer;
  }
  return JSON.stringify(value);
}

function parseRow(table: string, source: Record<string, unknown>): Record<string, unknown> {
  const row = { ...source };
  for (const [column, value] of Object.entries(row)) {
    const key = `${table}.${column}`;
    if ((JSON_COLUMNS.has(key) || column === 'users') && typeof value === 'string') {
      try {
        row[column] = JSON.parse(value);
      } catch {
        // Preserve malformed legacy text instead of turning a read into a 500.
      }
    } else if (BOOLEAN_COLUMNS.has(key) && value != null) {
      row[column] = value === 1 || value === true;
    }
  }
  return row;
}

function errorResult(error: unknown): QueryResult {
  return {
    data: null,
    error: { message: error instanceof Error ? error.message : String(error) },
  };
}

export class DatabaseClient {
  constructor(readonly db: D1Database) {}

  from(table: string): QueryBuilder {
    return new QueryBuilder(this.db, table);
  }
}

export class QueryBuilder implements PromiseLike<QueryResult> {
  private columns = '*';
  private filters: Filter[] = [];
  private orderBy: { column: string; ascending: boolean } | null = null;
  private rowLimit: number | null = null;
  private mutation: Mutation | null = null;
  private singleMode: 'none' | 'single' | 'maybe' = 'none';

  constructor(
    private readonly db: D1Database,
    private readonly table: string,
  ) {
    identifier(table);
  }

  select(columns = '*'): this {
    this.columns = columns;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, operator: '=', value });
    return this;
  }

  gte(column: string, value: unknown): this {
    this.filters.push({ column, operator: '>=', value });
    return this;
  }

  lte(column: string, value: unknown): this {
    this.filters.push({ column, operator: '<=', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.filters.push({ column, operator: 'IN', value: values });
    return this;
  }

  not(column: string, operator: 'is', value: null): this {
    if (operator !== 'is' || value !== null) {
      throw new Error('D1 adapter only supports not(column, "is", null)');
    }
    this.filters.push({ column, operator: 'IS NOT', value: null });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    this.orderBy = { column, ascending: options?.ascending !== false };
    return this;
  }

  limit(value: number): this {
    this.rowLimit = Math.max(0, Math.floor(value));
    return this;
  }

  insert(values: Record<string, unknown> | Record<string, unknown>[]): this {
    this.mutation = { kind: 'insert', values };
    return this;
  }

  update(values: Record<string, unknown>): this {
    this.mutation = { kind: 'update', values };
    return this;
  }

  upsert(
    values: Record<string, unknown> | Record<string, unknown>[],
    options: { onConflict: string },
  ): this {
    this.mutation = {
      kind: 'upsert',
      values,
      conflict: options.onConflict.split(',').map((value) => value.trim()),
    };
    return this;
  }

  async single(): Promise<QueryResult> {
    this.singleMode = 'single';
    return this.execute();
  }

  async maybeSingle(): Promise<QueryResult> {
    this.singleMode = 'maybe';
    return this.execute();
  }

  then<TResult1 = QueryResult, TResult2 = never>(
    onfulfilled?: ((value: QueryResult) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }

  private whereClause(alias?: string): { sql: string; values: D1Value[] } {
    if (this.filters.length === 0) return { sql: '', values: [] };
    const values: D1Value[] = [];
    const parts = this.filters.map((filter) => {
      const column = `${alias ? `${alias}.` : ''}${identifier(filter.column)}`;
      if (filter.operator === 'IS NOT') return `${column} IS NOT NULL`;
      if (filter.operator === 'IN') {
        const items = Array.isArray(filter.value) ? filter.value : [];
        if (items.length === 0) return '0 = 1';
        values.push(...items.map((item) => serialize(this.table, filter.column, item)));
        return `${column} IN (${items.map(() => '?').join(', ')})`;
      }
      values.push(serialize(this.table, filter.column, filter.value));
      return `${column} ${filter.operator} ?`;
    });
    return { sql: ` WHERE ${parts.join(' AND ')}`, values };
  }

  private selectSql(): { sql: string; values: D1Value[] } {
    const normalized = normalizeColumns(this.columns);
    const userJoin = /users:user_id\s*\(github_handle\)/.test(normalized);
    const alias = userJoin ? 'd' : undefined;
    let columnsSql: string;

    if (userJoin) {
      const baseColumns = normalized
        .replace(/,?\s*users:user_id\s*\(github_handle\)\s*,?/, ',')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => `d.${identifier(value)}`);
      columnsSql = `${baseColumns.join(', ')}, json_object('github_handle', u.github_handle) AS users`;
    } else if (normalized === '*') {
      columnsSql = '*';
    } else {
      columnsSql = normalized
        .split(',')
        .map((value) => identifier(value.trim()))
        .join(', ');
    }

    const from = userJoin
      ? `${identifier(this.table)} d LEFT JOIN users u ON u.id = d.user_id`
      : identifier(this.table);
    const where = this.whereClause(alias);
    const order = this.orderBy
      ? ` ORDER BY ${alias ? `${alias}.` : ''}${identifier(this.orderBy.column)} ${this.orderBy.ascending ? 'ASC' : 'DESC'}`
      : '';
    const limit = this.rowLimit == null ? '' : ` LIMIT ${this.rowLimit}`;
    return { sql: `SELECT ${columnsSql} FROM ${from}${where.sql}${order}${limit}`, values: where.values };
  }

  private preparedInsert(
    row: Record<string, unknown>,
    conflict?: string[],
  ): D1PreparedStatement {
    const values = { ...row };
    if (UUID_DEFAULT_TABLES.has(this.table) && values.id == null) {
      values.id = crypto.randomUUID();
    }
    const columns = Object.keys(values);
    if (columns.length === 0) throw new Error('cannot insert an empty row');
    const bound = columns.map((column) => serialize(this.table, column, values[column]));
    let sql = `INSERT INTO ${identifier(this.table)} (${columns.map(identifier).join(', ')}) VALUES (${columns.map(() => '?').join(', ')})`;
    if (conflict) {
      const conflictSet = new Set(conflict);
      const setters = columns
        .filter((column) => !conflictSet.has(column))
        .map((column) => `${identifier(column)} = excluded.${identifier(column)}`);
      if (UPDATED_AT_TABLES.has(this.table) && !columns.includes('updated_at')) {
        setters.push(`"updated_at" = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`);
      }
      sql += ` ON CONFLICT (${conflict.map(identifier).join(', ')}) ${setters.length > 0 ? `DO UPDATE SET ${setters.join(', ')}` : 'DO NOTHING'}`;
    }
    return this.db.prepare(sql).bind(...bound);
  }

  private async executeMutation(): Promise<QueryResult> {
    if (!this.mutation) throw new Error('missing mutation');
    if (this.mutation.kind === 'update') {
      const values = { ...this.mutation.values };
      if (UPDATED_AT_TABLES.has(this.table) && values.updated_at == null) {
        values.updated_at = new Date().toISOString();
      }
      const columns = Object.keys(values);
      const where = this.whereClause();
      const sql = `UPDATE ${identifier(this.table)} SET ${columns.map((column) => `${identifier(column)} = ?`).join(', ')}${where.sql}`;
      const bound = columns.map((column) => serialize(this.table, column, values[column]));
      await this.db.prepare(sql).bind(...bound, ...where.values).run();
      return { data: null, error: null };
    }

    const rows = Array.isArray(this.mutation.values)
      ? this.mutation.values
      : [this.mutation.values];
    const conflict = this.mutation.kind === 'upsert' ? this.mutation.conflict : undefined;
    const statements = rows.map((row) => this.preparedInsert(row, conflict));
    if (statements.length === 1) await statements[0]!.run();
    else {
      for (let index = 0; index < statements.length; index += 100) {
        await this.db.batch(statements.slice(index, index + 100));
      }
    }
    return { data: null, error: null };
  }

  private async execute(): Promise<QueryResult> {
    try {
      if (this.mutation) return await this.executeMutation();
      const query = this.selectSql();
      const result = await this.db.prepare(query.sql).bind(...query.values).all();
      const rows = result.results.map((row) => parseRow(this.table, row));
      if (this.singleMode !== 'none') {
        if (this.singleMode === 'single' && rows.length !== 1) {
          return { data: null, error: { message: `expected one row, received ${rows.length}` } };
        }
        return { data: rows[0] ?? null, error: null };
      }
      return { data: rows, error: null };
    } catch (error) {
      return errorResult(error);
    }
  }
}
