import test from 'node:test';
import assert from 'node:assert/strict';

import {
  describeCoupon,
  executePromoMove,
  isNoOpMove,
  planPromoMove,
  type ExistingPromoCode,
  type PromoCodeWriter,
  type PromoMove,
  type PromoMoveInput,
} from '../core/partnerPromoMove.ts';

// Moving a creator's typed code (PCB25) from the old audience coupon to the new
// one. The failure this guards against is quiet: a code switched off and never
// recreated still lets the partner's link work, so nobody notices that typing
// the code at checkout has stopped giving a discount or crediting the partner.

const PARTNER = 'user_partner';
const OLD = 'coupon_old';
const NEW = 'coupon_new';

function code(overrides: Partial<ExistingPromoCode> = {}): ExistingPromoCode {
  return {
    id: 'promo_old',
    couponId: OLD,
    active: true,
    partnerUserId: PARTNER,
    timesRedeemed: 0,
    ...overrides,
  };
}

function input(overrides: Partial<PromoMoveInput> = {}): PromoMoveInput {
  return {
    partnerUserId: PARTNER,
    targetCouponId: NEW,
    envCouponId: NEW,
    couponOverride: null,
    existing: [code()],
    ...overrides,
  };
}

function move(plan: ReturnType<typeof planPromoMove>): PromoMove {
  assert.equal(plan.kind, 'move');
  return plan as PromoMove;
}

test('the ordinary move: switch off the code on the old coupon, create it on the new one', () => {
  const plan = move(planPromoMove(input()));
  assert.deepEqual(
    plan.deactivate.map((p) => p.id),
    ['promo_old'],
  );
  assert.equal(plan.create, true);
  assert.equal(plan.stampMetadataOn, null);
  assert.equal(plan.couponOverride, null);
});

test('already moved: nothing to do, so a re-run is safe', () => {
  const plan = move(
    planPromoMove(
      input({
        existing: [
          code({ active: false }),
          code({ id: 'promo_new', couponId: NEW, active: true }),
        ],
      }),
    ),
  );
  assert.equal(isNoOpMove(plan), true);
});

test('a code that never reached Stripe is simply created on the target', () => {
  const plan = move(planPromoMove(input({ existing: [] })));
  assert.deepEqual(plan.deactivate, []);
  assert.equal(plan.create, true);
});

test('a code made by hand without partner metadata is moved, and the new one carries it', () => {
  const plan = move(planPromoMove(input({ existing: [code({ partnerUserId: null })] })));
  assert.equal(plan.deactivate.length, 1);
  assert.equal(plan.create, true);
});

test('an active code already on the target but missing metadata gets it stamped, not recreated', () => {
  const plan = move(
    planPromoMove(
      input({ existing: [code({ id: 'promo_new', couponId: NEW, partnerUserId: null })] }),
    ),
  );
  assert.equal(plan.create, false);
  assert.equal(plan.stampMetadataOn, 'promo_new');
});

test("an active code carrying another partner's id is never touched", () => {
  const plan = planPromoMove(input({ existing: [code({ partnerUserId: 'user_someone_else' })] }));
  assert.equal(plan.kind, 'refuse');
  assert.match((plan as { reason: string }).reason, /promo_old .*user_someone_else/);
});

test("an inactive code from a revoked partner doesn't block the move", () => {
  const plan = move(
    planPromoMove(
      input({
        existing: [
          code({ id: 'promo_revoked', active: false, partnerUserId: 'user_former_partner' }),
          code(),
        ],
      }),
    ),
  );
  assert.deepEqual(
    plan.deactivate.map((p) => p.id),
    ['promo_old'],
  );
});

test('the link follows the code: an override is cleared when the target is the env coupon', () => {
  const plan = move(planPromoMove(input({ couponOverride: OLD })));
  assert.deepEqual(plan.couponOverride, { from: OLD, to: null });
});

test('the link follows the code: a non-env target becomes the override', () => {
  const plan = move(planPromoMove(input({ targetCouponId: 'coupon_special', envCouponId: NEW })));
  assert.deepEqual(plan.couponOverride, { from: null, to: 'coupon_special' });
});

test('an override already on the target is left alone', () => {
  const plan = move(
    planPromoMove(
      input({ targetCouponId: 'coupon_special', envCouponId: NEW, couponOverride: 'coupon_special' }),
    ),
  );
  assert.equal(plan.couponOverride, null);
});

// A fake of the two Stripe calls, recording what happened and failing on cue.
function fakeStripe(opts: { failCreate?: boolean; failReactivate?: boolean } = {}) {
  const calls: string[] = [];
  const api: PromoCodeWriter = {
    async update(id, params) {
      if (params.active === true && opts.failReactivate) throw new Error('reactivate refused');
      calls.push(
        params.active === false
          ? `off ${id}`
          : params.active === true
            ? `on ${id}`
            : `stamp ${id} ${params.metadata?.partner_user_id}`,
      );
      return {};
    },
    async create(params) {
      if (opts.failCreate) throw new Error('No such coupon: coupon_new');
      calls.push(`create ${params.code} on ${params.coupon} for ${params.metadata.partner_user_id}`);
      return { id: 'promo_created' };
    },
  };
  return { api, calls };
}

const CTX = { code: 'PCB25', targetCouponId: NEW, partnerUserId: PARTNER };

test('execute: the old code goes off BEFORE the new one is created (Stripe allows one active per string)', async () => {
  const { api, calls } = fakeStripe();
  const outcome = await executePromoMove(api, move(planPromoMove(input())), CTX);
  assert.deepEqual(outcome, { ok: true, createdId: 'promo_created', deactivated: ['promo_old'] });
  assert.deepEqual(calls, ['off promo_old', `create PCB25 on ${NEW} for ${PARTNER}`]);
});

test('execute: a failed create switches the old code back on, so the partner keeps a working code', async () => {
  const { api, calls } = fakeStripe({ failCreate: true });
  const outcome = await executePromoMove(api, move(planPromoMove(input())), CTX);
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.ok === false && outcome.restored, ['promo_old']);
  assert.deepEqual(outcome.ok === false && outcome.notRestored, []);
  assert.deepEqual(calls, ['off promo_old', 'on promo_old']);
});

test('execute: a rollback that fails is reported, not swallowed', async () => {
  const { api } = fakeStripe({ failCreate: true, failReactivate: true });
  const outcome = await executePromoMove(api, move(planPromoMove(input())), CTX);
  assert.equal(outcome.ok, false);
  assert.deepEqual(outcome.ok === false && outcome.notRestored, ['promo_old']);
  assert.match(outcome.ok === false ? outcome.error : '', /No such coupon/);
});

test('execute: stamping metadata on a code already on the target', async () => {
  const { api, calls } = fakeStripe();
  const plan = move(
    planPromoMove(input({ existing: [code({ id: 'promo_new', couponId: NEW, partnerUserId: null })] })),
  );
  const outcome = await executePromoMove(api, plan, CTX);
  assert.deepEqual(outcome, { ok: true, createdId: null, deactivated: [] });
  assert.deepEqual(calls, [`stamp promo_new ${PARTNER}`]);
});

test('describeCoupon reads like the Stripe Dashboard', () => {
  const base = { percent_off: 25, amount_off: null, currency: null, duration_in_months: null };
  assert.equal(describeCoupon({ ...base, duration: 'repeating', duration_in_months: 12 }), '25% off for 12 months');
  assert.equal(describeCoupon({ ...base, duration: 'repeating', duration_in_months: 1 }), '25% off for 1 month');
  assert.equal(describeCoupon({ ...base, duration: 'once' }), '25% off once');
  assert.equal(describeCoupon({ ...base, duration: 'forever' }), '25% off forever');
  assert.equal(
    describeCoupon({ percent_off: null, amount_off: 1000, currency: 'usd', duration: 'once', duration_in_months: null }),
    '$10.00 off once',
  );
});
