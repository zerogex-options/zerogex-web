import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
import { getDb } from '@/core/db';
import { getAppUrl, getStripe } from '@/core/stripe';
import type { BillingCadence } from '@/core/stripe';
import { isCreatorPartnerProgramEnabled } from '@/core/creatorPartners';
import { sendReferralRewardEmail } from '@/core/mailer';

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

type ReferrerLookup = { id: string; referral_code: string | null };

// Resolve a typed-in code to the referrer it identifies. Tries the 8-char
// auto-minted `referral_code` first, then — only when the Creator Partner
// Program is enabled — falls back to `partner_audience_promo_code` so a
// human-readable creator code (e.g. SPYLEVELS25) typed into the same field
// resolves the same way as a link click. Returns the referrer's id PLUS
// their canonical `referral_code` so callers always store the stable
// 8-char string in `referred_by_code` regardless of which path was used.
function findReferrerByCode(code: string): ReferrerLookup | null {
  const db = getDb();
  const direct = db
    .prepare('SELECT id, referral_code FROM users WHERE referral_code = ?')
    .get(code) as ReferrerLookup | undefined;
  if (direct) return direct;
  if (!isCreatorPartnerProgramEnabled()) return null;
  const viaPromo = db
    .prepare(
      `SELECT id, referral_code FROM users
       WHERE partner_audience_promo_code = ? AND partner_tier = 'creator'`,
    )
    .get(code) as ReferrerLookup | undefined;
  return viaPromo ?? null;
}

// Record that `refereeUserId` signed up under `code`. Validates the code maps
// to a real referrer and isn't a self-referral. Idempotent: the UNIQUE
// referee_user_id constraint means a user is only ever attributed once, and a
// repeated call is a silent no-op. Never throws on bad input — a bogus or
// expired code just means the signup is treated as organic.
//
// Accepts both auto-minted referral codes and partner-audience promo codes
// (via findReferrerByCode); whichever path resolves, the stable 8-char
// `referral_code` is what gets stamped on the user row and the referrals
// ledger so Phase 3 commission accrual has one stable join key.
export function recordReferralSignup(refereeUserId: string, code: string): void {
  if (!isReferralProgramEnabled()) return;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return;

  const referrer = findReferrerByCode(normalized);
  if (!referrer || referrer.id === refereeUserId) return;
  const canonicalCode = referrer.referral_code ?? normalized;

  const db = getDb();
  db.prepare('UPDATE users SET referred_by_code = ?, updated_at = ? WHERE id = ?').run(
    canonicalCode,
    nowIso(),
    refereeUserId,
  );
  db.prepare(
    `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referee_user_id, code, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(
    `ref_${randomBytes(12).toString('hex')}`,
    referrer.id,
    refereeUserId,
    canonicalCode,
    nowIso(),
  );
}

// Webhook back-attribution: stamp `referred_by_code` on a referee whose
// signup was originally organic. Caller has already resolved the referrer
// to a creator partner (via promotion_code metadata in the Stripe webhook),
// so we trust the input and ONLY no-op when the referee already has a code
// recorded (link click wins over Stripe-typed promo). Returns true when the
// row was newly attributed, false when it was already set.
export function backAttributeReferral(
  refereeUserId: string,
  referrerUserId: string,
  canonicalCode: string,
): boolean {
  if (!isReferralProgramEnabled()) return false;
  if (refereeUserId === referrerUserId) return false;

  const db = getDb();
  const claimed = db
    .prepare(
      `UPDATE users SET referred_by_code = ?, updated_at = ?
       WHERE id = ? AND referred_by_code IS NULL`,
    )
    .run(canonicalCode, nowIso(), refereeUserId) as { changes: number | bigint };
  if (Number(claimed.changes) === 0) return false;

  db.prepare(
    `INSERT OR IGNORE INTO referrals (id, referrer_user_id, referee_user_id, code, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', ?)`,
  ).run(
    `ref_${randomBytes(12).toString('hex')}`,
    referrerUserId,
    refereeUserId,
    canonicalCode,
    nowIso(),
  );
  return true;
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
//
// Creator Partner Program interaction: if the referrer's partner_tier is
// 'creator', they are compensated via CASH commission on invoice.paid
// (Phase 3 accrual into partner_commissions), not via the standard free
// month. Return 'none' WITHOUT claiming the referral row so Phase 3 can
// still see and transition it. Skipping the claim leaves the row as
// 'pending' forever from the OLD program's point of view; Phase 3
// introduces its own status transitions on that row when it lands. Gated
// on partner_tier rather than program-enabled so that flipping the master
// switch off doesn't retroactively free-month-reward every past creator
// referee.
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

  // Creator partners are on the commission model. Skip the free-month
  // reward BEFORE claiming the referral row (see comment on the function
  // for why). Reading partner_tier from the referrer row directly avoids
  // an extra join and stays valid even after revoke (revoked partners
  // fall back to the free-month path for any NEW referees they attract,
  // which matches the revoke script's intent).
  const referrerPartnerTier = db
    .prepare('SELECT partner_tier FROM users WHERE id = ?')
    .get(referral.referrer_user_id) as { partner_tier: string | null } | undefined;
  if (referrerPartnerTier?.partner_tier === 'creator') return { kind: 'none' };

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
          await notifyRewardSafe(referrer.email, {
            kind: 'credited',
            amountFormatted: formatAmount(monthly.amount, monthly.currency),
          });
          return { kind: 'credited', amount: monthly.amount, currency: monthly.currency };
        }
      }
    } catch (err) {
      // Fall through to banking so the reward isn't lost; record the reason.
      const message = err instanceof Error ? err.message : 'credit failed';
      bankMonth(referrer.id);
      await notifyRewardSafe(referrer.email, { kind: 'banked' });
      return { kind: 'error', message };
    }
  }

  // No active subscription -> bank a month for later redemption.
  bankMonth(referrer.id);
  await notifyRewardSafe(referrer.email, { kind: 'banked' });
  return { kind: 'banked' };
}

// Format a smallest-unit Stripe amount as a human currency string for email.
function formatAmount(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(amount / 100);
  } catch {
    return `${(amount / 100).toFixed(2)} ${currency.toUpperCase()}`;
  }
}

// Best-effort reward notification — a mailer failure (e.g. Resend unset in a
// given env) must never unwind the reward that was already granted.
async function notifyRewardSafe(
  email: string,
  opts: { kind: 'credited' | 'banked'; amountFormatted?: string },
): Promise<void> {
  try {
    await sendReferralRewardEmail(email, { ...opts, accountUrl: `${getAppUrl()}/account` });
  } catch (err) {
    console.error('[referrals] reward email failed:', err);
  }
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
  // Formatted account credit currently sitting on the referrer's Stripe
  // balance that will auto-apply to their next invoice (undefined when none).
  creditOnNextBill?: string;
};

export async function getReferralStats(userId: string): Promise<ReferralStats> {
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

  const userRow = db
    .prepare('SELECT referral_credit_months, stripe_customer_id FROM users WHERE id = ?')
    .get(userId) as { referral_credit_months: number | null; stripe_customer_id: string | null } | undefined;

  // A negative Stripe customer balance is credit Stripe will auto-apply to the
  // next invoice. Best-effort: a Stripe hiccup just omits the figure.
  let creditOnNextBill: string | undefined;
  if (userRow?.stripe_customer_id) {
    try {
      const customer = await getStripe().customers.retrieve(userRow.stripe_customer_id);
      if (!('deleted' in customer) || !customer.deleted) {
        const balance = (customer as Stripe.Customer).balance;
        if (typeof balance === 'number' && balance < 0) {
          creditOnNextBill = formatAmount(-balance, (customer as Stripe.Customer).currency ?? 'usd');
        }
      }
    } catch {
      /* leave creditOnNextBill undefined */
    }
  }

  const totalConverted = Number(counts.converted ?? 0);
  return {
    code,
    link: buildReferralLink(code),
    totalSignups: Number(counts.total ?? 0),
    totalConverted,
    // Every converted referral earns exactly one free month.
    monthsEarned: totalConverted,
    bankedMonths: Number(userRow?.referral_credit_months ?? 0),
    creditOnNextBill,
  };
}
