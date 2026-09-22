import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// The accounts that must never appear in a growth number — the operator's admin
// login, a creator partner on a comped Pro grant, and a comped member — and the
// proof that holding them out actually reaches the derived daily rollup rather
// than only the cohort report. A regression here does not throw; it quietly
// publishes an inflated funnel, which is the whole reason this file exists.

const dbPath = path.join(
  fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-excluded-')),
  'auth.db',
);
process.env.AUTH_DB_PATH = dbPath;

// core/db.ts reads AUTH_DB_PATH at module load, so the assignment has to land
// before the import does.
const { getDb } = await import('../core/db.ts');
const { classifyExclusion, summarizeExcluded } = await import('../core/excludedAccounts.ts');
const { loadExcludedAccounts, excludedAccountIds } = await import('../core/excludedAccountsServer.ts');
const { getDailyMetricRows, rebuildDailyMetrics } = await import('../core/dailyMetrics.ts');

const db = getDb();
const DAY_MS = 86_400_000;
const now = Date.now();

const ET_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/New_York',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const dayOf = (daysAgo: number) => ET_DAY.format(new Date(now - daysAgo * DAY_MS));
/** Hours 12–20 UTC are inside the same ET day under either DST offset. */
const isoDaysAgo = (daysAgo: number, hourUtc = 16) =>
  `${dayOf(daysAgo)}T${String(hourUtc).padStart(2, '0')}:30:00.000Z`;

let auditSeq = 0;
function audit(type: string, iso: string, message: string, userId: string | null): void {
  db.prepare(
    `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
     VALUES (?, ?, ?, NULL, NULL, NULL, ?, ?)`,
  ).run(`audit_${auditSeq++}`, type, userId, message, iso);
}

function seedUser(id: string, iso: string, columns: Record<string, string | number | null> = {}): void {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, tier, created_at, updated_at)
     VALUES (?, ?, 'x', ?, ?, ?)`,
  ).run(id, `${id}@example.test`, String(columns.tier ?? 'public'), iso, iso);
  for (const [column, value] of Object.entries(columns)) {
    if (column === 'tier') continue;
    db.prepare(`UPDATE users SET ${column} = ? WHERE id = ?`).run(value, id);
  }
}

function seedVisit(visitId: string, iso: string, userId: string | null): void {
  db.prepare(
    `INSERT INTO page_view_events (visit_id, path, user_id, tier, duration_ms, created_at)
     VALUES (?, '/dashboard', ?, 'public', 0, ?)`,
  ).run(visitId, userId, iso);
}

// ---------------------------------------------------------------------------
// Fixture: one of each kind of held-out account plus one real customer, all
// registering, trialing and browsing on the same day so a leak shows up as a
// count that is too high rather than as a missing row.
// ---------------------------------------------------------------------------

seedUser('admin', isoDaysAgo(5), { tier: 'admin' });
seedUser('partner', isoDaysAgo(5, 17), {
  tier: 'pro',
  partner_tier: 'creator',
  partner_pro_grant_expires_at: new Date(now + 30 * DAY_MS).toISOString(),
});
seedUser('comped', isoDaysAgo(5, 18), { tier: 'pro', first_payment_at: isoDaysAgo(200) });
seedUser('customer', isoDaysAgo(5, 19), { tier: 'pro', first_payment_at: isoDaysAgo(4) });
// A partner whose grant was revoked (both columns cleared) is a customer again.
seedUser('exPartner', isoDaysAgo(5, 20), { tier: 'public' });

audit('billing_member_comped', isoDaysAgo(190), 'Comped onto pro', 'comped');

// Every account starts a subscription on the same day.
for (const id of ['admin', 'partner', 'comped', 'customer', 'exPartner']) {
  audit(
    'stripe_subscription_sync',
    isoDaysAgo(4),
    `Subscription sub_${id} status=trialing tier=pro cancelAtPeriodEnd=false`,
    id,
  );
}

// …and every account cancels on the same day.
for (const id of ['admin', 'partner', 'comped', 'customer', 'exPartner']) {
  audit('stripe_cancellation_requested', isoDaysAgo(3), `Cancellation requested for sub_${id}`, id);
}

// …and every account browses on the same day.
seedVisit('v_admin', isoDaysAgo(2), 'admin');
seedVisit('v_partner', isoDaysAgo(2, 17), 'partner');
seedVisit('v_comped', isoDaysAgo(2, 18), 'comped');
seedVisit('v_customer', isoDaysAgo(2, 19), 'customer');
seedVisit('v_expartner', isoDaysAgo(2, 20), 'exPartner');
seedVisit('v_anon', isoDaysAgo(2, 15), null);

rebuildDailyMetrics();

const rows = new Map(getDailyMetricRows({ days: 30 }).map((row) => [row.day, row]));

// ---------------------------------------------------------------------------

test('each rule is reported under its own name, and precedence is stable', () => {
  const accounts = loadExcludedAccounts();
  assert.deepEqual(
    accounts.map((account) => [account.id, account.reason]).sort(),
    [['admin', 'admin'], ['comped', 'comped'], ['partner', 'partner_grant']],
    'the real customer and the ex-partner are not held out',
  );

  // An admin who also carries a grant is reported once, as the admin.
  assert.equal(
    classifyExclusion({ tier: 'admin', partner_tier: 'creator', partner_pro_grant_expires_at: null, comped: 1 }),
    'admin',
  );
  assert.equal(
    classifyExclusion({ tier: 'pro', partner_tier: null, partner_pro_grant_expires_at: null, comped: 0 }),
    null,
    'a paid tier on its own is a customer',
  );
});

test('a comped member who used to pay is held out, and says so', () => {
  const summary = summarizeExcluded(loadExcludedAccounts());
  assert.equal(summary.total, 3);
  assert.deepEqual(summary.byReason, { admin: 1, partner_grant: 1, comped: 1 });
  assert.equal(summary.everPaid, 1, 'the comped member had paid before the comp');
});

test('held-out accounts reach none of the derived daily columns', () => {
  assert.equal(rows.get(dayOf(5))?.registrations, 2, 'only the customer and the ex-partner registered');
  assert.equal(rows.get(dayOf(4))?.trialStarts, 2, 'a partner grant is not a trial start');
  assert.equal(rows.get(dayOf(3))?.cancels, 2, 'the admin cancelling is not churn');
});

test('the operator browsing their own dashboard is not daily traffic', () => {
  const row = rows.get(dayOf(2));
  assert.equal(row?.uniqueUsers, 2, 'customer + ex-partner; admin, partner and comped are held out');
  assert.equal(row?.pageviews, 3, 'their two views plus the anonymous one');
});

test('a held-out account cannot drag the axis back before the first customer', () => {
  // The comped member carries the oldest audit row in the fixture (day -190) and
  // the admin is usually the oldest `users` row in production. If either reached
  // earliestSourceDay(), the rollup would open months early and fill the gap with
  // zeros that mean "nobody but me was here yet".
  const all = getDailyMetricRows({ days: 400 });
  assert.equal(all[0].day, dayOf(5), 'the axis starts at the first real customer, not the comp');
  assert.equal(all.length, 6, 'six days from the first customer through today');
});

test('the id set is exactly the accounts the loader reports', () => {
  assert.deepEqual([...excludedAccountIds()].sort(), ['admin', 'comped', 'partner']);
});
