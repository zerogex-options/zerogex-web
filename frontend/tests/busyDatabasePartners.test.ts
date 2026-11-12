import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY,
  at,
  auditCount,
  blockWrites,
  column,
  createBusyDb,
  httpCalls,
  printedCommand,
  runPrinted,
  sqlite3Missing,
  unblockWrites,
  type RunOptions,
  type Fixture,
} from './support/busyDb.ts';

// The Creator Partner scripts, run by hand: grant-partner-pro.mts,
// revoke-partner.mts and move-partner-promo.mts. Each changes the partner's
// promotion code in Stripe (creates it, switches it off, or moves it to
// another coupon) and then records what it did in the auth database.
//
// Stripe can't be taken back from here, so two things matter once it has
// changed. The record has to wait for the database: the live site holds the
// write lock whenever a member is active, so each script is run once while
// another process holds it. And when the record fails anyway, none of it may
// be left half written, and the script has to say what it did in Stripe and
// print the statements that record it by hand: each script is run again with
// that write rejected, and the printed command is run exactly as printed.
//
// Same harness as tests/busyDatabase.test.ts (tests/support/busyDb.ts): a copy
// of the real schema per test, with Stripe answered by tests/support/stub-http.mts.

const { fixture, member, audit, run, runWhileLocked } = await createBusyDb('busy-db-partners');

const AUDIENCE_COUPON = 'coupon_audience';
const STRIPE_ENV = { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_COUPON_PARTNER_AUDIENCE: AUDIENCE_COUPON };

function coupon(id: string, percentOff: number) {
  return {
    id,
    object: 'coupon',
    name: null,
    valid: true,
    percent_off: percentOff,
    amount_off: null,
    currency: null,
    duration: 'forever',
    duration_in_months: null,
  };
}

function promotionCode(id: string, code: string, onCoupon: ReturnType<typeof coupon>, partnerUserId: string) {
  return {
    id,
    object: 'promotion_code',
    code,
    active: true,
    coupon: onCoupon,
    metadata: { partner_user_id: partnerUserId },
    times_redeemed: 0,
  };
}

function promotionCodes(data: unknown[]) {
  return { object: 'list', url: '/v1/promotion_codes', has_more: false, data };
}

// What the run(s) changed in Stripe, in order: the path and the decoded form body.
function stripeWrites(f: Fixture): string[][] {
  return httpCalls(f)
    .filter((c) => c.method === 'POST' && new URL(c.url).host === 'api.stripe.com')
    .map((c) => [new URL(c.url).pathname, decodeURIComponent(c.body ?? '')]);
}

function auditMessages(f: Fixture, type: string, userId: string): string[] {
  const rows = f.db
    .prepare('SELECT message FROM audit_events WHERE type = ? AND user_id = ? ORDER BY created_at')
    .all(type, userId) as Array<{ message: string }>;
  return rows.map((r) => r.message);
}

// A Creator Partner as grant-partner-pro.mts leaves one, 30 days into the grant.
function partner(f: Fixture, email: string, code: string, columns: Record<string, string | null> = {}): string {
  const id = member(f, email, {
    tier: 'pro',
    referral_code: `R${code}`,
    partner_tier: 'creator',
    partner_audience_promo_code: code,
    partner_activated_at: at(-30 * DAY),
    partner_pro_grant_expires_at: at(60 * DAY),
    ...columns,
  });
  audit(f, id, 'partner_grant_created', at(-30 * DAY), `grant 90d Pro, bps=3000, window=12mo, promo=${code}`);
  return id;
}

// ---------------------------------------------------------------------------
// grant-partner-pro: the grant is written before Stripe, then the audit row,
// the only record of the Stripe promotion code it made, after.
// ---------------------------------------------------------------------------

// A member about to be made a partner. They have a referral code already, so
// the grant itself is the first write. No code on the audience coupon yet, so
// the script creates one.
function grantSetup(f: Fixture) {
  const id = member(f, 'creator@example.com', { referral_code: 'CRTR2345' });
  const opts: RunOptions = {
    env: STRIPE_ENV,
    routes: {
      'GET api.stripe.com/v1/promotion_codes': promotionCodes([]),
      'POST api.stripe.com/v1/promotion_codes': promotionCode('promo_creator', 'CREATOR25', coupon(AUDIENCE_COUPON, 25), id),
    },
  };
  return { id, opts, args: ['--email', 'creator@example.com', '--promo-code', 'CREATOR25', '--yes'] };
}

const createdForCreator = (id: string) => [
  ['/v1/promotion_codes', `coupon=${AUDIENCE_COUPON}&code=CREATOR25&metadata[partner_user_id]=${id}`],
];

test('grant-partner-pro: a busy database waits, so the partner is granted and the code it created is recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'grant-partner');
  const { id, opts, args } = grantSetup(f);

  const result = await runWhileLocked(f, 'grant-partner-pro.mts', args, opts);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Activated\.$/m);
  assert.deepEqual(stripeWrites(f), createdForCreator(id), 'the code is created once');
  assert.equal(column(f, id, 'partner_tier'), 'creator');
  assert.equal(column(f, id, 'tier'), 'pro');
  assert.equal(column(f, id, 'partner_audience_promo_code'), 'CREATOR25');
  const messages = auditMessages(f, 'partner_grant_created', id);
  assert.equal(messages.length, 1, 'one audit row');
  assert.match(messages[0], /, stripe_promo=promo_creator$/);
});

test('grant-partner-pro: when the audit row fails after Stripe, it names the code it created and prints the statement that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'grant-partner-unrecorded');
  const { id, opts, args } = grantSetup(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'partner_grant_created'");

  const result = run(f, 'grant-partner-pro.mts', args, opts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /Stripe promotion code promo_creator \(CREATOR25 on coupon coupon_audience\) was created and /);
  assert.match(result.stderr, /is a partner now, but the grant is not recorded in the audit log: .*write blocked by the test/);
  assert.match(result.stderr, /Record it now:$/m);
  assert.match(result.stderr, /^The activation summary was not printed\. Their links for the DM: https:\/\/zerogex\.test\/register\?ref=CRTR2345 and /m);
  assert.deepEqual(stripeWrites(f), createdForCreator(id), 'created in Stripe');
  assert.equal(auditCount(f, 'partner_grant_created', id), 0, 'nothing recorded');

  unblockWrites(f);
  const command = printedCommand(result.stderr);
  assert.ok(command, result.stderr);
  const fix = runPrinted(command);
  assert.equal(fix.status, 0, fix.stderr);
  const messages = auditMessages(f, 'partner_grant_created', id);
  assert.equal(messages.length, 1, 'recorded by the printed command');
  assert.match(messages[0], /, stripe_promo=promo_creator$/);
});

// ---------------------------------------------------------------------------
// revoke-partner: the partner state is cleared and, when that ends their Pro,
// their API keys revoked before Stripe; then the audit row, the only record of
// the code it switched off, after.
// ---------------------------------------------------------------------------

// The ZeroGEX backend's key service, answered by stub-http.mts.
const KEY_ENV = {
  ZEROGEX_API_BASE_URL: 'https://keys.zerogex.test',
  ZEROGEX_API_TOKEN: 'test-bearer',
  ZEROGEX_ADMIN_TOKEN: 'test-admin',
};
const KEY_ROUTES = { 'POST keys.zerogex.test/api/admin/api-keys/revoke-all': { revoked: 1 } };

// Whose keys the run(s) revoked, in order: one entry per revoke-all call.
function keyRevocations(f: Fixture): string[] {
  return httpCalls(f)
    .filter((c) => new URL(c.url).pathname === '/api/admin/api-keys/revoke-all')
    .map((c) => (JSON.parse(c.body ?? '{}') as { user_id: string }).user_id);
}

function revokeSetup(f: Fixture, columns: Record<string, string | null> = {}) {
  const id = partner(f, 'leaving@example.com', 'LEAVING25', columns);
  const code = promotionCode('promo_leaving', 'LEAVING25', coupon(AUDIENCE_COUPON, 25), id);
  const opts: RunOptions = {
    env: { ...STRIPE_ENV, ...KEY_ENV },
    routes: {
      'GET api.stripe.com/v1/promotion_codes': promotionCodes([code]),
      'POST api.stripe.com/v1/promotion_codes/promo_leaving': { ...code, active: false },
      ...KEY_ROUTES,
    },
  };
  return { id, opts, args: ['--email', 'leaving@example.com', '--yes'] };
}

const switchedOffLeaving = [['/v1/promotion_codes/promo_leaving', 'active=false']];
const leavingRecord = 'partner cleared; stripe_promo=deactivated promo_leaving; tier=pro->public; api_keys=revoked 1';

test('revoke-partner: a busy database waits, so the code is switched off, the API keys revoked and the revocation recorded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'revoke-partner');
  const { id, opts, args } = revokeSetup(f);

  const first = await runWhileLocked(f, 'revoke-partner.mts', args, opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^ {2}Stripe promo: +deactivated promo_leaving$/m);
  assert.match(first.stdout, /^ {2}API keys: +revoked 1$/m);
  assert.equal(column(f, id, 'partner_tier'), null);
  assert.equal(column(f, id, 'partner_audience_promo_code'), null);
  assert.equal(column(f, id, 'tier'), 'public', 'no paid subscription, so Pro ends with the partnership');
  assert.equal(column(f, id, 'referral_code'), 'RLEAVING25', 'kept for the referrals ledger');
  assert.deepEqual(auditMessages(f, 'partner_revoked', id), [leavingRecord], 'one audit row');

  // Nothing left to clear, so a second run says so and changes nothing.
  const second = run(f, 'revoke-partner.mts', args, opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /has no partner state to clear\. Nothing to do\.$/m);
  assert.deepEqual(stripeWrites(f), switchedOffLeaving, 'switched off once');
  assert.deepEqual(keyRevocations(f), ['leaving@example.com'], 'keys revoked once');
  assert.equal(auditCount(f, 'partner_revoked', id), 1);
});

test('revoke-partner: when the audit row fails after Stripe, it names the code it switched off and prints the statement that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'revoke-partner-unrecorded');
  const { id, opts, args } = revokeSetup(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'partner_revoked'");

  const result = run(f, 'revoke-partner.mts', args, opts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /Stripe promotion code promo_leaving \(LEAVING25 on coupon coupon_audience\) was DEACTIVATED and /);
  assert.match(result.stderr, /partner state cleared, but the revocation is not recorded in the audit log: .*write blocked by the test/);
  assert.match(result.stderr, /Record it now:$/m);
  assert.deepEqual(stripeWrites(f), switchedOffLeaving, 'switched off in Stripe');
  assert.deepEqual(keyRevocations(f), ['leaving@example.com'], 'keys revoked before the record step, so none is left working');
  assert.equal(auditCount(f, 'partner_revoked', id), 0, 'nothing recorded');

  unblockWrites(f);
  const command = printedCommand(result.stderr);
  assert.ok(command, result.stderr);
  const fix = runPrinted(command);
  assert.equal(fix.status, 0, fix.stderr);
  assert.deepEqual(auditMessages(f, 'partner_revoked', id), [leavingRecord], 'recorded by the printed command');
});

test('revoke-partner: with key administration not configured, the downgrade stands, the run fails, and the retry it prints revokes the keys', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'revoke-partner-keys-unconfigured');
  const { id, opts, args } = revokeSetup(f);
  const unconfigured: RunOptions = { ...opts, env: STRIPE_ENV };

  // The dry run says so before anything changes.
  const preview = run(f, 'revoke-partner.mts', ['--email', 'leaving@example.com', '--dry-run'], unconfigured);
  assert.equal(preview.status, 0, preview.stderr + preview.stdout);
  assert.match(preview.stdout, /^ {2}- revoke all of their API keys: NOT POSSIBLE, key administration is not configured /m);

  const result = run(f, 'revoke-partner.mts', args, unconfigured);
  assert.equal(result.status, 3, result.stderr + result.stdout);
  assert.equal(column(f, id, 'tier'), 'public', 'the downgrade stands');
  assert.equal(column(f, id, 'partner_tier'), null);
  assert.match(result.stdout, /^ {2}API keys: +NOT revoked \(key administration is not configured\)$/m);
  assert.match(result.stderr, /leaving@example\.com's API keys were NOT revoked: key administration is not configured\./);
  assert.match(result.stderr, /^ {2}make partner-grant-revoke-backfill YES=1$/m);
  assert.deepEqual(keyRevocations(f), [], 'the key service was not called');
  assert.deepEqual(auditMessages(f, 'partner_revoked', id), [
    'partner cleared; stripe_promo=deactivated promo_leaving; tier=pro->public; api_keys=NOT revoked (key administration is not configured)',
  ]);

  // The retry it printed (make partner-grant-revoke-backfill YES=1), once key
  // administration is configured: it finds them by their partner_revoked row.
  const retry = run(f, 'expire-partner-grants.mjs', ['--backfill-revocations', '--yes'], { env: KEY_ENV, routes: KEY_ROUTES });
  assert.equal(retry.status, 0, retry.stderr + retry.stdout);
  assert.deepEqual(keyRevocations(f), ['leaving@example.com'], 'revoked by the retry');
});

test('revoke-partner: when the key service fails, the downgrade still stands and the run fails with the retry', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'revoke-partner-keys-down');
  const { id, opts, args } = revokeSetup(f);
  // Configured, but nothing listens there.
  const down: RunOptions = { ...opts, env: { ...opts.env, ZEROGEX_API_BASE_URL: 'http://127.0.0.1:9' } };

  const result = run(f, 'revoke-partner.mts', args, down);
  assert.equal(result.status, 3, result.stderr + result.stdout);
  assert.equal(column(f, id, 'tier'), 'public', 'the downgrade stands');
  assert.deepEqual(stripeWrites(f), switchedOffLeaving, 'the rest of the wind-down still ran');
  assert.match(result.stderr, /API keys were NOT revoked: the key service failed \(Could not reach the key service: /);
  assert.match(result.stderr, /^ {2}make partner-grant-revoke-backfill YES=1$/m);
  const [record] = auditMessages(f, 'partner_revoked', id);
  assert.match(record, /; tier=pro->public; api_keys=NOT revoked \(Could not reach the key service: [^)]+\)$/);
});

test('revoke-partner: a partner who pays for Pro keeps Pro and their API keys', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'revoke-partner-paying');
  const { id, opts, args } = revokeSetup(f, { stripe_subscription_id: 'sub_paying', subscription_status: 'active' });

  const result = run(f, 'revoke-partner.mts', args, opts);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(column(f, id, 'partner_tier'), null, 'no longer a partner');
  assert.equal(column(f, id, 'tier'), 'pro', 'the webhook owns a paying member');
  assert.deepEqual(keyRevocations(f), [], 'their keys are left alone');
});

// ---------------------------------------------------------------------------
// move-partner-promo: nothing is written before Stripe. The record is the
// link's coupon override, when it has to follow the code, and the audit row,
// written together.
// ---------------------------------------------------------------------------

// A partner whose link and code apply their own coupon (coupon_old), moved
// onto the standard audience coupon: the code moves in Stripe, and the link's
// override is cleared so the link follows it.
function moveSetup(f: Fixture) {
  const id = partner(f, 'moving@example.com', 'MOVE25', { partner_audience_coupon_id: 'coupon_old' });
  const target = coupon(AUDIENCE_COUPON, 25);
  const oldCode = promotionCode('promo_old', 'MOVE25', coupon('coupon_old', 20), id);
  const newCode = promotionCode('promo_new', 'MOVE25', target, id);
  const opts: RunOptions = {
    env: STRIPE_ENV,
    routes: {
      [`GET api.stripe.com/v1/coupons/${AUDIENCE_COUPON}`]: target,
      'GET api.stripe.com/v1/promotion_codes': promotionCodes([oldCode]),
      'POST api.stripe.com/v1/promotion_codes/promo_old': { ...oldCode, active: false },
      'POST api.stripe.com/v1/promotion_codes': newCode,
    },
  };
  // Stripe as the move leaves it.
  const moved: RunOptions = {
    env: STRIPE_ENV,
    routes: {
      [`GET api.stripe.com/v1/coupons/${AUDIENCE_COUPON}`]: target,
      'GET api.stripe.com/v1/promotion_codes': promotionCodes([{ ...oldCode, active: false }, newCode]),
    },
  };
  return { id, opts, moved, args: ['--promo-code', 'MOVE25', '--coupon-id', AUDIENCE_COUPON, '--yes'] };
}

const movedMove25 = (id: string) => [
  ['/v1/promotion_codes/promo_old', 'active=false'],
  ['/v1/promotion_codes', `coupon=${AUDIENCE_COUPON}&code=MOVE25&metadata[partner_user_id]=${id}`],
];
const move25Record = 'MOVE25 -> coupon_audience; created promo_new; switched off promo_old; override coupon_old -> (none)';

test('move-partner-promo: a busy database waits, so the move and the link coupon it changes are recorded together, once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'move-promo');
  const { id, opts, moved, args } = moveSetup(f);

  const first = await runWhileLocked(f, 'move-partner-promo.mts', args, opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Moved\.$/m);
  assert.equal(column(f, id, 'partner_audience_coupon_id'), null, 'the link follows the code onto the audience coupon');
  assert.deepEqual(auditMessages(f, 'partner_promo_code_moved', id), [move25Record], 'one audit row');

  // Against Stripe as the move left it, a second run finds nothing to do.
  const second = run(f, 'move-partner-promo.mts', args, moved);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Nothing to do: MOVE25 is already active on coupon_audience\.$/m);
  assert.deepEqual(stripeWrites(f), movedMove25(id), 'switched off and created once');
  assert.equal(auditCount(f, 'partner_promo_code_moved', id), 1);
});

test('move-partner-promo: when the record fails after Stripe, none of it is written, and the printed statements record all of it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'move-promo-unrecorded');
  const { id, opts, args } = moveSetup(f);
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'partner_promo_code_moved'");

  const result = run(f, 'move-partner-promo.mts', args, opts);
  assert.notEqual(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stderr, /MOVE25 is now on coupon_audience in Stripe \(created promo_new; switched off promo_old\)/);
  assert.match(result.stderr, /, but the move is not recorded here: .*write blocked by the test/);
  assert.match(result.stderr, /the partner's link still applies coupon_old, not coupon_audience/);
  assert.match(result.stderr, /Record it now:$/m);
  assert.deepEqual(stripeWrites(f), movedMove25(id), 'moved in Stripe');
  assert.equal(column(f, id, 'partner_audience_coupon_id'), 'coupon_old', 'the override rolled back with the audit row');
  assert.equal(auditCount(f, 'partner_promo_code_moved', id), 0, 'nothing recorded');

  unblockWrites(f);
  const command = printedCommand(result.stderr);
  assert.ok(command, result.stderr);
  const fix = runPrinted(command);
  assert.equal(fix.status, 0, fix.stderr);
  assert.equal(column(f, id, 'partner_audience_coupon_id'), null, 'the override, recorded by the printed command');
  assert.deepEqual(auditMessages(f, 'partner_promo_code_moved', id), [move25Record], 'and the audit row with it');
});
