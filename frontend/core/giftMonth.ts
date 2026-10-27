// Goodwill free months for a paying member, as pure decisions.
//
// A gift is the value of N months of the member's own plan, posted as a CREDIT
// on their Stripe customer balance. Stripe applies a balance to the next
// invoice before charging the card, so a $59 credit makes the next $59 renewal
// free and the member is charged again a month later. It is the same mechanism
// as the referral reward (monthlyValueFromSubscription + creditCustomerBalance
// in core/referrals.ts): the subscription's status, plan and billing date are
// untouched, and the Stripe webhook already treats a renewal settled at zero by
// credit as paid (app/api/webhooks/stripe/route.ts, `fullyCredited`).
//
// The sign is the one thing that must never be wrong: a NEGATIVE balance
// transaction is a credit, a positive one is a debit that Stripe adds to the
// next invoice. giftBalanceTransaction builds the request, and the tests pin it.
//
// Kept free of imports so scripts/gift-month.mts can load it under plain
// `node --experimental-strip-types` (tests/giftMonth.test.ts).

export const MAX_GIFT_MONTHS = 3;

export const GIFT_REF_METADATA_KEY = 'zerogex_gift_ref';

export type PlanPrice = {
  unit_amount?: number | null;
  currency?: string | null;
  recurring?: { interval?: string | null; interval_count?: number | null } | null;
};

/**
 * One month of `price` in the smallest currency unit: a monthly price as it is,
 * an annual one over 12. Null when the price cannot be read. The twin of
 * monthlyValueFromSubscription in core/referrals.ts, which a raw node script
 * cannot import (it pulls in the `@/` path alias).
 */
export function oneMonthOf(
  price: PlanPrice | null | undefined,
): { amount: number; currency: string } | null {
  const unit = price?.unit_amount;
  if (typeof unit !== 'number' || !price?.currency) return null;
  const count = price.recurring?.interval_count ?? 1;
  if (price.recurring?.interval === 'year') {
    return { amount: Math.round(unit / (12 * count)), currency: price.currency };
  }
  return { amount: Math.round(unit / count), currency: price.currency };
}

/**
 * The tag a gift carries in its balance transaction's metadata: one per member
 * per New York calendar day, so running the same gift twice by mistake finds
 * the first instead of crediting twice.
 */
export function giftRef(now: Date): string {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
  return `goodwill-${day}`;
}

export type GiftBalanceTransaction = {
  amount: number;
  currency: string;
  description: string;
  metadata: Record<string, string>;
};

/**
 * The Stripe balance-transaction request for a gift of `months` months worth
 * `monthAmount` each. `amount` is negative: a credit.
 */
export function giftBalanceTransaction(input: {
  months: number;
  monthAmount: number;
  currency: string;
  ref: string;
  userId: string;
  note?: string | null;
}): GiftBalanceTransaction {
  const { months, monthAmount, currency, ref, userId, note } = input;
  if (!Number.isInteger(months) || months < 1 || months > MAX_GIFT_MONTHS) {
    throw new Error(`months must be a whole number from 1 to ${MAX_GIFT_MONTHS}`);
  }
  if (!Number.isInteger(monthAmount) || monthAmount <= 0) {
    throw new Error('a month must be worth a positive whole amount');
  }
  const label = `${months} free month${months === 1 ? '' : 's'}`;
  return {
    amount: -(months * monthAmount),
    currency,
    description: `Goodwill: ${label}${note ? ` (${note})` : ''}`,
    metadata: { [GIFT_REF_METADATA_KEY]: ref, user_id: userId, months: String(months) },
  };
}
