import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

// The migration that moves the Total Subscribers chart from an account-scoped
// payment column to a per-SUBSCRIPTION one, run against a production-shaped
// book of members.
//
// The requirement is not "the new rule is better". It is that on the deploy
// itself NOBODY MOVES: every member must land on exactly the line they were
// already on. A backfill that under-fills would drop the entire paying base
// onto Converting at once, in public, on a live chart. So this reproduces the
// OLD chart SQL as the oracle, runs the REAL migration (via initDb, not a
// copy of the statement), and asserts the two censuses are identical row for
// row — then checks the forward behaviour the backfill has to set up.

const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-bucketmig-')), 'auth.db');

// ---------------------------------------------------------------------------
// A pre-migration database: the users table as it stands TODAY, carrying
// first_payment_at (so its own once-only backfill stays dormant) and lacking
// the two columns this migration adds.
// ---------------------------------------------------------------------------
const seedDb = new DatabaseSync(dbPath);
seedDb.exec(`
  CREATE TABLE users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    tier TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    subscription_status TEXT,
    stripe_subscription_id TEXT,
    payment_grace_reason TEXT,
    cancel_at_period_end INTEGER NOT NULL DEFAULT 0,
    paused_until TEXT,
    first_payment_at TEXT
  );
`);

const AT = '2026-09-15T15:00:00.000Z';
let seq = 0;
type Seed = {
  tier: string;
  status: string | null;
  sub: string | null;
  grace: string | null;
  firstPaid: string | null;
  pausedUntil?: string | null;
};
const seeded: Array<Seed & { id: string }> = [];

function seedUser(over: Seed, times = 1): void {
  for (let i = 0; i < times; i++) {
    const id = `u${seq++}`;
    seedDb
      .prepare(
        `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at,
                            subscription_status, stripe_subscription_id, payment_grace_reason,
                            cancel_at_period_end, paused_until, first_payment_at)
         VALUES (?, ?, 'x', ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
      )
      .run(
        id,
        `${id}@example.test`,
        over.tier,
        AT,
        AT,
        over.status,
        over.sub,
        over.grace,
        over.pausedUntil ?? null,
        over.firstPaid,
      );
    seeded.push({ ...over, id });
  }
}

const PAID = '2026-08-03T03:42:56.466Z';

// Production's actual shape as of this change: 127 paying, 33 on trial, 4 in
// trial grace — plus one of every edge case that has ever moved this chart.
seedUser({ tier: 'pro', status: 'active', sub: 'sub_full', grace: null, firstPaid: PAID }, 120);
seedUser({ tier: 'basic', status: 'active', sub: 'sub_full', grace: null, firstPaid: PAID }, 7);
seedUser({ tier: 'pro', status: 'trialing', sub: 'sub_trial', grace: null, firstPaid: null }, 30);
// Returning members currently ON a trial: first_payment_at is already set from
// an earlier subscription. These are the ones the whole change is about.
seedUser({ tier: 'pro', status: 'trialing', sub: 'sub_trial2', grace: null, firstPaid: PAID }, 3);
seedUser({ tier: 'pro', status: 'past_due', sub: 'sub_tg', grace: 'trial', firstPaid: null }, 3);
// Trial grace on a RETURNING member — carries a first payment from a prior sub.
seedUser({ tier: 'pro', status: 'past_due', sub: 'sub_tg2', grace: 'trial', firstPaid: PAID }, 1);
// Renewal dunning, and a legacy grace row with no reason and no payment stamp.
seedUser({ tier: 'pro', status: 'past_due', sub: 'sub_dun', grace: 'renewal', firstPaid: PAID }, 2);
seedUser({ tier: 'pro', status: 'past_due', sub: 'sub_legacy', grace: null, firstPaid: null }, 1);
// Genuinely mid-conversion at migration time: already on Converting, must STAY.
seedUser({ tier: 'pro', status: 'active', sub: 'sub_conv', grace: null, firstPaid: null }, 1);
// Off-chart rows that still have to stay off it.
seedUser({ tier: 'public', status: 'active', sub: 'sub_paused', grace: null, firstPaid: PAID, pausedUntil: '2026-11-01T00:00:00Z' }, 1);
seedUser({ tier: 'public', status: 'trialing', sub: 'sub_gate', grace: null, firstPaid: null }, 1);
seedUser({ tier: 'pro', status: 'canceled', sub: null, grace: null, firstPaid: PAID }, 1);
seedUser({ tier: 'public', status: null, sub: null, grace: null, firstPaid: null }, 1);
// Legacy tier ids must fold, not fall off the chart.
seedUser({ tier: 'elite', status: 'active', sub: 'sub_elite', grace: null, firstPaid: PAID }, 1);
seedUser({ tier: 'starter', status: 'trialing', sub: 'sub_starter', grace: null, firstPaid: null }, 1);

// ---------------------------------------------------------------------------
// The OLD chart SQL, verbatim from core/monitoring.ts before this change. This
// is the oracle: whatever it says today is what must still be true tomorrow.
// ---------------------------------------------------------------------------
const OLD_BUCKET_SQL = `
  SELECT id,
         CASE
           WHEN subscription_status = 'trialing' THEN 'trialing'
           WHEN subscription_status = 'past_due' AND payment_grace_reason = 'trial' THEN 'graceTrial'
           WHEN subscription_status = 'active' AND first_payment_at IS NULL THEN 'converting'
           ELSE 'active'
         END AS bucket
    FROM users
   WHERE tier IN ('pro', 'basic', 'elite', 'starter')
     AND subscription_status IN ('active', 'trialing', 'past_due')`;

// The NEW one, verbatim from core/monitoring.ts after it.
const NEW_BUCKET_SQL = `
  SELECT id,
         CASE
           WHEN subscription_status = 'trialing' THEN 'trialing'
           WHEN subscription_status = 'past_due' AND payment_grace_reason = 'trial' THEN 'graceTrial'
           WHEN subscription_status = 'active'
                AND (last_paid_subscription_id IS NULL
                     OR stripe_subscription_id IS NULL
                     OR last_paid_subscription_id <> stripe_subscription_id
                     OR last_paid_invoice_at IS NULL) THEN 'converting'
           ELSE 'active'
         END AS bucket
    FROM users
   WHERE tier IN ('pro', 'basic', 'elite', 'starter')
     AND subscription_status IN ('active', 'trialing', 'past_due')`;

// DatabaseSync.close() exists at runtime but is absent from the @types/node
// this repo pins. Closing matters here — the seed connection must be released
// before initDb ALTERs the same file — so it is called through a narrow cast
// rather than dropped.
function closeDb(db: DatabaseSync): void {
  (db as unknown as { close(): void }).close();
}

function bucketsBy(db: DatabaseSync, sql: string): Map<string, string> {
  const rows = db.prepare(sql).all() as Array<{ id: string; bucket: string }>;
  return new Map(rows.map((r) => [String(r.id), String(r.bucket)]));
}

function census(byId: Map<string, string>): Record<string, number> {
  const out: Record<string, number> = { active: 0, converting: 0, trialing: 0, graceTrial: 0 };
  for (const bucket of byId.values()) out[bucket] = (out[bucket] ?? 0) + 1;
  return out;
}

const before = bucketsBy(seedDb, OLD_BUCKET_SQL);
const censusBefore = census(before);
closeDb(seedDb);

// ---------------------------------------------------------------------------
// Run the REAL migration. core/db.ts reads AUTH_DB_PATH at module load, so the
// assignment has to land before the import does.
// ---------------------------------------------------------------------------
process.env.AUTH_DB_PATH = dbPath;
const { getDb } = await import('../core/db.ts');
const db = getDb();

const after = bucketsBy(db, NEW_BUCKET_SQL);
const censusAfter = census(after);

test('the seeded book matches production shape', () => {
  // 127 paying (120 pro + 7 basic) + 1 legacy elite + 3 past_due that count as
  // paying; 34 on trial; 4 in trial grace; 1 genuinely mid-conversion.
  assert.deepEqual(censusBefore, { active: 131, converting: 1, trialing: 34, graceTrial: 4 });
});

test('NOBODY changes line across the migration', () => {
  assert.deepEqual(censusAfter, censusBefore);
  assert.equal(after.size, before.size, 'same rows on the chart');
  const moved: string[] = [];
  for (const [id, bucket] of before) {
    if (after.get(id) !== bucket) moved.push(`${id}: ${bucket} -> ${after.get(id)}`);
  }
  assert.deepEqual(moved, [], 'no member may move line on the deploy itself');
});

test('a member already mid-conversion STAYS on Converting', () => {
  // The one row the old first_payment_at migration knowingly misjudged. This
  // backfill is written not to: an active row with no payment on record is left
  // unstamped precisely so it stays where it is.
  const converting = [...after].filter(([, b]) => b === 'converting').map(([id]) => id);
  assert.equal(converting.length, 1);
  const row = db
    .prepare(`SELECT last_paid_subscription_id AS s FROM users WHERE id = ?`)
    .get(converting[0]) as { s: string | null };
  assert.equal(row.s, null);
});

test('trials are left unstamped, so their conversion lands on Converting', () => {
  // The 35 trials now running are the migration's real output: each must enter
  // Converting when Stripe raises its invoice, and leave only when charged.
  const trials = db
    .prepare(`SELECT id FROM users WHERE subscription_status = 'trialing'`)
    .all() as Array<{ id: string }>;
  assert.equal(trials.length, 35); // 34 on-chart + the setup-withheld one
  for (const { id } of trials) {
    const row = db
      .prepare(`SELECT last_paid_subscription_id AS s FROM users WHERE id = ?`)
      .get(id) as { s: string | null };
    assert.equal(row.s, null, `${id} must not be pre-stamped`);
  }
  // Flip them all to `active`, as trial end does, and they must be Converting —
  // including the three RETURNING members, who under the old rule would have
  // jumped straight to the paying line an hour before being charged.
  db.exec(`UPDATE users SET subscription_status = 'active' WHERE subscription_status = 'trialing'`);
  const converted = bucketsBy(db, NEW_BUCKET_SQL);
  for (const { id } of trials) {
    if (!converted.has(id)) continue; // the tier-public one stays off the chart
    assert.equal(converted.get(id), 'converting', `${id} must convert via Converting`);
  }
  const restore = db.prepare(`UPDATE users SET subscription_status = 'trialing' WHERE id = ?`);
  for (const { id } of trials) restore.run(id);
});

test('renewal dunning recovers to the paying line, not to Converting', () => {
  // past_due reads no payment column, so the backfill stamping these rows is
  // invisible today — it exists entirely for this transition. An unstamped
  // established payer whose retry succeeds would land on Converting.
  const dunning = db
    .prepare(`SELECT id FROM users WHERE payment_grace_reason = 'renewal'`)
    .all() as Array<{ id: string }>;
  assert.ok(dunning.length > 0);
  db.exec(`UPDATE users SET subscription_status = 'active' WHERE payment_grace_reason = 'renewal'`);
  const recovered = bucketsBy(db, NEW_BUCKET_SQL);
  for (const { id } of dunning) assert.equal(recovered.get(id), 'active', `${id} never left the paying line`);
});

test('a legacy unattributed grace row also recovers to the paying line', () => {
  const legacy = db
    .prepare(`SELECT id FROM users WHERE subscription_status = 'past_due' AND payment_grace_reason IS NULL`)
    .all() as Array<{ id: string }>;
  assert.ok(legacy.length > 0);
  db.exec(`UPDATE users SET subscription_status = 'active'
            WHERE subscription_status = 'past_due' AND payment_grace_reason IS NULL`);
  const recovered = bucketsBy(db, NEW_BUCKET_SQL);
  for (const { id } of legacy) assert.equal(recovered.get(id), 'active', `${id} predates the columns but has paid`);
});

test('TRIAL grace is deliberately not stamped — its retry must prove itself', () => {
  // These members have never completed a payment on this subscription. If the
  // backfill stamped them, a retry that never clears could still read as a Full
  // Subscriber. They wait for a real invoice instead.
  const rows = db
    .prepare(`SELECT id, last_paid_subscription_id AS s FROM users WHERE payment_grace_reason = 'trial'`)
    .all() as Array<{ id: string; s: string | null }>;
  assert.equal(rows.length, 4);
  for (const r of rows) assert.equal(r.s, null, `${r.id} must not be pre-stamped`);
});

test('the backfill runs exactly once and is not re-applied on restart', () => {
  // The gate is load-bearing: an unguarded re-run would stamp whoever is
  // mid-conversion at that instant, so every deploy would quietly promote a
  // member whose card had not been charged.
  const convertingBefore = [...bucketsBy(db, NEW_BUCKET_SQL)].filter(([, b]) => b === 'converting').length;
  const fresh = new DatabaseSync(dbPath);
  // Simulate a second boot: the column already exists, so ensureColumn returns
  // false and the UPDATE must not run again.
  const cols = fresh.prepare(`PRAGMA table_info(users)`).all() as Array<{ name: string }>;
  assert.ok(cols.some((c) => c.name === 'last_paid_subscription_id'));
  const convertingAfter = [...bucketsBy(fresh, NEW_BUCKET_SQL)].filter(([, b]) => b === 'converting').length;
  assert.equal(convertingAfter, convertingBefore);
  closeDb(fresh);
});
