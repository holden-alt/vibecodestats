#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const previousArchive = process.argv[2];
const finalArchive = process.argv[3];
const output = process.argv[4];

if (!previousArchive || !finalArchive || !output) {
  console.error(
    'usage: node scripts/build-d1-event-delta.mjs PREVIOUS_ARCHIVE FINAL_ARCHIVE OUTPUT.sql',
  );
  process.exit(2);
}

const previous = JSON.parse(
  await readFile(path.join(previousArchive, 'data', 'ingest_events.json'), 'utf8'),
);
const final = JSON.parse(
  await readFile(path.join(finalArchive, 'data', 'ingest_events.json'), 'utf8'),
);

if (!Array.isArray(previous) || !Array.isArray(final)) {
  throw new Error('ingest_events.json must contain an array');
}

const previousIds = new Set(previous.map((row) => row.id));
const additions = final.filter((row) => !previousIds.has(row.id));
const columns = [
  'created_at',
  'user_id',
  'github_handle',
  'machine',
  'outcome',
  'detail',
  'user_agent',
  'payload_date',
  'tokens_total',
];

function sqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replaceAll("'", "''")}'`;
}

// D1 began accepting new events before the final Supabase export completed,
// so integer IDs can overlap. Let D1 allocate new IDs while preserving every
// append-only event body from the final source delta.
const statements = additions.map((row) => {
  const values = columns.map((column) => sqlValue(row[column]));
  return `INSERT INTO ingest_events (${columns.join(', ')}) VALUES (${values.join(', ')});`;
});

await writeFile(output, `${statements.join('\n')}\n`, { mode: 0o600 });
console.log(`wrote ${additions.length} append-only ingest events to ${output}`);
