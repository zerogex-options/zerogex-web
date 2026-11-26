import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  derivePauseState,
  clampPauseMonths,
  computeResumesAtUnix,
  isPausableCadence,
  monthlyBillUnix,
  billsDuringPause,
  pauseRevokesApiKeys,
  previewResume,
  endPauseParam,
  scheduleCancelParams,
} from '../core/subscriptionPause.ts';
import { auditCount, column, createBusyDb, httpCalls, sqlite3Missing } from './support/busyDb.ts';

// core/stripe.ts builds its price table at module load, so the env goes first.
// Every cadence is mapped for one tier, so priceIdToSku resolves the real thing,
// plus Pro monthly for the API-key rule.
process.env.STRIPE_PRICE_BASIC_MONTHLY = 'price_basic_monthly';
process.env.STRIPE_PRICE_BASIC_QUARTERLY = 'price_basic_quarterly';
process.env.STRIPE_PRICE_BASIC_ANNUAL = 'price_basic_annual';
process.env.STRIPE_PRICE_PRO_MONTHLY = 'price_pro_monthly';
const { priceIdToSku } = await import('../core/stripe.ts');

// Pause is the entitlement-critical retention lever: a paused sub must read as
// "no access, not churned", the pause length must stay bounded, and only a
// monthly plan may pause at all. Lock the derivation, the clamp and the gate.

test('derivePauseState: no pause_collection → not paused', () => {
  assert.deepEqual(derivePauseState(null), { paused: false, resumesAtIso: null });
  assert.deepEqual(derivePauseState(undefined), { paused: false, resumesAtIso: null });
  assert.deepEqual(derivePauseState({ behavior: null, resumesAt: null }), {
    paused: false,
    resumesAtIso: null,
  });
});

test('derivePauseState: a behavior with resumes_at → paused, with the ISO resume', () => {
  const resumesAt = Math.floor(Date.UTC(2026, 9, 14, 12, 0, 0) / 1000);
  const s = derivePauseState({ behavior: 'void', resumesAt });
  assert.equal(s.paused, true);
  assert.equal(s.resumesAtIso, new Date(resumesAt * 1000).toISOString());
});

test('derivePauseState: paused with no resumes_at (indefinite) → paused, null resume', () => {
  assert.deepEqual(derivePauseState({ behavior: 'void', resumesAt: null }), {
    paused: true,
    resumesAtIso: null,
  });
});

test('clampPauseMonths: valid stays, out-of-range clamps to [1,3], garbage → 1', () => {
  assert.equal(clampPauseMonths(1), 1);
  assert.equal(clampPauseMonths(2), 2);
  assert.equal(clampPauseMonths(3), 3);
  assert.equal(clampPauseMonths(0), 1);
  assert.equal(clampPauseMonths(-5), 1);
  assert.equal(clampPauseMonths(12), 3);
  assert.equal(clampPauseMonths(2.9), 2);
  assert.equal(clampPauseMonths('2'), 2);
  assert.equal(clampPauseMonths('nope'), 1);
  assert.equal(clampPauseMonths(null), 1);
  assert.equal(clampPauseMonths(undefined), 1);
});

test('computeResumesAtUnix: adds calendar months', () => {
  const now = Date.UTC(2026, 7, 14, 12, 0, 0); // 2026-08-14
  const oneMonth = computeResumesAtUnix(now, 1);
  assert.equal(new Date(oneMonth * 1000).toISOString(), new Date(Date.UTC(2026, 8, 14, 12, 0, 0)).toISOString());
  const threeMonths = computeResumesAtUnix(now, 3);
  assert.equal(new Date(threeMonths * 1000).toISOString(), new Date(Date.UTC(2026, 10, 14, 12, 0, 0)).toISOString());
});

test('computeResumesAtUnix: a pause from the 29th-31st ends on the last day of a shorter month', () => {
  const iso = (unix: number) => new Date(unix * 1000).toISOString();
  // One month from Jan 31 is Feb 28, not Mar 3 (which voided the Mar 1 bill too).
  assert.equal(iso(computeResumesAtUnix(Date.UTC(2027, 0, 31, 15, 30, 0), 1)), '2027-02-28T15:30:00.000Z');
  // Leap year.
  assert.equal(iso(computeResumesAtUnix(Date.UTC(2028, 0, 30, 9, 0, 0), 1)), '2028-02-29T09:00:00.000Z');
  // Three months from Nov 30 is Feb 28, not Mar 2.
  assert.equal(iso(computeResumesAtUnix(Date.UTC(2026, 10, 30, 12, 0, 0), 3)), '2027-02-28T12:00:00.000Z');
  // Across the year end, and a 31st into a 31-day month stays the 31st.
  assert.equal(iso(computeResumesAtUnix(Date.UTC(2026, 9, 31, 0, 0, 0), 2)), '2026-12-31T00:00:00.000Z');
  assert.equal(iso(computeResumesAtUnix(Date.UTC(2026, 11, 31, 0, 0, 0), 1)), '2027-01-31T00:00:00.000Z');
});

// What both routes compute from users.stripe_price_id before asking the gate.
function cadenceOfPrice(priceId: string | null) {
  const sku = priceId ? priceIdToSku(priceId) : null;
  return sku?.cadence;
}

test('isPausableCadence: monthly only', () => {
  assert.equal(isPausableCadence('monthly'), true);
  // A pause across a quarterly or annual renewal voids the whole renewal invoice.
  assert.equal(isPausableCadence('quarterly'), false);
  assert.equal(isPausableCadence('annual'), false);
  // A cadence added later stays unpausable until someone decides otherwise.
  assert.equal(isPausableCadence('semiannual'), false);
});

test('isPausableCadence: through priceIdToSku, as the routes call it', () => {
  assert.equal(isPausableCadence(cadenceOfPrice('price_basic_monthly')), true);
  assert.equal(isPausableCadence(cadenceOfPrice('price_basic_quarterly')), false);
  assert.equal(isPausableCadence(cadenceOfPrice('price_basic_annual')), false);
});

test('isPausableCadence: an unmapped price (null SKU) is not pausable', () => {
  assert.equal(priceIdToSku('price_nobody_sells'), null);
  assert.equal(isPausableCadence(cadenceOfPrice('price_nobody_sells')), false);
  // No price on the row at all.
  assert.equal(isPausableCadence(cadenceOfPrice(null)), false);
  assert.equal(isPausableCadence(null), false);
  assert.equal(isPausableCadence(undefined), false);
});

// --- Bill preview (scripts/pause-subscription.mts) --------------------------
// Unix seconds for a UTC wall-clock time. Explicit UTC throughout, so these
// don't depend on the machine's time zone.
const utc = (y: number, m: number, d: number, h = 0, min = 0) => Math.floor(Date.UTC(y, m - 1, d, h, min) / 1000);
const iso = (unix: number | null) => (unix == null ? null : new Date(unix * 1000).toISOString());

test('monthlyBillUnix: same UTC day and time each month', () => {
  const anchor = utc(2026, 3, 15, 14, 30);
  assert.equal(iso(monthlyBillUnix(anchor, 0)), '2026-03-15T14:30:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 9)), '2026-12-15T14:30:00.000Z');
  // Across a year boundary.
  assert.equal(iso(monthlyBillUnix(anchor, 10)), '2027-01-15T14:30:00.000Z');
});

test('monthlyBillUnix: an anchor on the 31st bills the last day of short months, then the 31st again', () => {
  const anchor = utc(2026, 1, 31, 9);
  assert.equal(iso(monthlyBillUnix(anchor, 1)), '2026-02-28T09:00:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 2)), '2026-03-31T09:00:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 10)), '2026-11-30T09:00:00.000Z');
  assert.equal(iso(monthlyBillUnix(anchor, 11)), '2026-12-31T09:00:00.000Z');
  // 2028 is a leap year.
  assert.equal(iso(monthlyBillUnix(anchor, 25)), '2028-02-29T09:00:00.000Z');
});

test('billsDuringPause: paused just after a renewal skips the next two bills, and the paid month carries over', () => {
  // Renews on the 15th; renewed Nov 15, paused Nov 18 for two months.
  const anchor = utc(2026, 6, 15, 12);
  const now = utc(2026, 11, 18, 15);
  const resumesAt = utc(2027, 1, 18, 15);
  const bills = billsDuringPause(anchor, now, resumesAt);
  assert.deepEqual(bills.skippedUnix.map(iso), ['2026-12-15T12:00:00.000Z', '2027-01-15T12:00:00.000Z']);
  // Nothing more until the bill after the resume: the Nov 15 payment covers
  // Jan 18 to Feb 15.
  assert.equal(iso(bills.nextChargeUnix), '2027-02-15T12:00:00.000Z');
});

test('billsDuringPause: a bill already raised (before now) is not counted', () => {
  // Renewed earlier today; that bill is behind us, not inside the pause.
  const anchor = utc(2026, 6, 18, 9);
  const now = utc(2026, 11, 18, 15);
  const bills = billsDuringPause(anchor, now, utc(2026, 12, 18, 15));
  assert.deepEqual(bills.skippedUnix.map(iso), ['2026-12-18T09:00:00.000Z']);
  assert.equal(iso(bills.nextChargeUnix), '2027-01-18T09:00:00.000Z');
});

test('billsDuringPause: a trial anchor in the future is the first bill', () => {
  // Trial ends Nov 21; a one-month pause from Nov 18 skips the conversion bill.
  const anchor = utc(2026, 11, 21, 10);
  const bills = billsDuringPause(anchor, utc(2026, 11, 18, 15), utc(2026, 12, 18, 15));
  assert.deepEqual(bills.skippedUnix.map(iso), ['2026-11-21T10:00:00.000Z']);
  assert.equal(iso(bills.nextChargeUnix), '2026-12-21T10:00:00.000Z');
});

test('billsDuringPause: N months paused skips exactly N bills, whenever it starts', () => {
  // The fairness the pause promises, over every billing day the calendar
  // always has (1-28), pause start days on either side of it, and 1-3 months.
  // Resumes N calendar months out at the same UTC time, as Stripe is asked to.
  for (let billingDay = 1; billingDay <= 28; billingDay++) {
    const anchor = utc(2026, 1, billingDay, 13, 7);
    for (const startDay of [1, billingDay, 15, 28]) {
      for (const hour of [0, 13, 23]) {
        for (const months of [1, 2, 3]) {
          const now = utc(2026, 11, startDay, hour);
          const resumesAt = utc(2026, 11 + months, startDay, hour);
          const bills = billsDuringPause(anchor, now, resumesAt);
          assert.equal(
            bills.skippedUnix.length,
            months,
            `billing day ${billingDay}, paused Nov ${startDay} ${hour}:00 UTC for ${months}`,
          );
          assert.ok(bills.nextChargeUnix != null && bills.nextChargeUnix >= resumesAt);
        }
      }
    }
  }
});

test('billsDuringPause: bad input previews nothing', () => {
  const now = utc(2026, 11, 18);
  assert.deepEqual(billsDuringPause(Number.NaN, now, now + 86_400), { skippedUnix: [], nextChargeUnix: null });
  assert.deepEqual(billsDuringPause(now, now, now), { skippedUnix: [], nextChargeUnix: null });
  assert.deepEqual(billsDuringPause(now, now, now - 1), { skippedUnix: [], nextChargeUnix: null });
});

// --- API keys: who is told the pause costs them their key -------------------
// A pause drops the member to public, the webhook revokes every API key on a
// drop out of Pro, and the key service can't suspend a key, so it never works
// again. pauseRevokesApiKeys decides who is warned: the cancel flow before the
// pause, the Account page's paused banner during it, and the operator preview.
// tests/apiKeys.test.ts holds it to the revocation itself.

test('pauseRevokesApiKeys: a Pro plan loses its key, a Basic plan has none to lose', () => {
  assert.equal(pauseRevokesApiKeys('pro'), true);
  assert.equal(pauseRevokesApiKeys('basic'), false);
  // No plan we sell, or no plan at all: nothing to warn about.
  assert.equal(pauseRevokesApiKeys(null), false);
  assert.equal(pauseRevokesApiKeys(undefined), false);
});

test("pauseRevokesApiKeys: reads the plan's tier, since users.tier is already public while paused", () => {
  // What users.tier says during a pause. A paused banner keyed off it would
  // never show, which is why the Account page passes the plan's tier.
  assert.equal(pauseRevokesApiKeys('public'), false);
  // The plan, through priceIdToSku, as the Account page and the script read it.
  const planTier = (priceId: string | null) => (priceId ? priceIdToSku(priceId) : null)?.tier;
  assert.equal(pauseRevokesApiKeys(planTier('price_pro_monthly')), true);
  assert.equal(pauseRevokesApiKeys(planTier('price_basic_monthly')), false);
  assert.equal(pauseRevokesApiKeys(planTier('price_nobody_sells')), false);
  assert.equal(pauseRevokesApiKeys(planTier(null)), false);
});

// --- Operator preview (make pause-subscription) ------------------------------
// A real dry run of scripts/pause-subscription.mts against a copy of the auth
// schema, with Stripe answered by tests/support/stub-http.mts. The operator
// relays the preview to the member, so on a Pro plan it has to say the key goes
// and where the new one comes from.

const busy = await createBusyDb('pause-subscription');
const nowUnix = Math.floor(Date.now() / 1000);

// A live monthly subscription, renewed 20 days ago, on `priceId`.
function monthlySubscription(id: string, priceId: string) {
  const anchor = nowUnix - 20 * 86_400;
  return {
    id,
    object: 'subscription',
    status: 'active',
    customer: `cus_${id}`,
    cancel_at_period_end: false,
    pause_collection: null,
    billing_cycle_anchor: anchor,
    items: {
      object: 'list',
      url: `/v1/subscription_items?subscription=${id}`,
      has_more: false,
      data: [
        {
          id: `si_${id}`,
          object: 'subscription_item',
          current_period_end: monthlyBillUnix(anchor, 1),
          price: { id: priceId, object: 'price' },
        },
      ],
    },
  };
}

function dryRunPause(t: TestContext, email: string, tier: string, priceId: string) {
  const f = busy.fixture(t, `pause-${tier}`);
  const subId = `sub_${tier}`;
  busy.member(f, email, { tier, subscription_status: 'active', stripe_subscription_id: subId });
  const result = busy.run(f, 'pause-subscription.mts', ['--email', email, '--months', '2'], {
    env: {
      STRIPE_SECRET_KEY: 'sk_test_pause_preview',
      STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
    },
    routes: { [`GET api.stripe.com/v1/subscriptions/${subId}`]: monthlySubscription(subId, priceId) },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Dry run: nothing changed\./m);
  assert.deepEqual(
    httpCalls(f).map((c) => `${c.method} ${new URL(c.url).pathname}`),
    [`GET /v1/subscriptions/${subId}`],
    'a dry run only reads the subscription',
  );
  return result.stdout;
}

test('pause-subscription preview: a Pro plan says the API key is revoked for good, and where to make a new one', (t) => {
  const stdout = dryRunPause(t, 'pro-member@example.com', 'pro', 'price_pro_monthly');
  assert.match(stdout, /^Plan:\s+pro monthly$/m);
  assert.match(stdout, /^API keys:\s+REVOKED when access goes off, and they can't be turned back on\.$/m);
  // The link to relay, from NEXT_PUBLIC_APP_URL (https://zerogex.test in the harness).
  assert.match(stdout, /Tell the member to make a new one at https:\/\/zerogex\.test\/account#api-access$/m);
});

test('pause-subscription preview: a Basic plan has no API key to lose, so no key line', (t) => {
  const stdout = dryRunPause(t, 'basic-member@example.com', 'basic', 'price_basic_monthly');
  assert.match(stdout, /^Plan:\s+basic monthly$/m);
  assert.doesNotMatch(stdout, /API key/);
});

// --- Ending a pause early (make resume-subscription) -------------------------
// What the operator reads before ending a pause by hand, then a real run of
// scripts/resume-subscription.mts against the same stubs. The case it was built
// for: a member who paused, then canceled a minute later. The cancel email told
// them they had access until the period ended; the pause had switched it off.
// Resuming has to give that access back, keep the cancel, and charge nothing.

test('previewResume: a scheduled cancel stays, so access lasts to the period end and nothing more is billed', () => {
  const periodEnd = utc(2026, 11, 25, 13, 16);
  assert.deepEqual(previewResume({ cancelAtPeriodEnd: true, periodEndUnix: periodEnd, latestInvoiceStatus: 'paid' }), {
    accessUntilUnix: periodEnd,
    nextChargeUnix: null,
    periodUnpaid: false,
  });
});

test('previewResume: with no cancel, access carries on and the next bill is the period end', () => {
  const periodEnd = utc(2026, 12, 15, 1, 43);
  assert.deepEqual(previewResume({ cancelAtPeriodEnd: false, periodEndUnix: periodEnd, latestInvoiceStatus: 'paid' }), {
    accessUntilUnix: null,
    nextChargeUnix: periodEnd,
    periodUnpaid: false,
  });
});

test('previewResume: only a voided bill marks the period unpaid', () => {
  const periodEnd = utc(2027, 1, 15, 1, 43);
  const unpaid = (latestInvoiceStatus: string | null) =>
    previewResume({ cancelAtPeriodEnd: false, periodEndUnix: periodEnd, latestInvoiceStatus }).periodUnpaid;
  assert.equal(unpaid('void'), true);
  assert.equal(unpaid('paid'), false);
  assert.equal(unpaid(null), false);
});

test('previewResume: an unusable period end gives no date rather than a wrong one', () => {
  assert.deepEqual(previewResume({ cancelAtPeriodEnd: true, periodEndUnix: Number.NaN, latestInvoiceStatus: 'paid' }), {
    accessUntilUnix: null,
    nextChargeUnix: null,
    periodUnpaid: false,
  });
});

// The script's dates, formatted the way it prints them.
const et = (unix: number) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(unix * 1000));

// monthlySubscription, paused yesterday for three months, with this period's
// bill as its latest invoice.
function pausedSubscription(
  id: string,
  priceId: string,
  opts: { cancelAtPeriodEnd: boolean; billStatus: string; billCents: number; paused?: boolean },
) {
  return {
    ...monthlySubscription(id, priceId),
    cancel_at_period_end: opts.cancelAtPeriodEnd,
    pause_collection: opts.paused === false ? null : { behavior: 'void', resumes_at: nowUnix + 90 * 86_400 },
    latest_invoice: { id: `in_${id}`, object: 'invoice', status: opts.billStatus, amount_due: opts.billCents, currency: 'usd' },
  };
}

function periodEndOf(sub: ReturnType<typeof pausedSubscription>): number {
  return sub.items.data[0].current_period_end;
}

function runResume(
  t: TestContext,
  name: string,
  sub: ReturnType<typeof pausedSubscription>,
  opts: { args?: string[]; columns?: Record<string, string | number | null> } = {},
) {
  const f = busy.fixture(t, `resume-${name}`);
  const email = `${name}@example.com`;
  const userId = busy.member(f, email, {
    tier: 'public',
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    paused_until: new Date((nowUnix + 90 * 86_400) * 1000).toISOString(),
    ...opts.columns,
  });
  const result = busy.run(f, 'resume-subscription.mts', ['--email', email, ...(opts.args ?? [])], {
    env: {
      STRIPE_SECRET_KEY: 'sk_test_resume_preview',
      STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
    },
    routes: {
      [`GET api.stripe.com/v1/subscriptions/${sub.id}`]: sub,
      [`POST api.stripe.com/v1/subscriptions/${sub.id}`]: { ...sub, pause_collection: null },
    },
  });
  const calls = httpCalls(f).map((c) => `${c.method} ${new URL(c.url).pathname}`);
  return { f, email, userId, result, calls };
}

test('resume-subscription preview: paused, then canceled, gets access back until the period end and is charged nothing', (t) => {
  const sub = pausedSubscription('sub_paused_canceled', 'price_basic_monthly', {
    cancelAtPeriodEnd: true,
    billStatus: 'paid',
    billCents: 0,
  });
  const { result, calls } = runResume(t, 'paused-canceled', sub);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const out = result.stdout;
  assert.match(out, /^Plan:\s+basic monthly$/m);
  assert.match(out, /^Paused:\s+yes, until /m);
  assert.match(out, /^This period:\s+ends .+; its bill in_sub_paused_canceled \(0\.00 USD\) is paid$/m);
  assert.ok(
    out.includes(`Access:            back on now, until ${et(periodEndOf(sub))}, when the scheduled cancel ends the plan`),
    out,
  );
  assert.match(out, /^Next charge:\s+none\. The scheduled cancel stays, so nothing more is billed\.$/m);
  assert.doesNotMatch(out, /voided|API key/);
  assert.match(out, /^Dry run: nothing changed\./m);
  assert.deepEqual(calls, ['GET /v1/subscriptions/sub_paused_canceled'], 'a dry run only reads the subscription');
});

test('resume-subscription preview: a Pro plan whose bill the pause voided says both, and the next charge', (t) => {
  const sub = pausedSubscription('sub_pro_voided', 'price_pro_monthly', {
    cancelAtPeriodEnd: false,
    billStatus: 'void',
    billCents: 5900,
  });
  const { result } = runResume(t, 'pro-voided', sub);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  const out = result.stdout;
  assert.match(out, /^Access:\s+back on now, and it carries on$/m);
  assert.ok(out.includes(`Next charge:       ${et(periodEndOf(sub))}, the usual monthly bill`), out);
  assert.match(out, /This period's bill was voided \(a pause voids every bill inside it\), so they get/);
  assert.match(out, /^API keys:\s+the pause revoked them for good, and resuming doesn't bring them back\.$/m);
  assert.match(out, /Tell the member to make a new one at https:\/\/zerogex\.test\/account#api-access$/m);
});

test('resume-subscription: a subscription that is not paused is left alone, even with --yes', (t) => {
  const sub = pausedSubscription('sub_not_paused', 'price_basic_monthly', {
    cancelAtPeriodEnd: false,
    billStatus: 'paid',
    billCents: 3900,
    paused: false,
  });
  const { result, calls } = runResume(t, 'not-paused', sub, { args: ['--yes'], columns: { paused_until: null } });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Not paused\. Nothing to do\.$/m);
  assert.deepEqual(calls, ['GET /v1/subscriptions/sub_not_paused']);
});

test('resume-subscription: refuses a subscription whose payment failed', (t) => {
  const sub = {
    ...pausedSubscription('sub_past_due', 'price_basic_monthly', { cancelAtPeriodEnd: false, billStatus: 'open', billCents: 3900 }),
    status: 'past_due',
  };
  const { result, calls } = runResume(t, 'past-due', sub, { args: ['--yes'] });
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /REFUSING: sub_past_due is 'past_due'/);
  assert.deepEqual(calls, ['GET /v1/subscriptions/sub_past_due'], 'nothing is written');
});

test('resume-subscription --yes: clears only the pause, keeps the cancel, and records it', (t) => {
  const sub = pausedSubscription('sub_resume_apply', 'price_basic_monthly', {
    cancelAtPeriodEnd: true,
    billStatus: 'paid',
    billCents: 0,
  });
  // The row as the webhook leaves it once it has heard: tier back, pause gone.
  // The wait for it then ends at the first look instead of timing out.
  const { f, userId, result, calls } = runResume(t, 'resume-apply', sub, {
    args: ['--yes'],
    columns: { tier: 'basic', paused_until: null },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(calls, ['GET /v1/subscriptions/sub_resume_apply', 'POST /v1/subscriptions/sub_resume_apply']);
  // The whole update: the pause cleared, nothing else, so the cancel stays.
  assert.equal(httpCalls(f)[1].body, 'pause_collection=');
  assert.equal(auditCount(f, 'billing_resume_requested', userId), 1);
  const { message } = f.db
    .prepare(`SELECT message FROM audit_events WHERE type = 'billing_resume_requested' AND user_id = ?`)
    .get(userId) as { message: string };
  assert.match(message, /^Operator resume \(make resume-subscription\) for sub sub_resume_apply: was paused until .+; scheduled cancel kept$/);
  assert.match(result.stdout, /^Done\. resume-apply@example\.com is no longer paused\.$/m);
  assert.match(result.stdout, /^ {2}The site has it: tier basic\.$/m);
  assert.match(result.stdout, /^No email was sent\. Tell the member\.$/m);
});

// --- A cancel or a save ends a pause ------------------------------------------
// A plan paused AND canceling contradicted everything the member was told: the
// cancel email said "you keep full access until ..." with access already off,
// and the 25% link or "Keep my plan" put them back on the pause and its charge
// (docs/outreach/2026-11-20-mat-paused-then-canceled.md). Now a cancel ends the
// pause in the same update, so it is a plain cancel, and a save ends it too.

test('endPauseParam: clears pause_collection on a paused plan, and adds nothing otherwise', () => {
  assert.deepEqual(endPauseParam({ behavior: 'void', resumes_at: utc(2027, 2, 20, 20, 21) }), { pause_collection: '' });
  assert.deepEqual(endPauseParam(null), {});
  assert.deepEqual(endPauseParam(undefined), {});
  assert.deepEqual(endPauseParam({ behavior: null }), {});
});

test('scheduleCancelParams: canceling a paused plan ends the pause in the same update', () => {
  assert.deepEqual(
    scheduleCancelParams({
      pauseCollection: { behavior: 'void', resumes_at: utc(2027, 2, 20, 20, 21) },
      feedback: 'too_expensive',
      comment: 'need a bit more time',
    }),
    {
      cancel_at_period_end: true,
      pause_collection: '',
      cancellation_details: { feedback: 'too_expensive', comment: 'need a bit more time' },
    },
  );
});

test('scheduleCancelParams: an unpaused plan gets a plain cancel, with only the reason it was given', () => {
  assert.deepEqual(scheduleCancelParams({ pauseCollection: null }), { cancel_at_period_end: true });
  assert.deepEqual(scheduleCancelParams({ pauseCollection: null, feedback: null, comment: 'just a comment' }), {
    cancel_at_period_end: true,
    cancellation_details: { comment: 'just a comment' },
  });
});

// The operator side, run for real against the stubs. set-cancellation and
// honor-winback-discount write through the sqlite3 CLI.
function runOnPaused(
  t: TestContext,
  script: string,
  name: string,
  sub: ReturnType<typeof pausedSubscription>,
  args: string[],
  extraRoutes: Record<string, unknown> = {},
) {
  const f = busy.fixture(t, `${script.replace(/\.mts$/, '')}-${name}`);
  const email = `${name}@example.com`;
  const resumesAt = sub.pause_collection?.resumes_at;
  const userId = busy.member(f, email, {
    tier: sub.pause_collection ? 'public' : 'basic',
    subscription_status: sub.status,
    stripe_subscription_id: sub.id,
    cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
    paused_until: resumesAt ? new Date(resumesAt * 1000).toISOString() : null,
  });
  const result = busy.run(f, script, ['--email', email, ...args], {
    env: {
      STRIPE_SECRET_KEY: 'sk_test_cancel_ends_pause',
      STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly',
      STRIPE_PRICE_PRO_MONTHLY: 'price_pro_monthly',
    },
    routes: {
      [`GET api.stripe.com/v1/subscriptions/${sub.id}`]: sub,
      [`POST api.stripe.com/v1/subscriptions/${sub.id}`]: { ...sub, cancel_at_period_end: true, pause_collection: null },
      ...extraRoutes,
    },
  });
  const calls = httpCalls(f);
  return { f, email, userId, result, calls, paths: calls.map((c) => `${c.method} ${new URL(c.url).pathname}`) };
}

test('set-cancellation ON=1 on a paused plan ends the pause with the cancel, as the Account page does', { skip: sqlite3Missing }, (t) => {
  const sub = pausedSubscription('sub_on_paused', 'price_basic_monthly', {
    cancelAtPeriodEnd: false,
    billStatus: 'paid',
    billCents: 3900,
  });
  const { f, userId, result, calls, paths } = runOnPaused(t, 'set-cancellation.mts', 'on-paused', sub, ['--on', '--yes']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Paused:\s+yes, until /m);
  assert.match(result.stdout, /The pause ENDS now, so access comes back\. The subscription stays active until .+, then CANCELS/);
  assert.deepEqual(paths, ['GET /v1/subscriptions/sub_on_paused', 'POST /v1/subscriptions/sub_on_paused']);
  const sent = new URLSearchParams(calls[1].body ?? '');
  assert.equal(sent.get('cancel_at_period_end'), 'true');
  assert.equal(sent.get('pause_collection'), '', 'the pause is cleared in the same update');
  assert.equal(column(f, userId, 'cancel_at_period_end'), 1);
  const { message } = f.db
    .prepare(`SELECT message FROM audit_events WHERE type = 'billing_cancellation_set' AND user_id = ?`)
    .get(userId) as { message: string };
  assert.match(message, /; ended its pause \(was paused until .+\)$/);
});

test('set-cancellation ON=1 on a plan that is not paused sends a plain cancel', { skip: sqlite3Missing }, (t) => {
  const sub = pausedSubscription('sub_on_live', 'price_basic_monthly', {
    cancelAtPeriodEnd: false,
    billStatus: 'paid',
    billCents: 3900,
    paused: false,
  });
  const { result, calls } = runOnPaused(t, 'set-cancellation.mts', 'on-live', sub, ['--on', '--yes']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Paused:\s+no$/m);
  assert.match(result.stdout, /^Plan change:\s+none waiting$/m);
  assert.doesNotMatch(result.stdout, /pause ENDS/);
  assert.doesNotMatch(result.stdout, /plan change is DROPPED/);
  const sent = new URLSearchParams(calls[1].body ?? '');
  assert.equal(sent.get('cancel_at_period_end'), 'true');
  assert.equal(sent.has('pause_collection'), false);
});

// --- A cancel drops a plan change the billing portal is holding ---------------
// The portal holds a downgrade until period end on a subscription schedule, and
// Stripe won't set the cancel while one is attached ("updating any cancelation
// behavior directly is not allowed"), so a member who had scheduled Pro -> Basic
// couldn't cancel from the Account page, and neither could this script
// (docs/outreach/2026-11-26-nolan-trial-refund-sandro-cancel-blocked.md). Now
// both release the schedule first (core/pendingPlanChange.ts).

const SCHEDULE_ID = 'sub_sched_portal_downgrade';
const RELEASE_ROUTE = `POST api.stripe.com/v1/subscription_schedules/${SCHEDULE_ID}/release`;

function scheduledSubscription(id: string) {
  return {
    ...pausedSubscription(id, 'price_pro_monthly', { cancelAtPeriodEnd: false, billStatus: 'paid', billCents: 5900, paused: false }),
    schedule: SCHEDULE_ID,
  };
}

test('set-cancellation ON=1 DRY_RUN=1 shows a waiting plan change and changes nothing', { skip: sqlite3Missing }, (t) => {
  const sub = scheduledSubscription('sub_dry_scheduled');
  const { f, userId, result, paths } = runOnPaused(t, 'set-cancellation.mts', 'dry-scheduled', sub, ['--on', '--dry-run']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, new RegExp(`^Plan change:\\s+waiting until period end \\(schedule ${SCHEDULE_ID}\\)$`, 'm'));
  assert.match(result.stdout, /The waiting plan change is DROPPED, so the plan stays as it is now\. The subscription stays active until .+, then CANCELS/);
  assert.match(result.stdout, /\[dry-run\] No Stripe or DB writes\./);
  assert.deepEqual(paths, ['GET /v1/subscriptions/sub_dry_scheduled'], 'a preview only reads');
  assert.equal(column(f, userId, 'cancel_at_period_end'), 0);
});

test('set-cancellation ON=1 with a portal downgrade waiting releases it, then cancels, and records both', { skip: sqlite3Missing }, (t) => {
  const sub = scheduledSubscription('sub_on_scheduled');
  const { f, userId, result, calls, paths } = runOnPaused(t, 'set-cancellation.mts', 'on-scheduled', sub, ['--on', '--yes'], {
    [RELEASE_ROUTE]: { id: SCHEDULE_ID, object: 'subscription_schedule', status: 'released', released_subscription: sub.id },
  });
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.deepEqual(paths, [
    'GET /v1/subscriptions/sub_on_scheduled',
    `POST /v1/subscription_schedules/${SCHEDULE_ID}/release`,
    'POST /v1/subscriptions/sub_on_scheduled',
  ]);
  assert.equal(calls[1].body ?? '', '', 'a plain release: no other change to the subscription');
  const sent = new URLSearchParams(calls[2].body ?? '');
  assert.equal(sent.get('cancel_at_period_end'), 'true');
  assert.equal(column(f, userId, 'cancel_at_period_end'), 1);
  const { message } = f.db
    .prepare(`SELECT message FROM audit_events WHERE type = 'billing_cancellation_set' AND user_id = ?`)
    .get(userId) as { message: string };
  assert.match(message, new RegExp(`; released its waiting plan change \\(schedule ${SCHEDULE_ID}\\) first$`));
});

test('set-cancellation ON=1: if the release fails, nothing else is touched', { skip: sqlite3Missing }, (t) => {
  // No route for the release, so the stub answers 404, as Stripe would for a
  // schedule it doesn't know.
  const sub = scheduledSubscription('sub_release_fails');
  const { f, userId, result, paths } = runOnPaused(t, 'set-cancellation.mts', 'release-fails', sub, ['--on', '--yes']);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, new RegExp(`releasing the waiting plan change \\(schedule ${SCHEDULE_ID}\\) failed`));
  assert.match(result.stderr, /Nothing was changed, in Stripe or the DB\./);
  // The stub logs only the calls it answers, so the refused release shows in
  // Stripe's error, and the cancel (which is stubbed) was never sent.
  assert.match(result.stderr, new RegExp(`No stub for POST api\\.stripe\\.com/v1/subscription_schedules/${SCHEDULE_ID}/release`));
  assert.deepEqual(paths, ['GET /v1/subscriptions/sub_release_fails']);
  assert.equal(column(f, userId, 'cancel_at_period_end'), 0);
  assert.equal(auditCount(f, 'billing_cancellation_set', userId), 0);
});

test('set-cancellation on a plan left paused and canceling says so, either way', { skip: sqlite3Missing }, (t) => {
  const sub = pausedSubscription('sub_half_paused', 'price_basic_monthly', {
    cancelAtPeriodEnd: true,
    billStatus: 'paid',
    billCents: 0,
  });
  // OFF: taking the cancel off leaves the pause, so it does not "RENEW as normal".
  const off = runOnPaused(t, 'set-cancellation.mts', 'half-paused-off', sub, ['--off', '--dry-run']);
  assert.equal(off.result.status, 0, off.result.stderr + off.result.stdout);
  assert.match(off.result.stdout, /^Effect: It stays PAUSED until .+: no access and no charge until then/m);
  assert.doesNotMatch(off.result.stdout, /RENEW/);
  // ON: already canceling, so nothing to set, but the missing access is named.
  const on = runOnPaused(t, 'set-cancellation.mts', 'half-paused-on', sub, ['--on', '--dry-run']);
  assert.equal(on.result.status, 0, on.result.stderr + on.result.stdout);
  assert.match(on.result.stdout, /^Already scheduled to cancel\. Nothing to do\.$/m);
  assert.match(on.result.stdout, /make resume-subscription EMAIL=half-paused-on@example\.com$/m);
  assert.deepEqual(on.paths, ['GET /v1/subscriptions/sub_half_paused']);
});

test('honor-winback-discount refuses a paused plan and points at the resume', { skip: sqlite3Missing }, (t) => {
  const sub = pausedSubscription('sub_winback_paused', 'price_basic_monthly', {
    cancelAtPeriodEnd: true,
    billStatus: 'paid',
    billCents: 0,
  });
  const { result, paths } = runOnPaused(t, 'honor-winback-discount.mts', 'winback-paused', sub, ['--dry-run']);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /sub_winback_paused is PAUSED until /);
  assert.match(result.stderr, /make resume-subscription EMAIL=winback-paused@example\.com$/m);
  assert.doesNotMatch(result.stdout, /RENEW/);
  assert.deepEqual(paths, ['GET /v1/subscriptions/sub_winback_paused'], 'nothing is written');
});
