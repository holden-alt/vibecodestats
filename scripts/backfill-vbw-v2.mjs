#!/usr/bin/env node
// scripts/backfill-vbw-v2.mjs
//
// One-shot: re-score every row in public.daily_stats using the VBW v2 formula
// (sigmoid + weighted-additive + diversity + soft penalty + smaller streak).
// Inputs are the raw columns already on the row; nothing reads outside Supabase.
//
// Usage (from repo root):
//   NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/backfill-vbw-v2.mjs

import { createClient } from '@supabase/supabase-js';

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error('missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const sb = createClient(URL, KEY, { auth: { persistSession: false } });

// === VBW v2 (mirrors lib/stats/vbw.ts) ====================================

const DEFAULT_ANCHORS = {
  output:    { anchor: 6.0, k: 1.2 },
  substance: { anchor: 7.0, k: 1.5 },
  tools:     { anchor: 3.0, k: 1.5 },
  ships:     { anchor: 1.7, k: 1.5 },
  depth:     { anchor: 2.5, k: 1.3 },
};

const WEIGHTS = { output: 0.20, substance: 0.20, tools: 0.15, ships: 0.25, depth: 0.20 };

const LOW_THRESHOLD = 20;
const PENALTY_PER_LOW = 0.94;
const DIVERSITY_MIN = 0.5;
const DIVERSITY_MAX = 1.1;
const STREAK_STEP = 0.005;
const STREAK_MAX_BONUS = 0.05;
const FINAL_SCALE = 100;
const VBW_HARD_CAP = 10000;

const clamp = (lo, hi, n) => (n < lo ? lo : n > hi ? hi : n);
const sigmoid = (raw, { anchor, k }) => {
  if (!(raw > 0)) return 0;
  const input = Math.log10(raw + 1);
  return 100 / (1 + Math.exp(-k * (input - anchor)));
};

function computeVbw(inputs, streakDays, anchors = DEFAULT_ANCHORS) {
  const c = {
    output:    sigmoid(inputs.output_tokens          ?? 0, anchors.output),
    substance: sigmoid(inputs.cache_creation_tokens  ?? 0, anchors.substance),
    tools:     sigmoid(inputs.tool_calls             ?? 0, anchors.tools),
    ships:     sigmoid(inputs.ship_quality           ?? 0, anchors.ships),
    depth:     sigmoid(inputs.deep_work_minutes      ?? 0, anchors.depth),
  };
  const scores = [c.output, c.substance, c.tools, c.ships, c.depth];
  const base =
    WEIGHTS.output    * c.output    +
    WEIGHTS.substance * c.substance +
    WEIGHTS.tools     * c.tools     +
    WEIGHTS.ships     * c.ships     +
    WEIGHTS.depth     * c.depth;
  const shifted = scores.map((s) => s + 1);
  const am = shifted.reduce((a, b) => a + b, 0) / shifted.length;
  const gm = Math.exp(shifted.reduce((a, b) => a + Math.log(b), 0) / shifted.length);
  const diversity = clamp(DIVERSITY_MIN, DIVERSITY_MAX, am > 0 ? Math.sqrt(gm / am) : 1);
  const lowCount = scores.filter((s) => s < LOW_THRESHOLD).length;
  const penalty = Math.pow(PENALTY_PER_LOW, lowCount);
  const safeStreak = Number.isFinite(streakDays) && streakDays > 0 ? streakDays : 0;
  const persistence = 1 + Math.min(STREAK_MAX_BONUS, safeStreak * STREAK_STEP);
  const total = clamp(0, VBW_HARD_CAP, Math.round(base * diversity * penalty * persistence * FINAL_SCALE));
  return { total, base, persistence, diversity, penalty, components: c };
}

// === Main =================================================================

async function main() {
  console.log('backfill-vbw-v2: loading anchors…');
  const { data: anchorRows, error: anchorErr } = await sb.from('dim_anchor').select('dim, anchor, k');
  if (anchorErr) throw anchorErr;
  const anchors = { ...DEFAULT_ANCHORS };
  for (const r of anchorRows ?? []) {
    if (r.dim in anchors) anchors[r.dim] = { anchor: r.anchor, k: r.k };
  }
  console.log('  anchors:', JSON.stringify(anchors));

  console.log('backfill-vbw-v2: loading all daily_stats…');
  const { data: rows, error: rowsErr } = await sb
    .from('daily_stats')
    .select('user_id, date, tokens_total, output_tokens, cache_creation_tokens, tool_calls, ship_quality, deep_work_minutes, vbw_total')
    .order('user_id', { ascending: true })
    .order('date', { ascending: true });
  if (rowsErr) throw rowsErr;
  console.log(`  loaded ${rows.length} rows`);

  // Group by user and compute streaks in order
  const byUser = new Map();
  for (const row of rows) {
    if (!byUser.has(row.user_id)) byUser.set(row.user_id, []);
    byUser.get(row.user_id).push(row);
  }

  const updates = [];
  for (const [, userRows] of byUser) {
    userRows.sort((a, b) => a.date.localeCompare(b.date));
    let streak = 0;
    let prevDate = null;
    for (const row of userRows) {
      const date = row.date;
      const tokens = row.tokens_total ?? 0;
      const prevPlusOne = prevDate
        ? new Date(Date.parse(prevDate + 'T00:00:00Z') + 86400_000).toISOString().slice(0, 10)
        : null;
      if (tokens <= 0) {
        streak = 0;
      } else if (prevDate === null || prevPlusOne !== date) {
        // first day, or gap — restart
        streak = 1;
      } else {
        streak += 1;
      }
      prevDate = date;

      const result = computeVbw(
        {
          output_tokens: row.output_tokens ?? 0,
          cache_creation_tokens: row.cache_creation_tokens ?? 0,
          tool_calls: row.tool_calls ?? 0,
          ship_quality: row.ship_quality ?? 0,
          deep_work_minutes: row.deep_work_minutes ?? 0,
        },
        Math.max(0, streak - 1),  // streakBefore = consecutive days BEFORE this one
        anchors,
      );
      updates.push({
        user_id: row.user_id,
        date: row.date,
        old_vbw: row.vbw_total ?? 0,
        new_vbw: result.total,
        components: result.components,
      });
    }
  }

  console.log(`backfill-vbw-v2: prepared ${updates.length} updates`);
  console.log('sample (first 20):');
  for (const u of updates.slice(0, 20)) {
    console.log(`  ${u.date} ${u.user_id.slice(0, 8)}…  old=${u.old_vbw}  new=${u.new_vbw}`);
  }

  // Write in batches of 50
  console.log('backfill-vbw-v2: writing updates…');
  let written = 0;
  for (const u of updates) {
    const { error } = await sb
      .from('daily_stats')
      .update({ vbw_total: u.new_vbw, vbw_components: u.components })
      .eq('user_id', u.user_id)
      .eq('date', u.date);
    if (error) {
      console.error(`  failed ${u.date} ${u.user_id}: ${error.message}`);
    } else {
      written++;
    }
  }
  console.log(`backfill-vbw-v2: done — wrote ${written}/${updates.length}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
