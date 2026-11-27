import test from 'node:test';
import assert from 'node:assert/strict';
import { auditCount, createBusyDb, sqlite3Missing, type Fixture } from './support/busyDb.ts';

// scripts/backfill-courtesy-refunds.mts, run for real against a copy of the
// schema and a stubbed Stripe: past courtesy refunds become the customer's one
// refund, everything else is left out and counted, a dry run writes nothing,
// and a second run changes nothing.

const busy = await createBusyDb('courtesy-backfill');
const T0 = Math.floor(Date.UTC(2026, 10, 26, 21, 50) / 1000);

function charge(id: string, over: Record<string, unknown> = {}) {
  return {
    id,
    object: 'charge',
    amount: 5900,
    amount_refunded: 5900,
    refunded: true,
    currency: 'usd',
    customer: 'cus_jesse',
    invoice: `in_${id}`,
    payment_method_details: { type: 'link', link: {} },
    billing_details: { email: null },
    ...over,
  };
}

function refund(id: string, chargeId: string, over: Record<string, unknown> = {}) {
  return {
    id,
    object: 'refund',
    amount: 5900,
    charge: chargeId,
    created: T0,
    currency: 'usd',
    reason: 'requested_by_customer',
    status: 'succeeded',
    metadata: {},
    ...over,
  };
}

// One courtesy refund (Jesse's renewal), and three that must stay out: the
// money-back flow's own, a partial goodwill credit, and a duplicate charge.
const REFUNDS = [
  refund('re_courtesy', 'ch_renewal'),
  refund('re_moneyback', 'ch_first', { metadata: { money_back: '1', subscription_id: 'sub_1' } }),
  refund('re_partial', 'ch_partial', { amount: 1000 }),
  refund('re_duplicate', 'ch_double', { reason: 'duplicate' }),
];

const ROUTES = {
  'GET api.stripe.com/v1/refunds': { object: 'list', data: REFUNDS, has_more: false, url: '/v1/refunds' },
  'GET api.stripe.com/v1/charges/ch_renewal': charge('ch_renewal'),
  'GET api.stripe.com/v1/charges/ch_first': charge('ch_first'),
  'GET api.stripe.com/v1/charges/ch_partial': charge('ch_partial', { amount_refunded: 1000, refunded: false }),
  'GET api.stripe.com/v1/charges/ch_double': charge('ch_double'),
};

function runBackfill(f: Fixture, args: string[]) {
  return busy.run(f, 'backfill-courtesy-refunds.mts', args, {
    env: { STRIPE_SECRET_KEY: 'sk_test_courtesy_backfill' },
    routes: ROUTES,
  });
}

function courtesyRows(f: Fixture) {
  return f.db
    .prepare('SELECT charge_id, user_id, email, refund_ids, refunded_at, source FROM courtesy_refunds ORDER BY charge_id')
    .all()
    .map((row) => ({ ...row }));
}

test('a dry run lists the courtesy refund, counts what it leaves out, and writes nothing', (t) => {
  const f = busy.fixture(t, 'dry');
  busy.member(f, 'jesse@example.com', { stripe_customer_id: 'cus_jesse' });
  const result = runBackfill(f, ['--dry-run']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Mode:\s+dry run, nothing is written$/m);
  assert.match(result.stdout, /would record\s+2026-11-26\s+59\.00 USD\s+jesse@example\.com\s+\(charge ch_renewal\)/);
  assert.doesNotMatch(result.stdout, /ch_first|ch_partial|ch_double/, 'only the courtesy refund is listed');
  assert.match(result.stdout, /Read 4 refund\(s\) on 4 charge\(s\)\./);
  assert.match(result.stdout, /Courtesy refunds: 1 to record, 0 already recorded\./);
  assert.match(result.stdout, /1\s+money-back guarantee refund/);
  assert.match(result.stdout, /1\s+partial refund/);
  assert.match(result.stdout, /1\s+reason not "Requested by customer"/);
  assert.deepEqual(courtesyRows(f), []);
});

test('--yes records it against the account, with a dated audit row, and a re-run adds nothing', (t) => {
  const f = busy.fixture(t, 'apply');
  const userId = busy.member(f, 'jesse@example.com', { stripe_customer_id: 'cus_jesse' });

  const first = runBackfill(f, ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /Courtesy refunds: 1 recorded, 0 already recorded\./);
  assert.deepEqual(courtesyRows(f), [
    {
      charge_id: 'ch_renewal',
      user_id: userId,
      email: 'jesse@example.com',
      refund_ids: 're_courtesy',
      refunded_at: new Date(T0 * 1000).toISOString(),
      source: 'backfill',
    },
  ]);
  assert.equal(auditCount(f, 'courtesy_refund_recorded', userId), 1);
  const audit = f.db
    .prepare(`SELECT ip, created_at FROM audit_events WHERE type = 'courtesy_refund_recorded' AND user_id = ?`)
    .get(userId) as { ip: string; created_at: string };
  assert.deepEqual({ ...audit }, { ip: 'backfill-script', created_at: new Date(T0 * 1000).toISOString() });

  const second = runBackfill(f, ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /already recorded\s+2026-11-26/);
  assert.match(second.stdout, /Courtesy refunds: 0 recorded, 1 already recorded\./);
  assert.equal(courtesyRows(f).length, 1);
  assert.equal(auditCount(f, 'courtesy_refund_recorded', userId), 1);
});

// diagnose-user is where the courtesy rule's "never refunded" check is read
// (docs/refund-requests.md). It reads through the sqlite3 CLI.
test('diagnose-user says whether the one refund is used, matching by canonical email too', { skip: sqlite3Missing }, (t) => {
  const f = busy.fixture(t, 'diagnose');
  busy.member(f, 'Jesse.Sanchez@gmail.com', { stripe_customer_id: 'cus_jesse' });
  const oneRefundLine = () => {
    const result = busy.run(f, 'diagnose-user.mts', ['--email', 'jesse.sanchez@gmail.com']);
    assert.equal(result.status, 0, result.stderr + result.stdout);
    return result.stdout.match(/^ {2}One refund used.*$/m)?.[0] ?? '(missing)';
  };
  assert.match(oneRefundLine(), /One refund used\s+no$/);

  // Recorded before the account existed, so only the address ties it to him.
  f.db
    .prepare(
      `INSERT INTO courtesy_refunds (charge_id, refund_ids, customer_id, user_id, email, email_canonical,
         card_fingerprint, invoice_id, amount_refunded, currency, refunded_at, source, recorded_at, updated_at)
       VALUES ('ch_renewal', 're_courtesy', 'cus_old', NULL, 'jessesanchez@gmail.com', 'jessesanchez@gmail.com',
         NULL, 'in_ch_renewal', 5900, 'usd', '2026-11-26T21:50:00.000Z', 'backfill',
         '2026-11-27T00:00:00.000Z', '2026-11-27T00:00:00.000Z')`,
    )
    .run();
  assert.match(oneRefundLine(), /One refund used\s+yes — courtesy refund 2026-11-26T21:50:00\.000Z \(charge ch_renewal\)$/);
});

test('--dry-run and --yes together are refused', (t) => {
  const f = busy.fixture(t, 'both');
  const result = runBackfill(f, ['--dry-run', '--yes']);
  assert.equal(result.status, 1);
  assert.match(result.stderr, /mutually exclusive/);
});
