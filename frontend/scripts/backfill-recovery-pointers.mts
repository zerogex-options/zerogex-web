#!/usr/bin/env node
// Run from the frontend/ directory (nvm 22):
//   node --experimental-strip-types --no-warnings scripts/backfill-recovery-pointers.mts [--yes]
//
// One-shot: stamp users.last_paid_subscription_id / last_paid_invoice_at for
// members whose ORPHAN RECOVERY ran before the recovery paths started doing it
// themselves.
//
// WHY THEY ARE UNSTAMPED. A recovery re-creates the plan with billing anchored
// at the END of the period the recovered invoice already paid for, so the new
// subscription raises NO invoice of its own until the first renewal. Nothing can
// clear on it before then. classifySubscriberBucket reads an `active`
// subscription with no cleared invoice as a charge in flight, so every recovery
// performed before the stamp shipped is parked on the admin Converting line for
// the whole honored period — weeks, in the case that prompted this.
//
// WHAT IT WILL NOT TOUCH. Only rows where a billing_orphan_payment_recovered
// audit row names the subscription the member is on RIGHT NOW. That excludes, by
// construction:
//   * a healthy payer (their pointer is already set);
//   * a member recovered once who has since moved to a different subscription —
//     stamping that would claim their CURRENT subscription is paid for on the
//     strength of an older one;
//   * an ordinary trial genuinely mid-conversion, which has no recovery row at
//     all and belongs on Converting until its charge clears.
//
// The date recorded is the recovery's own audit timestamp — when the entitlement
// was granted locally. It is not the invoice's paid-at, which the audit message
// does not carry; only the pointer's IDENTITY is read for bucketing, the date is
// for whoever reads `make diagnose-user`.
//
// Idempotent: it only writes where the pointer is NULL, so a second run reports
// nothing to do. Read-only without --yes.

import crypto from 'node:crypto';

import { loadEnvLocal } from './env-local.mts';

loadEnvLocal();

const AUDIT_TYPE = 'billing_recovery_pointer_backfilled';
const apply = process.argv.includes('--yes') || process.argv.includes('-y');

const { getDb } = await import('../core/db.ts');
const db = getDb();

// The recovery row must name the subscription the member holds now. LIKE with a
// trailing space is deliberate: the message always continues " on price …", so
// the space prevents sub_abc matching sub_abcdef.
const MATCHES_CURRENT_SUB = `
  EXISTS (
    SELECT 1 FROM audit_events a
     WHERE a.type = 'billing_orphan_payment_recovered'
       AND a.user_id = users.id
       AND a.message LIKE '%recovered as subscription ' || users.stripe_subscription_id || ' %'
  )`;

const RECOVERY_AT = `
  (SELECT MIN(a.created_at) FROM audit_events a
    WHERE a.type = 'billing_orphan_payment_recovered'
      AND a.user_id = users.id
      AND a.message LIKE '%recovered as subscription ' || users.stripe_subscription_id || ' %')`;

const WHERE = `
  WHERE subscription_status = 'active'
    AND stripe_subscription_id IS NOT NULL
    AND last_paid_subscription_id IS NULL
    AND ${MATCHES_CURRENT_SUB}`;

const candidates = db
  .prepare(
    `SELECT id, email, stripe_subscription_id AS sub, ${RECOVERY_AT} AS recovered_at
       FROM users ${WHERE}
      ORDER BY recovered_at ASC`,
  )
  .all() as Array<{ id: string; email: string; sub: string; recovered_at: string | null }>;

if (candidates.length === 0) {
  console.log('Nothing to backfill: no active member is on a recovery subscription with an');
  console.log('unstamped paid-subscription pointer.');
  process.exit(0);
}

console.log(`${candidates.length} member(s) to stamp:`);
for (const c of candidates) {
  console.log(`  ${c.email}  ${c.sub}  recovered ${c.recovered_at ?? '—'}`);
}

if (!apply) {
  console.log('');
  console.log('[dry-run] No writes. Re-run with --yes (Makefile: APPLY=1) to apply.');
  process.exit(0);
}

const stamp = new Date().toISOString();
const update = db.prepare(
  `UPDATE users
      SET last_paid_subscription_id = ?, last_paid_invoice_at = ?, updated_at = ?
    WHERE id = ? AND last_paid_subscription_id IS NULL`,
);
const audit = db.prepare(
  `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
   VALUES (?, ?, ?, NULL, ?, 'manual-script', ?, ?)`,
);

db.exec('BEGIN');
try {
  for (const c of candidates) {
    update.run(c.sub, c.recovered_at ?? stamp, stamp, c.id);
    audit.run(
      `audit_${crypto.randomBytes(12).toString('hex')}`,
      AUDIT_TYPE,
      c.id,
      c.email,
      `Stamped last_paid_subscription_id=${c.sub} (last_paid_invoice_at=${c.recovered_at ?? stamp}) ` +
        'from the orphan-recovery audit row; the recovery predates the stamp being written at ' +
        'recovery time, which had parked this member on the admin Converting line',
      stamp,
    );
  }
  db.exec('COMMIT');
} catch (err) {
  db.exec('ROLLBACK');
  console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
  console.error('Nothing was changed.');
  process.exit(1);
}

console.log('');
console.log(`Stamped ${candidates.length} member(s). They now count as Full Subscribers.`);
