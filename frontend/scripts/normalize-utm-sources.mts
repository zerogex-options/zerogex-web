#!/usr/bin/env node
// Run from the frontend/ directory (or via `make normalize-utm-sources`):
//   node --experimental-strip-types scripts/normalize-utm-sources.mts
//
// Rewrites stored acquisition sources so they match what core/utils.ts
// sanitizeUtmSource() produces TODAY.
//
// WHY THIS EXISTS. The sanitizer runs on every write, so new rows are always
// correct — but rows already in the table keep whatever spelling was current
// when they landed. The decline-by-source report surfaced the cost: `x` and
// `twitter` sitting as two separate channels with 3 and 10 first-payment
// charges, where the one real channel has 13 and is still too thin to read a
// rate from. A channel split across two keys is worse than an untagged one,
// because volume is the only thing that makes a per-source rate readable.
//
// It is DERIVED, not hardcoded: it asks the sanitizer what each stored value
// should be and fixes the ones that disagree. So it also repairs any legacy
// value that predates the charset pass, and it stays correct when
// UTM_SOURCE_ALIASES grows — RE-RUN IT whenever that map changes.
//
// Idempotent: a second run finds nothing to do.
//
// IT NEVER: touches Stripe, sends an email, changes a tier, or alters anything
// but the two acquisition-source columns below.
//
// Flags / environment:
//   AUTH_DB_PATH   which SQLite file to write (same rule as the app)
//   YES=1          apply. WITHOUT IT THIS IS A DRY RUN and writes nothing.

import { loadEnvLocal } from './env-local.mts';

loadEnvLocal();

const { getDb } = await import('../core/db.ts');
const { sanitizeUtmSource, UTM_SOURCE_ALIASES } = await import('../core/utils.ts');

const apply = process.env.YES === '1';
const db = getDb();

/** The two places an acquisition source is stored. */
const TARGETS = [
  { table: 'users', column: 'signup_utm_source', unit: 'member' },
  { table: 'page_view_events', column: 'utm_source', unit: 'page view' },
] as const;

console.log('');
console.log('NORMALIZE STORED ACQUISITION SOURCES');
console.log(`  aliases in force: ${Object.entries(UTM_SOURCE_ALIASES).map(([from, to]) => `${from} → ${to}`).join(', ') || '(none)'}`);
console.log(`  mode: ${apply ? 'APPLY' : 'DRY RUN (nothing will be written — pass YES=1 to apply)'}`);
console.log('');

let totalRows = 0;
let totalChanges = 0;

for (const target of TARGETS) {
  let rows: Array<{ value: string; n: number }> = [];
  try {
    rows = db
      .prepare(
        `SELECT ${target.column} AS value, COUNT(*) AS n
           FROM ${target.table}
          WHERE ${target.column} IS NOT NULL AND ${target.column} != ''
          GROUP BY ${target.column}`,
      )
      .all() as Array<{ value: string; n: number }>;
  } catch {
    console.log(`  ${target.table}.${target.column}: table or column absent — skipped.`);
    continue;
  }

  // Ask the sanitizer what each stored value should be, rather than matching the
  // alias map here. That is what makes this repair legacy spellings too.
  const changes = rows
    .map((row) => ({ from: row.value, to: sanitizeUtmSource(row.value), n: Number(row.n) || 0 }))
    .filter((change) => change.to !== null && change.to !== change.from);

  if (changes.length === 0) {
    console.log(`  ${target.table}.${target.column}: already normalized (${rows.length} distinct value${rows.length === 1 ? '' : 's'}).`);
    continue;
  }

  for (const change of changes) {
    console.log(
      `  ${target.table}.${target.column}: ${change.from} → ${change.to}   (${change.n} ${target.unit}${change.n === 1 ? '' : 's'})`,
    );
    totalRows += change.n;
    totalChanges += 1;
    if (!apply) continue;
    const result = db
      .prepare(`UPDATE ${target.table} SET ${target.column} = ? WHERE ${target.column} = ?`)
      .run(change.to, change.from) as { changes: number | bigint };
    console.log(`      updated ${Number(result.changes)} row${Number(result.changes) === 1 ? '' : 's'}`);
  }
}

console.log('');
if (totalChanges === 0) {
  console.log('  Nothing to do — every stored source already matches the sanitizer.');
} else if (apply) {
  console.log(`  Done. ${totalChanges} value${totalChanges === 1 ? '' : 's'} rewritten across ${totalRows} row${totalRows === 1 ? '' : 's'}.`);
  console.log('  Re-run `make decline-by-source` to see the merged channels.');
} else {
  console.log(`  DRY RUN — nothing was written. ${totalChanges} value${totalChanges === 1 ? '' : 's'} would change across ${totalRows} row${totalRows === 1 ? '' : 's'}.`);
  console.log('  Re-run with YES=1 to apply.');
}
console.log('');
