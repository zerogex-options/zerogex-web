import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

// Point the auth DB at a throwaway file and enable the program BEFORE importing
// core/db.ts (transitively via core/ambassadorLedger.ts): core/db.ts captures
// AUTH_DB_PATH into a module-level const at load time, so a static import would
// be hoisted above these assignments. Dynamic import guarantees ordering.
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zgx-amb-'));
process.env.AUTH_DB_PATH = path.join(tmpDir, 'auth.db');
process.env.AMBASSADOR_PROGRAM_ENABLED = '1';
delete process.env.AMBASSADOR_ATTRIBUTION_DISABLED;
delete process.env.AMBASSADOR_REVIEW_THRESHOLD_CENTS; // use the $200 default
process.env.NEXT_PUBLIC_APP_URL = 'https://zerogex.test';

const ledger = await import('../core/ambassadorLedger.ts');
const { getDb } = await import('../core/db.ts');

test.after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));

let userSeq = 0;
function nowMinusDays(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}
function nowMinusMonths(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  return d.toISOString();
}

// Insert a bare user row. Only the NOT NULL columns are required; everything
// else defaults via the schema.
function mkUser(fields: Record<string, string | number | null>): string {
  const id = (fields.id as string) ?? `user_${++userSeq}`;
  const now = new Date().toISOString();
  const row: Record<string, string | number | null> = {
    id,
    email: (fields.email as string) ?? `${id}@example.com`,
    tier: (fields.tier as string) ?? 'public',
    created_at: now,
    updated_at: now,
    ...fields,
  };
  const cols = Object.keys(row);
  getDb()
    .prepare(`INSERT INTO users (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
    .run(...cols.map((c) => row[c]));
  return id;
}

// A minimal Stripe.Invoice-shaped object for accrual (types are stripped at
// runtime, so a plain object suffices).
function mkInvoice(id: string, customer: string, amountPaid: number, currency = 'usd'): any {
  return {
    id,
    customer,
    amount_paid: amountPaid,
    currency,
    status_transitions: { paid_at: Math.floor(Date.now() / 1000) },
  };
}

// Create an ACTIVE ambassador and return { id, code }.
function makeActiveAmbassador(
  opts: { rewardPreference?: 'cash' | 'account_credit'; email?: string } = {},
): { id: string; code: string } {
  const id = mkUser({ email: opts.email ?? `amb_${++userSeq}@example.com`, tier: 'pro' });
  ledger.inviteAmbassador({ userId: id, actorUserId: 'admin_1' });
  ledger.acceptAmbassadorInvitation({ userId: id, rewardPreference: opts.rewardPreference ?? 'cash' });
  const row = ledger.getAmbassadorRow(id)!;
  return { id, code: row.referral_code! };
}

test.beforeEach(() => {
  const db = getDb();
  db.exec('DELETE FROM partner_commissions;');
  db.exec('DELETE FROM referrals;');
  db.exec('DELETE FROM partner_link_visits;');
  db.exec('DELETE FROM audit_events;');
  db.exec('DELETE FROM users;');
});

test('inviting an existing user creates an invited profile with default terms + a unique code', () => {
  const a = mkUser({ tier: 'pro' });
  const b = mkUser({ tier: 'pro' });
  const rowA = ledger.inviteAmbassador({ userId: a, actorUserId: 'admin_1', designation: 'Founding Ambassador' });
  const rowB = ledger.inviteAmbassador({ userId: b, actorUserId: 'admin_1' });

  assert.equal(rowA.partner_tier, 'ambassador');
  assert.equal(rowA.partner_status, 'invited');
  assert.equal(rowA.partner_designation, 'Founding Ambassador');
  assert.equal(rowA.partner_commission_bps, 2000);
  assert.equal(rowA.partner_credit_bps, 2500);
  assert.equal(rowA.partner_commission_window_months, 12);
  assert.equal(rowA.partner_holding_period_days, 30);
  assert.ok(rowA.referral_code && rowA.referral_code.length === 8);
  // Pilot window stamped (default 90 days).
  assert.ok(rowA.partner_pilot_started_at && rowA.partner_pilot_ends_at);
  // Unique codes.
  assert.notEqual(rowA.referral_code, rowB.referral_code);
});

test('admins and creator affiliates cannot be invited as ambassadors', () => {
  const admin = mkUser({ tier: 'admin' });
  assert.throws(() => ledger.inviteAmbassador({ userId: admin, actorUserId: 'admin_1' }));
  const creator = mkUser({ tier: 'pro', partner_tier: 'creator', partner_status: 'active' });
  assert.throws(() => ledger.inviteAmbassador({ userId: creator, actorUserId: 'admin_1' }));
});

test('accepting an invitation activates the ambassador and records the accepted terms version', () => {
  const id = mkUser({ tier: 'pro' });
  ledger.inviteAmbassador({ userId: id, actorUserId: 'admin_1' });
  const row = ledger.acceptAmbassadorInvitation({ userId: id, rewardPreference: 'account_credit', termsVersion: 'v1' });
  assert.equal(row.partner_status, 'active');
  assert.equal(row.partner_reward_preference, 'account_credit');
  assert.equal(row.partner_terms_version, 'v1');
  assert.ok(row.partner_accepted_at);
  assert.ok(row.partner_activated_at);
  // You cannot accept twice from active.
  const again = ledger.acceptAmbassadorInvitation({ userId: id, rewardPreference: 'cash' });
  assert.equal(again.partner_status, 'active'); // idempotent no-op
  assert.equal(again.partner_reward_preference, 'account_credit'); // unchanged
});

test('valid attribution within 60 days is recorded; expired attribution is not', () => {
  const { id: ambId, code } = makeActiveAmbassador();
  const within = mkUser({});
  const expired = mkUser({});

  assert.deepEqual(ledger.recordAmbassadorReferral(within, code, nowMinusDays(45)), { recorded: true });
  assert.equal(ledger.recordAmbassadorReferral(expired, code, nowMinusDays(70)).recorded, false);

  const db = getDb();
  const inRow = db.prepare('SELECT referred_by_code FROM users WHERE id = ?').get(within) as any;
  assert.equal(inRow.referred_by_code, code);
  const exRow = db.prepare('SELECT referred_by_code FROM users WHERE id = ?').get(expired) as any;
  assert.equal(exRow.referred_by_code, null);
  const refRow = db.prepare('SELECT partner_type FROM referrals WHERE referee_user_id = ?').get(within) as any;
  assert.equal(refRow.partner_type, 'ambassador');
  assert.equal(ledger.getReferralFunnel(ambId).registrations, 1);
});

test('self-referral is prevented', () => {
  const { id, code } = makeActiveAmbassador();
  assert.equal(ledger.recordAmbassadorReferral(id, code, null).recorded, false);
});

test('a paused/inactive ambassador does not attract new attribution', () => {
  const { id, code } = makeActiveAmbassador();
  ledger.setAmbassadorStatus(id, 'paused', 'admin_1');
  const r = mkUser({});
  assert.equal(ledger.recordAmbassadorReferral(r, code, null).recorded, false);
});

test('successful monthly payment accrues a 20% cash commission with a 30-day hold', () => {
  const { code } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_m1' });
  ledger.recordAmbassadorReferral(referee, code, null);

  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_m1', 'cus_m1', 3900));
  assert.equal(out.kind, 'accrued');
  if (out.kind === 'accrued') {
    assert.equal(out.rewardMinor, 780);
    assert.equal(out.rewardType, 'cash');
    assert.equal(out.isFirstForReferee, true);
  }
  const row = getDb().prepare("SELECT * FROM partner_commissions WHERE stripe_invoice_id='in_m1'").get() as any;
  assert.equal(row.status, 'pending');
  assert.equal(row.commission_amount, 780);
  assert.equal(row.reward_type, 'cash');
  assert.ok(row.hold_release_at);
  // hold release ~30 days out
  const holdMs = new Date(row.hold_release_at).getTime() - Date.now();
  assert.ok(holdMs > 28 * 864e5 && holdMs < 32 * 864e5);
});

test('successful annual payment accrues 20% of the collected annual amount', () => {
  const { code } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_y1' });
  ledger.recordAmbassadorReferral(referee, code, null);
  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_y1', 'cus_y1', 29900));
  assert.equal(out.kind === 'accrued' && out.rewardMinor, 5980);
});

test('duplicate Stripe webhook delivery does not double-accrue', () => {
  const { code } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_d1' });
  ledger.recordAmbassadorReferral(referee, code, null);
  const first = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_d1', 'cus_d1', 3900));
  const second = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_d1', 'cus_d1', 3900));
  assert.equal(first.kind, 'accrued');
  assert.equal(second.kind, 'duplicate');
  const count = getDb().prepare("SELECT COUNT(*) c FROM partner_commissions WHERE stripe_invoice_id='in_d1'").get() as any;
  assert.equal(count.c, 1);
});

test('trials / failed payments (zero collected) accrue nothing', () => {
  const { code } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_z1' });
  ledger.recordAmbassadorReferral(referee, code, null);
  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_z1', 'cus_z1', 0));
  assert.equal(out.kind === 'none' && out.reason, 'zero_amount');
});

test('an ambassador earns nothing on their own subscription', () => {
  const { id, code } = makeActiveAmbassador({ email: 'self@example.com' });
  // Make the ambassador their own (impossible) referee: same user, own customer.
  getDb().prepare('UPDATE users SET stripe_customer_id = ?, referred_by_code = ? WHERE id = ?').run('cus_self', code, id);
  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_self', 'cus_self', 3900));
  assert.equal(out.kind === 'none' && out.reason, 'self_referral');
});

test('account-credit ambassadors accrue at 25% and preference change is PROSPECTIVE', () => {
  const { id, code } = makeActiveAmbassador({ rewardPreference: 'cash' });
  const referee = mkUser({ stripe_customer_id: 'cus_p1' });
  ledger.recordAmbassadorReferral(referee, code, null);

  // First invoice under CASH preference -> 20%.
  ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_p1', 'cus_p1', 3900));
  // Switch to account credit; a NEW invoice accrues at 25% while the old row is
  // untouched (prospective).
  ledger.setRewardPreference(id, 'account_credit');
  ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_p2', 'cus_p1', 3900));

  const db = getDb();
  const cash = db.prepare("SELECT * FROM partner_commissions WHERE stripe_invoice_id='in_p1'").get() as any;
  const credit = db.prepare("SELECT * FROM partner_commissions WHERE stripe_invoice_id='in_p2'").get() as any;
  assert.equal(cash.reward_type, 'cash');
  assert.equal(cash.commission_amount, 780); // unchanged 20%
  assert.equal(credit.reward_type, 'account_credit');
  assert.equal(credit.commission_amount, 975); // 25%
});

test('commission expires after the 12-month duration window', () => {
  const { id, code } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_w1' });
  ledger.recordAmbassadorReferral(referee, code, null);
  // Seed a first accrual 13 months ago for this (ambassador, referee) pair.
  getDb()
    .prepare(
      `INSERT INTO partner_commissions
        (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount,
         commission_amount, currency, status, partner_type, reward_type, created_at, updated_at)
       VALUES ('pc_old', ?, ?, 'in_old', 3900, 780, 'usd', 'paid', 'ambassador', 'cash', ?, ?)`,
    )
    .run(id, referee, nowMinusMonths(13), nowMinusMonths(13));
  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_w2', 'cus_w1', 3900));
  assert.equal(out.kind === 'none' && out.reason, 'window_expired');
});

test('holding-period release moves due cash pending -> payable, future holds stay pending', () => {
  const { id } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_h1' });
  const db = getDb();
  // Due (hold elapsed) + future (hold not elapsed).
  db.prepare(
    `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, hold_release_at, created_at, updated_at)
     VALUES ('pc_due', ?, ?, 'in_due', 3900, 780, 'usd', 'pending', 'ambassador', 'cash', ?, ?, ?)`,
  ).run(id, referee, nowMinusDays(1), nowMinusDays(31), nowMinusDays(31));
  db.prepare(
    `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, hold_release_at, created_at, updated_at)
     VALUES ('pc_future', ?, ?, 'in_future', 3900, 780, 'usd', 'pending', 'ambassador', 'cash', ?, ?, ?)`,
  ).run(id, referee, new Date(Date.now() + 5 * 864e5).toISOString(), new Date().toISOString(), new Date().toISOString());

  const res = ledger.releaseDueCash();
  assert.equal(res.cashReleased, 1);
  assert.equal((db.prepare("SELECT status FROM partner_commissions WHERE id='pc_due'").get() as any).status, 'payable');
  assert.equal((db.prepare("SELECT status FROM partner_commissions WHERE id='pc_future'").get() as any).status, 'pending');
});

test('large commissions are held for admin review instead of auto-releasing', () => {
  const { id } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_big' });
  // $300 reward is above the $200 default review threshold.
  getDb()
    .prepare(
      `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, hold_release_at, created_at, updated_at)
       VALUES ('pc_big', ?, ?, 'in_big', 150000, 30000, 'usd', 'pending', 'ambassador', 'cash', ?, ?, ?)`,
    )
    .run(id, referee, nowMinusDays(1), nowMinusDays(31), nowMinusDays(31));
  const res = ledger.releaseDueCash();
  assert.equal(res.cashReleased, 0);
  assert.equal(res.heldForReview, 1);
  assert.equal((getDb().prepare("SELECT status FROM partner_commissions WHERE id='pc_big'").get() as any).status, 'pending');
});

test('idempotent credit claim: only one writer claims a pending credit row', () => {
  const { id } = makeActiveAmbassador({ rewardPreference: 'account_credit' });
  getDb().prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run('cus_credit', id);
  const referee = mkUser({ stripe_customer_id: 'cus_ref_credit' });
  getDb()
    .prepare(
      `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, hold_release_at, created_at, updated_at)
       VALUES ('pc_credit', ?, ?, 'in_credit', 3900, 975, 'usd', 'pending', 'ambassador', 'account_credit', ?, ?, ?)`,
    )
    .run(id, referee, nowMinusDays(1), nowMinusDays(31), nowMinusDays(31));
  const first = ledger.claimCreditRelease('pc_credit');
  const second = ledger.claimCreditRelease('pc_credit');
  assert.ok(first && first.amountMinor === 975 && first.customerId === 'cus_credit');
  assert.equal(second, null); // already claimed
  assert.equal((getDb().prepare("SELECT status FROM partner_commissions WHERE id='pc_credit'").get() as any).status, 'credited');
});

test('full refund reverses the whole commission; partial refund reverses proportionally', () => {
  const { id } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_r' });
  const db = getDb();
  const seed = (invId: string, amt: number) =>
    db
      .prepare(
        `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, created_at, updated_at)
         VALUES (?, ?, ?, ?, 3900, ?, 'usd', 'pending', 'ambassador', 'cash', ?, ?)`,
      )
      .run(`pc_${invId}`, id, referee, invId, amt, new Date().toISOString(), new Date().toISOString());

  seed('in_full', 780);
  const full = ledger.reverseAmbassadorLedgerForInvoice('in_full', { reason: 'refund (full)' });
  assert.equal(full.affected, 1);
  assert.equal((db.prepare("SELECT status FROM partner_commissions WHERE stripe_invoice_id='in_full'").get() as any).status, 'reversed');

  seed('in_partial', 780);
  const partial = ledger.reverseAmbassadorLedgerForInvoice('in_partial', { refundedMinor: 1950, chargedMinor: 3900, reason: 'refund (partial)' });
  assert.equal(partial.affected, 1);
  const row = db.prepare("SELECT * FROM partner_commissions WHERE stripe_invoice_id='in_partial'").get() as any;
  assert.equal(row.commission_amount, 390); // half reversed
  assert.equal(row.excluded_amount, 390);
  assert.equal(row.status, 'pending'); // remainder still owed
});

test('chargeback fully reverses and marks the commission disputed', () => {
  const { id } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_dp' });
  getDb()
    .prepare(
      `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, created_at, updated_at)
       VALUES ('pc_dp', ?, ?, 'in_dp', 3900, 780, 'usd', 'payable', 'ambassador', 'cash', ?, ?)`,
    )
    .run(id, referee, new Date().toISOString(), new Date().toISOString());
  const res = ledger.reverseAmbassadorLedgerForInvoice('in_dp', { reason: 'dispute', disputed: true });
  assert.equal(res.affected, 1);
  assert.equal((getDb().prepare("SELECT status FROM partner_commissions WHERE stripe_invoice_id='in_dp'").get() as any).status, 'disputed');
});

test('reversing a CREDITED reward inserts a compensating negative row + returns a clawback', () => {
  const { id } = makeActiveAmbassador({ rewardPreference: 'account_credit' });
  getDb().prepare('UPDATE users SET stripe_customer_id = ? WHERE id = ?').run('cus_cb', id);
  const referee = mkUser({ stripe_customer_id: 'cus_ref_cb' });
  getDb()
    .prepare(
      `INSERT INTO partner_commissions (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount, commission_amount, currency, status, partner_type, reward_type, credited_at, created_at, updated_at)
       VALUES ('pc_cb', ?, ?, 'in_cb', 3900, 975, 'usd', 'credited', 'ambassador', 'account_credit', ?, ?, ?)`,
    )
    .run(id, referee, new Date().toISOString(), new Date().toISOString(), new Date().toISOString());
  const res = ledger.reverseAmbassadorLedgerForInvoice('in_cb', { reason: 'refund (full)' });
  assert.equal(res.affected, 1);
  assert.equal(res.clawbacks.length, 1);
  assert.equal(res.clawbacks[0].amountMinor, 975);
  assert.equal(res.clawbacks[0].customerId, 'cus_cb');
  // Original credited row preserved; a negative compensating row added.
  const neg = getDb().prepare("SELECT * FROM partner_commissions WHERE stripe_invoice_id='in_cb::rev'").get() as any;
  assert.equal(neg.commission_amount, -975);
  assert.equal(neg.status, 'reversed');
  // Idempotent: a redelivered refund does not double-compensate.
  const again = ledger.reverseAmbassadorLedgerForInvoice('in_cb', { reason: 'refund (full)' });
  assert.equal(again.affected, 0);
});

test('deactivation stops new attribution and new accrual but preserves earned rewards', () => {
  const { id, code } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_de' });
  ledger.recordAmbassadorReferral(referee, code, null);
  ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_de1', 'cus_de', 3900)); // earned while active

  ledger.setAmbassadorStatus(id, 'inactive', 'admin_1');
  const row = ledger.getAmbassadorRow(id)!;
  assert.equal(row.partner_status, 'inactive');
  assert.ok(row.partner_deactivated_at);

  // No new accrual once inactive.
  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_de2', 'cus_de', 3900));
  assert.equal(out.kind === 'none' && out.reason, 'referrer_not_active_ambassador');
  // The previously earned reward is untouched.
  const earned = getDb().prepare("SELECT status FROM partner_commissions WHERE stripe_invoice_id='in_de1'").get() as any;
  assert.equal(earned.status, 'pending');
});

test('pilot expiry flips active ambassadors past their end date to inactive', () => {
  const { id } = makeActiveAmbassador();
  getDb().prepare('UPDATE users SET partner_pilot_ends_at = ? WHERE id = ?').run(nowMinusDays(1), id);
  const flipped = ledger.expirePilots();
  assert.equal(flipped.length, 1);
  assert.equal(ledger.getAmbassadorRow(id)!.partner_status, 'inactive');
});

test('CSV export produces a header + one row per ambassador commission', () => {
  const { id } = makeActiveAmbassador();
  const referee = mkUser({ stripe_customer_id: 'cus_csv', email: 'buyer@example.com' });
  ledger.recordAmbassadorReferral(referee, ledger.getAmbassadorRow(id)!.referral_code!, null);
  ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_csv', 'cus_csv', 3900));
  const csv = ledger.exportCommissionsCsv();
  const lines = csv.split('\n');
  assert.ok(lines[0].startsWith('commission_id,ambassador_email,referee_email,stripe_invoice_id'));
  assert.equal(lines.length, 2);
  assert.ok(lines[1].includes('in_csv'));
  assert.ok(lines[1].includes('buyer@example.com'));
});

test('ambassador logic never touches creator rows (creator program preserved)', () => {
  // A creator referrer must not be resolved by the ambassador finder, and their
  // referee invoices must not accrue an ambassador commission.
  const creator = mkUser({ tier: 'pro', partner_tier: 'creator', partner_status: 'active', referral_code: 'CREATORXX' });
  assert.equal(ledger.findAmbassadorByReferralCode('CREATORXX'), null);
  const referee = mkUser({ stripe_customer_id: 'cus_cr', referred_by_code: 'CREATORXX' });
  const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_cr', 'cus_cr', 3900));
  assert.equal(out.kind === 'none' && out.reason, 'referrer_not_active_ambassador');
  // And no ambassador row was written.
  assert.equal((getDb().prepare("SELECT COUNT(*) c FROM partner_commissions WHERE stripe_invoice_id='in_cr'").get() as any).c, 0);
  void creator;
  void referee;
});

test('authorization guards: non-ambassadors expose no profile; admins/creators are unlisted for invites', () => {
  // getAmbassadorRow(null) is the guard the self-service POST route relies on to
  // reject a non-ambassador — it must return null for a plain user.
  const plain = mkUser({ email: 'plain@example.com' });
  assert.equal(ledger.getAmbassadorRow(plain), null);
  assert.equal(ledger.getAmbassadorDashboardData(plain), null);

  // User search for invites must never surface admins or soft-deleted accounts.
  mkUser({ email: 'searchme@example.com', tier: 'pro' });
  mkUser({ email: 'searchadmin@example.com', tier: 'admin' });
  mkUser({ email: 'searchdeleted@example.com', tier: 'pro', deleted_at: new Date().toISOString() });
  const results = ledger.searchUsersForInvite('search');
  const emails = results.map((r) => r.email);
  assert.ok(emails.includes('searchme@example.com'));
  assert.ok(!emails.includes('searchadmin@example.com'));
  assert.ok(!emails.includes('searchdeleted@example.com'));
});

test('pausing new attribution stops new signups but preserves accrual on existing referees', () => {
  const { id, code } = makeActiveAmbassador();
  const existing = mkUser({ stripe_customer_id: 'cus_pause' });
  ledger.recordAmbassadorReferral(existing, code, null); // attributed while enabled

  process.env.AMBASSADOR_ATTRIBUTION_DISABLED = '1';
  try {
    // A NEW signup is not attributed while paused.
    const fresh = mkUser({});
    assert.equal(ledger.recordAmbassadorReferral(fresh, code, null).reason, 'attribution_disabled');
    // But an ALREADY-attributed referee still accrues on their invoice.
    const out = ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_pause', 'cus_pause', 3900));
    assert.equal(out.kind, 'accrued');
  } finally {
    delete process.env.AMBASSADOR_ATTRIBUTION_DISABLED;
  }
  void id;
});

test('program analytics + funnel are computed from ambassador rows only', () => {
  const { id, code } = makeActiveAmbassador();
  const paying = mkUser({ stripe_customer_id: 'cus_an', subscription_status: 'active' });
  ledger.recordAmbassadorReferral(paying, code, null);
  ledger.recordAmbassadorVisit(code);
  ledger.recordAmbassadorVisit(code);
  ledger.maybeAccrueAmbassadorCommission(mkInvoice('in_an', 'cus_an', 3900));

  const analytics = ledger.getProgramAnalytics();
  assert.equal(analytics.ambassadors.total, 1);
  assert.equal(analytics.ambassadors.active, 1);
  assert.equal(analytics.funnel.registrations, 1);
  assert.equal(analytics.funnel.payingCustomers, 1);
  assert.equal(analytics.funnel.visits, 2);
  assert.equal(analytics.money.pendingCashMinor, 780);
  assert.ok(analytics.conversion.registrationToPaid === 1);
  void id;
});
