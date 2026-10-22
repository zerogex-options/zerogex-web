// Moving a Creator Partner's typeable audience code (e.g. PCB25) onto another
// Stripe coupon, keeping the code. scripts/move-partner-promo.mts reads Stripe
// and the auth DB, prints the plan this module makes, and carries it out with
// executePromoMove below.
//
// Why a move is two steps: a Stripe promotion code belongs to the coupon it was
// created on for good, and Stripe allows only one ACTIVE code per string. So
// moving PCB25 means switching off the active PCB25 on the old coupon, then
// creating PCB25 on the new one. Members who already redeemed the old code keep
// the discount they got; only new redemptions change.
//
// Kept PURE (no "@/" alias, no Stripe or DB import) so the standalone script can
// load it and tests/partnerPromoMove.test.ts can pin every branch, including the
// rollback when the second step fails.

/** One Stripe promotion code carrying the partner's code string. */
export type ExistingPromoCode = {
  id: string;
  couponId: string;
  active: boolean;
  /** metadata.partner_user_id, or null when the code carries none. */
  partnerUserId: string | null;
  timesRedeemed: number;
};

export type PromoMoveInput = {
  partnerUserId: string;
  targetCouponId: string;
  /** STRIPE_COUPON_PARTNER_AUDIENCE, or null when it is unset. */
  envCouponId: string | null;
  /**
   * users.partner_audience_coupon_id: the per-partner coupon the ?ref= link
   * applies in place of the env one (getPartnerAudienceCouponId in
   * core/creatorPartners.ts).
   */
  couponOverride: string | null;
  /** Every Stripe promotion code with the partner's code string, on any coupon. */
  existing: ExistingPromoCode[];
};

export type PromoMove = {
  kind: 'move';
  /** Active codes on other coupons, switched off before anything is created. */
  deactivate: ExistingPromoCode[];
  /** True when no active code exists on the target coupon yet. */
  create: boolean;
  /** An active code already on the target that lacks the partner metadata. */
  stampMetadataOn: string | null;
  /**
   * The per-partner coupon override, when it has to change so the link and the
   * typed code apply the same coupon. Null when it is already right.
   */
  couponOverride: { from: string | null; to: string | null } | null;
};

export type PromoMovePlan = { kind: 'refuse'; reason: string } | PromoMove;

export function planPromoMove(input: PromoMoveInput): PromoMovePlan {
  const activeOnTarget = input.existing.find(
    (p) => p.active && p.couponId === input.targetCouponId,
  );
  const activeElsewhere = input.existing.filter(
    (p) => p.active && p.couponId !== input.targetCouponId,
  );

  // Every code this would switch off or keep has to be this partner's. One with
  // no partner metadata is taken to be theirs: the auth DB already gives them
  // this string, and a code made by hand in the Dashboard carries none. One
  // carrying ANOTHER partner's id belongs to someone else and is never touched.
  // Inactive codes are left out entirely: they are history, and a revoked
  // partner's old code keeps their id after the string is given to someone new.
  const touched = activeOnTarget ? [activeOnTarget, ...activeElsewhere] : activeElsewhere;
  const foreign = touched.filter(
    (p) => p.partnerUserId != null && p.partnerUserId !== input.partnerUserId,
  );
  if (foreign.length > 0) {
    return {
      kind: 'refuse',
      reason: foreign
        .map((p) => `${p.id} on ${p.couponId} belongs to partner ${p.partnerUserId}`)
        .join('; '),
    };
  }

  // The link applies the override when one is set, the env coupon otherwise.
  // Keep it on the coupon the typed code is moving to: cleared when that IS the
  // env coupon, so the next change of deal reaches this partner too.
  const wantedOverride = input.targetCouponId === input.envCouponId ? null : input.targetCouponId;
  const couponOverride =
    (input.couponOverride ?? null) === wantedOverride
      ? null
      : { from: input.couponOverride ?? null, to: wantedOverride };

  return {
    kind: 'move',
    deactivate: activeElsewhere,
    create: !activeOnTarget,
    stampMetadataOn:
      activeOnTarget && activeOnTarget.partnerUserId == null ? activeOnTarget.id : null,
    couponOverride,
  };
}

export function isNoOpMove(plan: PromoMove): boolean {
  return (
    plan.deactivate.length === 0 && !plan.create && !plan.stampMetadataOn && !plan.couponOverride
  );
}

/**
 * The Stripe calls a move makes, typed structurally so the script can pass
 * `stripe.promotionCodes` and a test can pass a fake.
 */
export type PromoCodeWriter = {
  update(
    id: string,
    params: { active?: boolean; metadata?: Record<string, string> },
  ): Promise<unknown>;
  create(params: {
    coupon: string;
    code: string;
    metadata: Record<string, string>;
  }): Promise<{ id: string }>;
};

export type PromoMoveOutcome =
  | { ok: true; createdId: string | null; deactivated: string[] }
  | {
      ok: false;
      error: string;
      /** Codes this run switched off, and whether each was switched back on. */
      restored: string[];
      notRestored: string[];
    };

/**
 * Carries out a 'move' plan on Stripe. The old code is switched off before the
 * new one is created, because Stripe refuses a second ACTIVE code with the same
 * string. If anything after the first switch-off fails, every code this run
 * switched off is switched back on, so a failed run leaves the partner with the
 * working code they started with rather than none.
 */
export async function executePromoMove(
  api: PromoCodeWriter,
  plan: PromoMove,
  ctx: { code: string; targetCouponId: string; partnerUserId: string },
): Promise<PromoMoveOutcome> {
  const metadata = { partner_user_id: ctx.partnerUserId };
  const deactivated: string[] = [];
  try {
    for (const p of plan.deactivate) {
      await api.update(p.id, { active: false });
      deactivated.push(p.id);
    }
    let createdId: string | null = null;
    if (plan.create) {
      createdId = (await api.create({ coupon: ctx.targetCouponId, code: ctx.code, metadata })).id;
    } else if (plan.stampMetadataOn) {
      await api.update(plan.stampMetadataOn, { metadata });
    }
    return { ok: true, createdId, deactivated };
  } catch (err) {
    const restored: string[] = [];
    const notRestored: string[] = [];
    for (const id of deactivated) {
      try {
        await api.update(id, { active: true });
        restored.push(id);
      } catch {
        notRestored.push(id);
      }
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      restored,
      notRestored,
    };
  }
}

/** "25% off for 12 months", in the words the Stripe Dashboard uses. */
export function describeCoupon(c: {
  percent_off: number | null;
  amount_off: number | null;
  currency: string | null;
  duration: string;
  duration_in_months: number | null;
}): string {
  const off =
    c.percent_off != null
      ? `${c.percent_off}% off`
      : c.amount_off != null
        ? c.currency == null || c.currency.toLowerCase() === 'usd'
          ? `$${(c.amount_off / 100).toFixed(2)} off`
          : `${(c.amount_off / 100).toFixed(2)} ${c.currency.toUpperCase()} off`
        : 'a discount';
  if (c.duration === 'once') return `${off} once`;
  if (c.duration === 'forever') return `${off} forever`;
  const months = c.duration_in_months ?? 0;
  return `${off} for ${months} month${months === 1 ? '' : 's'}`;
}
