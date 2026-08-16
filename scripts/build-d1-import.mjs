#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const archive = process.argv[2];
const output = process.argv[3];

if (!archive || !output) {
  console.error('usage: node scripts/build-d1-import.mjs ARCHIVE_DIR OUTPUT.sql');
  process.exit(2);
}

const jsonColumns = new Set([
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

const booleanColumns = new Set([
  'llm_hourly.approx',
  'llm_model_daily.approx',
  'llm_project_model_daily.approx',
  'signup_events.is_new_user',
  'user_private.email_opt_in',
  'users.private_project_names',
]);

const tableOrder = [
  'users',
  'daily_stats',
  'machine_daily_stats',
  'groups',
  'group_members',
  'friendships',
  'signup_events',
  'ingest_events',
  'user_private',
  'dim_anchor',
  'user_dim_baseline',
  'user_intraday_share',
  'llm_model_daily',
  'llm_project_model_daily',
  'llm_hourly',
  'repo_ships_daily',
  'session_outcomes',
  'problem_events',
  'system_health_daily',
];

function quoteIdentifier(value) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`unsafe SQL identifier: ${value}`);
  }
  return `"${value}"`;
}

function sqlValue(table, column, value) {
  if (value === null || value === undefined) return 'NULL';
  const key = `${table}.${column}`;
  if (jsonColumns.has(key)) value = JSON.stringify(value);
  if (booleanColumns.has(key)) return value ? '1' : '0';
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new Error(`non-finite number at ${key}`);
    return String(value);
  }
  if (typeof value === 'boolean') return value ? '1' : '0';
  if (typeof value !== 'string') value = JSON.stringify(value);
  return `'${value.replaceAll("'", "''")}'`;
}

const dataDir = path.join(archive, 'data');
const present = new Set((await readdir(dataDir)).filter((name) => name.endsWith('.json')));
const statements = ['PRAGMA foreign_keys = ON;'];
let totalRows = 0;

for (const table of tableOrder) {
  const filename = `${table}.json`;
  if (!present.has(filename)) continue;
  const rows = JSON.parse(await readFile(path.join(dataDir, filename), 'utf8'));
  if (!Array.isArray(rows)) throw new Error(`${filename} is not a JSON array`);
  for (const row of rows) {
    const columns = Object.keys(row);
    const values = columns.map((column) => sqlValue(table, column, row[column]));
    statements.push(
      `INSERT OR REPLACE INTO ${quoteIdentifier(table)} (${columns.map(quoteIdentifier).join(', ')}) VALUES (${values.join(', ')});`,
    );
    totalRows += 1;
  }
}

statements.push('PRAGMA optimize;');
await writeFile(output, `${statements.join('\n')}\n`, { mode: 0o600 });
console.log(`wrote ${totalRows} rows to ${output}`);
