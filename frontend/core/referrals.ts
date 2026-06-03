import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { getAppUrl, getStripe } from '@/core/stripe';
import type { BillingCadence } from '@/core/stripe';

// Master switch. The whole program is inert (no codes minted, no discounts, no
// rewards) unless the operator opts in, mirroring how /founding self-gates on
// its env being fully configured.
export function isReferralProgramEnabled(): boolean {
  return process.env.REFERRAL_PROGRAM_ENABLED === '1';
}

// Referee (the newly-referred friend) discount coupon, keyed by the cadence
// they buy:
//   monthly -> "first month free"  (a 100%-off, duration:once coupon)
//   annual  -> "10% off first year" (a 10%-off, duration:once coupon)
// Returns null when not configured for that cadence, in which case checkout
// simply proceeds without a referral discount.
export function getRefereeCouponId(cadence: BillingCadence): string | null {
  const envKey =
    cadence === 'monthly'
      ? 'STRIPE_COUPON_REFERRAL_REFEREE_MONTHLY'
      : 'STRIPE_COUPON_REFERRAL_REFEREE_ANNUAL';
  const id = process.env[envKey];
  return id && id.length > 0 ? id : null;
}

// Codes are shown to humans and typed into URLs, so drop the visually
// ambiguous glyphs (0/O, 1/I/L). 8 chars over this 32-symbol alphabet is ~40
// bits — collisions are astronomically unlikely, and the UNIQUE index plus
// retry loop below makes a collision a non-event anyway.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;

function mintCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  }
  return out;
}

function nowIso(): string {
  return new Date().toISOString();
}

// Returns the user's existing referral code, minting (and persisting) one on
// first call. Safe under the UNIQUE index: a code collision throws on UPDATE
// and we retry with a fresh code.
export function getOrCreateReferralCode(userId: string): string {
  const db = getDb();
  const row = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId) as
    | { referral_code: string | null }
    | undefined;
  if (!row) throw new Error('User not found');
  if (row.referral_code) return row.referral_code;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = mintCode();
    try {
      db.prepare('UPDATE users SET referral_code = ?, updated_at = ? WHERE id = ?').run(
        code,
        nowIso(),
        userId,
      );
      return code;
    } catch {
      // UNIQUE collision (or a racing writer minted one) — re-read and retry.
      const fresh = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId) as
        | { referral_code: string | null }
        | undefined;
      if (fresh?.referral_code) return fresh.referral_code;
    }
  }
  throw new Error('Could not generate a unique referral code');
}

export function buildReferralLink(code: string): string {
  return `${getAppUrl()}/register?ref=${encodeURIComponent(code)}`;
}

function findUserIdByReferralCode(code: string): string | null {
  const row = getDb()
    .prepare('SELECT id FROM users WHERE referral_code = ?')
    .get(code) as { id: string } | undefined;
  return row?.id ?? null;
}

// Record that `refereeUserId` signed up under `code`. Validates the code maps
// to a real referrer and isn't a self-referral. Idempotent: the UNIQUE
// referee_user_id constraint means a user is only ever attributed once, and a
// repeated call is a silent no-op. Never throws on bad input — a bogus or
// expired code just means the signup is treated as organic.
export function recordReferralSignup(refereeUserId: string, code: string): void {
  if (!isReferralProgramEnabled()) return;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;

  const referrerId = findUserIdByReferralCode(normalized);
  if (!referrerId || referrerId === refereeUserId) return;

  const db = getDb();
  db.prepare('UPDATE users SET referred_by_code = ?, updated_at = ? WHERE id = ?').run(
    normalized,
    nowIso(),
    refereeUserId,
  );
  db.prepare(
    `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referee_user_id, code, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(`ref_${randomBytes(12).toString('hex')}`, referrerId, refereeUserId, normalized, nowIso());
}

type RewardableUser = {
  id: string;
  email: string;
  referred_by_code: string | null;
  referral_credit_months: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
};

// The value, in the smallest currency unit, of ONE month of the plan described
// by `subscription`. Monthly plans -> the line price as-is. Annual plans ->
// price / 12 (the agreed fixed-dollar equivalent of a free month). Returns
// null if the price can't be read.
function monthlyValueFromSubscription(
  subscription: Stripe.Subscription,
): { amount: number; currency: string } | null {
  const item = subscription.items?.data?.[0];
  const price = item?.price;
  const unit = price?.unit_amount;
  if (typeof unit !== 'number' || !price?.currency) return null;
  const interval = price.recurring?.interval;
  const count = price.recurring?.interval_count ?? 1;
  if (interval === 'year') {
    return { amount: Math.round(unit / (12 * count)), currency: price.currency };
  }
  // Treat month (and anything else, e.g. week) as a single-month charge.
  return { amount: Math.round(unit / count), currency: price.currency };
}

// Apply `amount` (smallest currency unit, > 0) as account credit on the
// customer's Stripe balance. A NEGATIVE balance transaction is a credit that
// Stripe auto-applies to the next invoice.
async function creditCustomerBalance(
  customerId: string,
  amount: number,
  currency: string,
  description: string,
): Promise<void> {
  if (amount <= 0) return;
  await getStripe().customers.createBalanceTransaction(customerId, {
    amount: -amount,
    currency,
    description,
  });
}

type RewardOutcome =
  | { kind: 'none' }
  | { kind: 'credited'; amount: number; currency: string }
  | { kind: 'banked' }
  | { kind: 'error'; message: string };

// Called from the Stripe webhook when `refereeUserId`'s subscription goes
// active (their first paid invoice). Converts the pending referral and rewards
// the REFERRER with one free month:
//   - referrer has an active sub -> credit one month of THEIR plan to their
//     Stripe balance immediately.
//   - referrer has no active sub -> bank a month in referral_credit_months,
//     redeemed automatically when they later subscribe.
// Latched on referrals.status so webhook retries / repeated sub events can't
// double-reward. Never throws — billing sync must not be unwound by a reward
// hiccup; the audit row records the outcome.
export async function rewardReferrerForConvertedReferee(
  refereeUserId: string,
): Promise<RewardOutcome> {
  if (!isReferralProgramEnabled()) return { kind: 'none' };
  const db = getDb();

  const referral = db
    .prepare(
      `SELECT id, referrer_user_id FROM referrals
       WHERE referee_user_id = ? AND status = 'pending'`,
    )
    .get(refereeUserId) as { id: string; referrer_user_id: string } | undefined;
  if (!referral) return { kind: 'none' };

  // Claim the row first so a concurrent/duplicate webhook can't also reward.
  const claimed = db
    .prepare(
      `UPDATE referrals SET status = 'rewarded', converted_at = ?, rewarded_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(nowIso(), nowIso(), referral.id) as { changes: number | bigint };
  if (Number(claimed.changes) === 0) return { kind: 'none' };

  const referrer = db
    .prepare(
      `SELECT id, email, referred_by_code, referral_credit_months,
              stripe_customer_id, stripe_subscription_id
       FROM users WHERE id = ?`,
    )
    .get(referral.referrer_user_id) as RewardableUser | undefined;
  if (!referrer) return { kind: 'none' };

  // Referrer is actively subscribed -> credit one month of their plan now.
  if (referrer.stripe_customer_id && referrer.stripe_subscription_id) {
    try {
      const sub = await getStripe().subscriptions.retrieve(referrer.stripe_subscription_id);
      if (sub.status === 'active' || sub.status === 'trialing') {
        const monthly = monthlyValueFromSubscription(sub);
        if (monthly && monthly.amount > 0) {
          await creditCustomerBalance(
            referrer.stripe_customer_id,
            monthly.amount,
            monthly.currency,
            `Referral reward: 1 free month (referee ${refereeUserId})`,
          );
          return { kind: 'credited', amount: monthly.amount, currency: monthly.currency };
        }
      }
    } catch (err) {
      // Fall through to banking so the reward isn't lost; record the reason.
      const message = err instanceof Error ? err.message : 'credit failed';
      bankMonth(referrer.id);
      return { kind: 'error', message };
    }
  }

  // No active subscription -> bank a month for later redemption.
  bankMonth(referrer.id);
  return { kind: 'banked' };
}

function bankMonth(userId: string): void {
  getDb()
    .prepare(
      'UPDATE users SET referral_credit_months = referral_credit_months + 1, updated_at = ? WHERE id = ?',
    )
    .run(nowIso(), userId);
}

// Called from the webhook when a user with banked referral months activates a
// subscription: cash the banked months into a Stripe balance credit worth that
// many months of the plan they just bought, then zero the ledger. Idempotent
// against retries because the column is reset in the same statement that reads
// it (guarded by months > 0). Returns the credited amount, or null if nothing
// was owed / couldn't be priced.
export async function redeemBankedReferralCredit(
  user: RewardableUser,
  subscription: Stripe.Subscription,
): Promise<{ amount: number; currency: string } | null> {
  if (!isReferralProgramEnabled()) return null;
  const months = user.referral_credit_months ?? 0;
  if (months <= 0 || !user.stripe_customer_id) return null;

  const monthly = monthlyValueFromSubscription(subscription);
  if (!monthly || monthly.amount <= 0) return null;

  // Reset first (claim) so a duplicate event can't redeem twice. If the credit
  // call then fails we re-bank, matching the credit-vs-bank fallback above.
  const db = getDb();
  const claimed = db
    .prepare(
      `UPDATE users SET referral_credit_months = 0, updated_at = ?
       WHERE id = ? AND referral_credit_months = ?`,
    )
    .run(nowIso(), user.id, months) as { changes: number | bigint };
  if (Number(claimed.changes) === 0) return null;

  const amount = monthly.amount * months;
  try {
    await creditCustomerBalance(
      user.stripe_customer_id,
      amount,
      monthly.currency,
      `Referral reward: ${months} banked free month(s)`,
    );
    return { amount, currency: monthly.currency };
  } catch {
    db.prepare(
      'UPDATE users SET referral_credit_months = referral_credit_months + ?, updated_at = ? WHERE id = ?',
    ).run(months, nowIso(), user.id);
    return null;
  }
}

export type ReferralStats = {
  code: string;
  link: string;
  totalSignups: number;
  totalConverted: number;
  monthsEarned: number;
  bankedMonths: number;
};

export function getReferralStats(userId: string): ReferralStats {
  const db = getDb();
  const code = getOrCreateReferralCode(userId);

  const counts = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN status = 'rewarded' THEN 1 ELSE 0 END) AS converted
       FROM referrals WHERE referrer_user_id = ?`,
    )
    .get(userId) as { total: number | null; converted: number | null };

  const banked = db
    .prepare('SELECT referral_credit_months FROM users WHERE id = ?')
    .get(userId) as { referral_credit_months: number | null } | undefined;

  const totalConverted = Number(counts.converted ?? 0);
  return {
    code,
    link: buildReferralLink(code),
    totalSignups: Number(counts.total ?? 0),
    totalConverted,
    // Every converted referral earns exactly one free month.
    monthsEarned: totalConverted,
    bankedMonths: Number(banked?.referral_credit_months ?? 0),
  };
}
