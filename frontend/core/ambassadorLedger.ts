import { randomBytes } from 'crypto';
import type Stripe from 'stripe';
// Relative, extension-qualified imports (NOT the `@/` alias) and NO Stripe/
// mailer imports are deliberate: this module's entire runtime import graph is
// Node-resolvable, so it can be exercised directly by the `node
// --experimental-strip-types --test` runner (the `@/` alias and getStripe() are
// not available there). All Stripe/email/side-effecting orchestration lives in
// core/ambassadors.ts, which wraps this module.
import { getDb } from './db.ts';
import {
  addMonthsIso,
  computeCommissionMinor,
  computeHoldReleaseAt,
  getAmbassadorReviewThresholdMinor,
  getAmbassadorTerms,
  getAmbassadorTermsVersion,
  isAmbassadorAttributionEnabled,
  isAmbassadorProgramEnabled,
  isAttributionWithinWindow,
  maskEmail,
  proportionalReversalMinor,
  type PartnerStatus,
  type RewardPreference,
} from './ambassadorConfig.ts';

// ZeroGEX Ambassador Program — DB + pure-math core (Stripe-free).
//
// Layered onto the SAME plumbing as the Creator Partner Program (see
// core/creatorPartners.ts): an ambassador is a user with partner_tier=
// 'ambassador' and a referral_code, whose referees are attributed via
// users.referred_by_code + the `referrals` ledger and whose commissions accrue
// into the shared `partner_commissions` ledger — tagged partner_type=
// 'ambassador' so creator rows and ambassador rows never interfere.

function nowIso(): string {
  return new Date().toISOString();
}

// Referral-code alphabet + length mirror core/referrals.ts so a code minted here
// follows the same ambiguity rules as one minted by the referral runtime.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 8;
function mintCode(): string {
  const bytes = randomBytes(CODE_LENGTH);
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) out += CODE_ALPHABET[bytes[i] % CODE_ALPHABET.length];
  return out;
}

// Return the user's referral_code, minting + persisting one on first call.
// Retries on the UNIQUE(referral_code) collision, identical to
// core/referrals.ts:getOrCreateReferralCode (duplicated to keep this module's
// import graph Stripe/alias-free, the same way scripts/grant-partner-pro.mts
// duplicates it).
export function ensureReferralCode(userId: string): string {
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
      const fresh = db.prepare('SELECT referral_code FROM users WHERE id = ?').get(userId) as
        | { referral_code: string | null }
        | undefined;
      if (fresh?.referral_code) return fresh.referral_code;
    }
  }
  throw new Error('Could not generate a unique referral code');
}

function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}
export function buildReferralLink(code: string): string {
  return `${appUrl()}/register?ref=${encodeURIComponent(code)}`;
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

export type AmbassadorRow = {
  id: string;
  email: string;
  x_handle: string | null;
  referral_code: string | null;
  partner_tier: string | null;
  partner_status: string | null;
  partner_designation: string | null;
  partner_reward_preference: string;
  partner_commission_bps: number;
  partner_credit_bps: number;
  partner_commission_window_months: number;
  partner_attribution_window_days: number;
  partner_holding_period_days: number;
  partner_pilot_started_at: string | null;
  partner_pilot_ends_at: string | null;
  partner_early_access: number;
  partner_notes: string | null;
  partner_invited_at: string | null;
  partner_accepted_at: string | null;
  partner_activated_at: string | null;
  partner_deactivated_at: string | null;
  partner_terms_version: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  tier: string;
};

const AMBASSADOR_COLUMNS = `
  id, email, x_handle, referral_code, partner_tier, partner_status,
  partner_designation, partner_reward_preference, partner_commission_bps,
  partner_credit_bps, partner_commission_window_months,
  partner_attribution_window_days, partner_holding_period_days,
  partner_pilot_started_at, partner_pilot_ends_at, partner_early_access,
  partner_notes, partner_invited_at, partner_accepted_at, partner_activated_at,
  partner_deactivated_at, partner_terms_version, stripe_customer_id,
  stripe_subscription_id, subscription_status, tier
`;

export function getAmbassadorRow(userId: string): AmbassadorRow | null {
  const row = getDb()
    .prepare(`SELECT ${AMBASSADOR_COLUMNS} FROM users WHERE id = ? AND partner_tier = 'ambassador'`)
    .get(userId) as AmbassadorRow | undefined;
  return row ?? null;
}

export function isAmbassador(row: { partner_tier: string | null } | null | undefined): boolean {
  if (!isAmbassadorProgramEnabled()) return false;
  return row?.partner_tier === 'ambassador';
}

export function isActiveAmbassador(
  row: { partner_tier: string | null; partner_status: string | null } | null | undefined,
): boolean {
  return isAmbassador(row) && row?.partner_status === 'active';
}

// Resolve a referral_code to the ambassador who owns it. `requireActive`
// (default true) additionally requires partner_status='active'.
export function findAmbassadorByReferralCode(code: string, requireActive = true): AmbassadorRow | null {
  if (!isAmbassadorProgramEnabled()) return null;
  const normalized = code.trim().toUpperCase();
  if (!normalized) return null;
  const row = getDb()
    .prepare(
      `SELECT ${AMBASSADOR_COLUMNS} FROM users
       WHERE partner_tier = 'ambassador' AND referral_code = ?`,
    )
    .get(normalized) as AmbassadorRow | undefined;
  if (!row) return null;
  if (requireActive && row.partner_status !== 'active') return null;
  return row;
}

// ---------------------------------------------------------------------------
// Attribution
// ---------------------------------------------------------------------------

export type AttributionOutcome =
  | { recorded: true }
  | { recorded: false; reason: string };

// Record that `refereeUserId` registered under an ACTIVE ambassador's code,
// enforcing the deterministic attribution policy: the referral is honored only
// if the click (`firstTouchAt`) is within the ambassador's attribution window of
// registration (now). Prevents self-referral, never overrides an existing
// attribution (first valid attribution wins), and is idempotent via the
// UNIQUE(referee_user_id) constraint on `referrals`. Stamps partner_type,
// first_touch and expiry for the admin attribution view.
export function recordAmbassadorReferral(
  refereeUserId: string,
  code: string,
  firstTouchAt: string | null,
): AttributionOutcome {
  if (!isAmbassadorAttributionEnabled()) return { recorded: false, reason: 'attribution_disabled' };
  const ambassador = findAmbassadorByReferralCode(code, true);
  if (!ambassador || !ambassador.referral_code) return { recorded: false, reason: 'not_active_ambassador' };
  if (ambassador.id === refereeUserId) return { recorded: false, reason: 'self_referral' };

  const conversionAt = nowIso();
  if (!isAttributionWithinWindow(firstTouchAt, conversionAt, ambassador.partner_attribution_window_days)) {
    return { recorded: false, reason: 'window_expired' };
  }

  const db = getDb();
  const expiresAt = firstTouchAt
    ? addDaysIso(firstTouchAt, ambassador.partner_attribution_window_days)
    : addDaysIso(conversionAt, ambassador.partner_attribution_window_days);

  // First valid attribution wins: never overwrite an existing referred_by_code.
  db.prepare(
    `UPDATE users SET referred_by_code = ?, updated_at = ?
     WHERE id = ? AND referred_by_code IS NULL`,
  ).run(ambassador.referral_code, conversionAt, refereeUserId);

  db.prepare(
    `INSERT OR IGNORE INTO referrals
       (id, referrer_user_id, referee_user_id, code, status, partner_type,
        first_touch_at, attribution_expires_at, created_at)
     VALUES (?, ?, ?, ?, 'pending', 'ambassador', ?, ?, ?)`,
  ).run(
    `ref_${randomBytes(12).toString('hex')}`,
    ambassador.id,
    refereeUserId,
    ambassador.referral_code,
    firstTouchAt,
    expiresAt,
    conversionAt,
  );
  return { recorded: true };
}

function addDaysIso(base: string, days: number): string {
  const t = new Date(base).getTime();
  const ms = (Number.isNaN(t) ? Date.now() : t) + Math.max(0, days) * 24 * 60 * 60 * 1000;
  return new Date(ms).toISOString();
}

// ---------------------------------------------------------------------------
// Invitation & onboarding
// ---------------------------------------------------------------------------

export type InviteAmbassadorInput = {
  userId: string;
  actorUserId: string;
  designation?: string | null;
  rewardPreference?: RewardPreference;
  commissionBps?: number;
  creditBps?: number;
  commissionWindowMonths?: number;
  attributionWindowDays?: number;
  holdingPeriodDays?: number;
  pilotDays?: number | null;
  earlyAccess?: boolean;
  notes?: string | null;
};

// Create/refresh an ambassador profile in 'invited' status. Does NOT enroll the
// user — acceptance is separate. Refuses admins + existing creators (programs
// stay distinct). Pre-mints the referral code so the invite can carry the link.
export function inviteAmbassador(input: InviteAmbassadorInput): AmbassadorRow {
  if (!isAmbassadorProgramEnabled()) throw new Error('Ambassador program is not enabled');
  const db = getDb();
  const user = db
    .prepare('SELECT id, email, tier, partner_tier, partner_status FROM users WHERE id = ?')
    .get(input.userId) as
    | { id: string; email: string; tier: string; partner_tier: string | null; partner_status: string | null }
    | undefined;
  if (!user) throw new Error('User not found');
  if (user.tier === 'admin') throw new Error('Admin accounts cannot be ambassadors');
  if (user.partner_tier === 'creator') {
    throw new Error('User is a Content Creator affiliate; the programs are kept distinct');
  }
  if (user.partner_tier === 'ambassador' && user.partner_status && user.partner_status !== 'invited') {
    throw new Error(`User is already an ambassador (status: ${user.partner_status})`);
  }

  const terms = getAmbassadorTerms();
  const rewardPreference: RewardPreference = input.rewardPreference ?? 'cash';
  const commissionBps = input.commissionBps ?? terms.commissionBps;
  const creditBps = input.creditBps ?? terms.creditBps;
  const commissionWindowMonths = input.commissionWindowMonths ?? terms.commissionWindowMonths;
  const attributionWindowDays = input.attributionWindowDays ?? terms.attributionWindowDays;
  const holdingPeriodDays = input.holdingPeriodDays ?? terms.holdingPeriodDays;
  const pilotDays = input.pilotDays === undefined ? terms.pilotDays : input.pilotDays;

  const stamp = nowIso();
  let pilotStart: string | null = null;
  let pilotEnd: string | null = null;
  if (pilotDays && pilotDays > 0) {
    pilotStart = stamp;
    pilotEnd = new Date(Date.now() + pilotDays * 24 * 60 * 60 * 1000).toISOString();
  }

  const referralCode = ensureReferralCode(input.userId);

  db.prepare(
    `UPDATE users SET
       partner_tier = 'ambassador',
       partner_status = 'invited',
       partner_designation = ?,
       partner_reward_preference = ?,
       partner_commission_bps = ?,
       partner_credit_bps = ?,
       partner_commission_window_months = ?,
       partner_attribution_window_days = ?,
       partner_holding_period_days = ?,
       partner_pilot_started_at = ?,
       partner_pilot_ends_at = ?,
       partner_early_access = ?,
       partner_notes = COALESCE(?, partner_notes),
       partner_invited_at = COALESCE(partner_invited_at, ?),
       updated_at = ?
     WHERE id = ?`,
  ).run(
    input.designation ?? null,
    rewardPreference,
    commissionBps,
    creditBps,
    commissionWindowMonths,
    attributionWindowDays,
    holdingPeriodDays,
    pilotStart,
    pilotEnd,
    input.earlyAccess ? 1 : 0,
    input.notes ?? null,
    stamp,
    stamp,
    input.userId,
  );

  logAudit({
    type: 'ambassador_invited',
    userId: input.userId,
    actorUserId: input.actorUserId,
    email: user.email,
    message: `Invited as ${input.designation ?? 'ZeroGEX Ambassador'} (reward=${rewardPreference}, cashBps=${commissionBps}, creditBps=${creditBps}, code=${referralCode})`,
  });

  const row = getAmbassadorRow(input.userId);
  if (!row) throw new Error('Failed to create ambassador profile');
  return row;
}

// Complete onboarding: invited -> active, recording the chosen reward preference
// and the accepted terms version. Requires current status 'invited'. Idempotent:
// re-calling after activation returns the current row.
export function acceptAmbassadorInvitation(input: {
  userId: string;
  rewardPreference: RewardPreference;
  termsVersion?: string;
}): AmbassadorRow {
  if (!isAmbassadorProgramEnabled()) throw new Error('Ambassador program is not enabled');
  const db = getDb();
  const row = getAmbassadorRow(input.userId);
  if (!row) throw new Error('No ambassador invitation found for this account');
  if (row.partner_status === 'active') return row;
  if (row.partner_status !== 'invited') {
    throw new Error(`Invitation cannot be accepted from status "${row.partner_status}"`);
  }

  ensureReferralCode(input.userId);
  const termsVersion = input.termsVersion ?? getAmbassadorTermsVersion();
  const stamp = nowIso();

  db.prepare(
    `UPDATE users SET
       partner_status = 'active',
       partner_reward_preference = ?,
       partner_terms_version = ?,
       partner_accepted_at = COALESCE(partner_accepted_at, ?),
       partner_activated_at = COALESCE(partner_activated_at, ?),
       updated_at = ?
     WHERE id = ? AND partner_status = 'invited'`,
  ).run(input.rewardPreference, termsVersion, stamp, stamp, stamp, input.userId);

  logAudit({
    type: 'ambassador_activated',
    userId: input.userId,
    email: row.email,
    message: `Accepted terms ${termsVersion}; reward preference ${input.rewardPreference}`,
  });
  return getAmbassadorRow(input.userId) ?? row;
}

// Change reward preference — PROSPECTIVE only (accrual snapshots reward type +
// rate onto each row, so earned rewards are never rewritten).
export function setRewardPreference(userId: string, preference: RewardPreference): AmbassadorRow {
  const db = getDb();
  const row = getAmbassadorRow(userId);
  if (!row) throw new Error('Not an ambassador');
  db.prepare(
    `UPDATE users SET partner_reward_preference = ?, updated_at = ? WHERE id = ? AND partner_tier = 'ambassador'`,
  ).run(preference, nowIso(), userId);
  logAudit({
    type: 'ambassador_reward_preference_changed',
    userId,
    email: row.email,
    message: `Reward preference set to ${preference} (prospective)`,
  });
  return getAmbassadorRow(userId) ?? row;
}

// ---------------------------------------------------------------------------
// Admin management
// ---------------------------------------------------------------------------

export function setAmbassadorStatus(
  userId: string,
  status: PartnerStatus,
  actorUserId: string,
): AmbassadorRow {
  const db = getDb();
  const row = getAmbassadorRow(userId);
  if (!row) throw new Error('Not an ambassador');
  const stamp = nowIso();
  const isDeactivating = status === 'inactive' || status === 'paused' || status === 'rejected';
  db.prepare(
    `UPDATE users SET
       partner_status = ?,
       partner_activated_at = CASE WHEN ? = 'active' THEN COALESCE(partner_activated_at, ?) ELSE partner_activated_at END,
       partner_deactivated_at = CASE WHEN ? = 1 THEN ? ELSE NULL END,
       updated_at = ?
     WHERE id = ? AND partner_tier = 'ambassador'`,
  ).run(status, status, stamp, isDeactivating ? 1 : 0, stamp, stamp, userId);
  logAudit({
    type: 'ambassador_status_changed',
    userId,
    actorUserId,
    email: row.email,
    message: `Status ${row.partner_status ?? '(none)'} -> ${status}`,
  });
  return getAmbassadorRow(userId) ?? row;
}

export function updateAmbassadorTerms(
  userId: string,
  actorUserId: string,
  patch: {
    designation?: string | null;
    rewardPreference?: RewardPreference;
    commissionBps?: number;
    creditBps?: number;
    commissionWindowMonths?: number;
    attributionWindowDays?: number;
    holdingPeriodDays?: number;
    pilotStartAt?: string | null;
    pilotEndAt?: string | null;
    earlyAccess?: boolean;
    notes?: string | null;
  },
): AmbassadorRow {
  const db = getDb();
  const row = getAmbassadorRow(userId);
  if (!row) throw new Error('Not an ambassador');
  const sets: string[] = [];
  const vals: Array<string | number | null> = [];
  const put = (col: string, val: string | number | null) => {
    sets.push(`${col} = ?`);
    vals.push(val);
  };
  if (patch.designation !== undefined) put('partner_designation', patch.designation);
  if (patch.rewardPreference !== undefined) put('partner_reward_preference', patch.rewardPreference);
  if (patch.commissionBps !== undefined) put('partner_commission_bps', patch.commissionBps);
  if (patch.creditBps !== undefined) put('partner_credit_bps', patch.creditBps);
  if (patch.commissionWindowMonths !== undefined)
    put('partner_commission_window_months', patch.commissionWindowMonths);
  if (patch.attributionWindowDays !== undefined)
    put('partner_attribution_window_days', patch.attributionWindowDays);
  if (patch.holdingPeriodDays !== undefined) put('partner_holding_period_days', patch.holdingPeriodDays);
  if (patch.pilotStartAt !== undefined) put('partner_pilot_started_at', patch.pilotStartAt);
  if (patch.pilotEndAt !== undefined) put('partner_pilot_ends_at', patch.pilotEndAt);
  if (patch.earlyAccess !== undefined) put('partner_early_access', patch.earlyAccess ? 1 : 0);
  if (patch.notes !== undefined) put('partner_notes', patch.notes);
  if (sets.length === 0) return row;
  vals.push(nowIso());
  vals.push(userId);
  db.prepare(
    `UPDATE users SET ${sets.join(', ')}, updated_at = ? WHERE id = ? AND partner_tier = 'ambassador'`,
  ).run(...vals);
  logAudit({
    type: 'ambassador_terms_updated',
    userId,
    actorUserId,
    email: row.email,
    message: `Updated: ${sets.map((s) => s.split(' = ')[0]).join(', ')}`,
  });
  return getAmbassadorRow(userId) ?? row;
}

export type AmbassadorSummary = {
  userId: string;
  email: string;
  xHandle: string | null;
  status: string | null;
  designation: string | null;
  referralCode: string | null;
  referralLink: string | null;
  rewardPreference: string;
  commissionBps: number;
  creditBps: number;
  earlyAccess: boolean;
  pilotStartAt: string | null;
  pilotEndAt: string | null;
  invitedAt: string | null;
  acceptedAt: string | null;
  activatedAt: string | null;
  termsVersion: string | null;
  registrations: number;
  payingCustomers: number;
  pendingCashMinor: number;
  payableCashMinor: number;
  paidCashMinor: number;
  creditedMinor: number;
  currency: string;
};

export function listAmbassadors(): AmbassadorSummary[] {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT ${AMBASSADOR_COLUMNS} FROM users
       WHERE partner_tier = 'ambassador'
       ORDER BY partner_invited_at IS NULL, partner_invited_at DESC`,
    )
    .all() as AmbassadorRow[];
  return rows.map((r) => summarize(r));
}

function summarize(r: AmbassadorRow): AmbassadorSummary {
  const funnel = getReferralFunnel(r.id);
  const ledger = summarizeLedger(r.id);
  return {
    userId: r.id,
    email: r.email,
    xHandle: r.x_handle,
    status: r.partner_status,
    designation: r.partner_designation,
    referralCode: r.referral_code,
    referralLink: r.referral_code ? buildReferralLink(r.referral_code) : null,
    rewardPreference: r.partner_reward_preference,
    commissionBps: r.partner_commission_bps,
    creditBps: r.partner_credit_bps,
    earlyAccess: r.partner_early_access === 1,
    pilotStartAt: r.partner_pilot_started_at,
    pilotEndAt: r.partner_pilot_ends_at,
    invitedAt: r.partner_invited_at,
    acceptedAt: r.partner_accepted_at,
    activatedAt: r.partner_activated_at,
    termsVersion: r.partner_terms_version,
    registrations: funnel.registrations,
    payingCustomers: funnel.payingCustomers,
    pendingCashMinor: ledger.pendingCashMinor,
    payableCashMinor: ledger.payableCashMinor,
    paidCashMinor: ledger.paidCashMinor,
    creditedMinor: ledger.creditedMinor,
    currency: ledger.currency,
  };
}

export function searchUsersForInvite(query: string, limit = 15): Array<{
  userId: string;
  email: string;
  tier: string;
  partnerTier: string | null;
  partnerStatus: string | null;
}> {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const rows = getDb()
    .prepare(
      `SELECT id, email, tier, partner_tier, partner_status FROM users
       WHERE tier != 'admin' AND deleted_at IS NULL AND lower(email) LIKE ?
       ORDER BY email LIMIT ?`,
    )
    .all(`%${q}%`, limit) as Array<{
    id: string;
    email: string;
    tier: string;
    partner_tier: string | null;
    partner_status: string | null;
  }>;
  return rows.map((r) => ({
    userId: r.id,
    email: r.email,
    tier: r.tier,
    partnerTier: r.partner_tier,
    partnerStatus: r.partner_status,
  }));
}

// ---------------------------------------------------------------------------
// Commission ledger — accrual (pure DB + integer math, no Stripe)
// ---------------------------------------------------------------------------

export type AmbassadorAccrualOutcome =
  | { kind: 'none'; reason: string }
  | {
      kind: 'accrued';
      rewardType: RewardPreference;
      rewardMinor: number;
      billedMinor: number;
      currency: string;
      ambassadorEmail: string;
      ambassadorUserId: string;
      // True when this is the referee's FIRST paid invoice under this ambassador,
      // so the webhook can send a single "you earned your first commission" email
      // rather than one per renewal.
      isFirstForReferee: boolean;
    }
  | { kind: 'duplicate' };

// Accrue one ambassador commission for a paid invoice. See core/ambassadors.ts
// for how the webhook calls this. Idempotent via UNIQUE(stripe_invoice_id).
export function maybeAccrueAmbassadorCommission(invoice: Stripe.Invoice): AmbassadorAccrualOutcome {
  // Gated on the master switch only — NOT on AMBASSADOR_ATTRIBUTION_DISABLED.
  // That flag pauses NEW attribution (recordAmbassadorReferral); an already-
  // attributed referee's renewals must keep accruing so existing records are
  // preserved when the operator pauses new signups.
  if (!isAmbassadorProgramEnabled()) return { kind: 'none', reason: 'program_disabled' };

  const invoiceId = invoice.id;
  if (!invoiceId) return { kind: 'none', reason: 'no_invoice_id' };
  const customerId = typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
  if (!customerId) return { kind: 'none', reason: 'no_customer' };

  const db = getDb();
  const referee = db
    .prepare('SELECT id, email, referred_by_code FROM users WHERE stripe_customer_id = ?')
    .get(customerId) as { id: string; email: string; referred_by_code: string | null } | undefined;
  if (!referee) return { kind: 'none', reason: 'no_referee' };
  if (!referee.referred_by_code) return { kind: 'none', reason: 'organic' };

  const ambassador = findAmbassadorByReferralCode(referee.referred_by_code, true);
  if (!ambassador) return { kind: 'none', reason: 'referrer_not_active_ambassador' };
  if (ambassador.id === referee.id) return { kind: 'none', reason: 'self_referral' };

  const billed = invoice.amount_paid ?? 0;
  if (billed <= 0) return { kind: 'none', reason: 'zero_amount' };
  const currency = invoice.currency ?? 'usd';

  // Commission-duration window, anchored at the referee's FIRST paid invoice
  // under this ambassador.
  const firstAccrual = db
    .prepare(
      `SELECT MIN(created_at) AS m FROM partner_commissions
       WHERE partner_user_id = ? AND referee_user_id = ? AND commission_amount > 0`,
    )
    .get(ambassador.id, referee.id) as { m: string | null };
  const isFirstForReferee = !firstAccrual.m;
  if (firstAccrual.m) {
    const deadline = addMonthsIso(firstAccrual.m, ambassador.partner_commission_window_months);
    if (Date.now() > new Date(deadline).getTime()) return { kind: 'none', reason: 'window_expired' };
  }

  const rewardType: RewardPreference =
    ambassador.partner_reward_preference === 'account_credit' ? 'account_credit' : 'cash';
  const bps =
    rewardType === 'account_credit' ? ambassador.partner_credit_bps : ambassador.partner_commission_bps;
  const rewardMinor = computeCommissionMinor(billed, bps);
  if (rewardMinor <= 0) return { kind: 'none', reason: 'zero_commission' };

  const earnedAt = invoicePaidAtIso(invoice);
  const holdRelease = computeHoldReleaseAt(earnedAt, ambassador.partner_holding_period_days);
  const id = `pc_${randomBytes(12).toString('hex')}`;
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO partner_commissions
        (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount,
         commission_amount, currency, status, partner_type, reward_type,
         commission_bps, excluded_amount, hold_release_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'ambassador', ?, ?, 0, ?, ?, ?)`,
    )
    .run(
      id,
      ambassador.id,
      referee.id,
      invoiceId,
      billed,
      rewardMinor,
      currency,
      rewardType,
      bps,
      holdRelease,
      earnedAt,
      earnedAt,
    ) as { changes: number | bigint };
  if (Number(result.changes) === 0) return { kind: 'duplicate' };
  return {
    kind: 'accrued',
    rewardType,
    rewardMinor,
    billedMinor: billed,
    currency,
    ambassadorEmail: ambassador.email,
    ambassadorUserId: ambassador.id,
    isFirstForReferee,
  };
}

// ---------------------------------------------------------------------------
// Commission ledger — holding-period release (DB claims only; Stripe in wrapper)
// ---------------------------------------------------------------------------

export type CashReleaseResult = { cashReleased: number; heldForReview: number };

// Promote due CASH commissions pending -> payable (pure DB, no Stripe). Rows at/
// above the review threshold are left pending for admin approval. Safe to call
// lazily from a dashboard load.
export function releaseDueCash(): CashReleaseResult {
  const db = getDb();
  const threshold = getAmbassadorReviewThresholdMinor();
  const out: CashReleaseResult = { cashReleased: 0, heldForReview: 0 };
  const due = db
    .prepare(
      `SELECT id, commission_amount FROM partner_commissions
       WHERE partner_type = 'ambassador' AND status = 'pending' AND reward_type = 'cash'
         AND hold_release_at IS NOT NULL AND hold_release_at <= ?`,
    )
    .all(nowIso()) as Array<{ id: string; commission_amount: number }>;
  for (const row of due) {
    if (threshold > 0 && row.commission_amount >= threshold) {
      out.heldForReview += 1;
      continue;
    }
    const claimed = db
      .prepare(
        `UPDATE partner_commissions SET status = 'payable', updated_at = ?
         WHERE id = ? AND status = 'pending'`,
      )
      .run(nowIso(), row.id) as { changes: number | bigint };
    if (Number(claimed.changes) > 0) out.cashReleased += 1;
  }
  return out;
}

export type DueCredit = {
  id: string;
  partnerUserId: string;
  commissionMinor: number;
  currency: string;
};

// Credit commissions whose hold has elapsed and that are under the review
// threshold. The Stripe-applying wrapper claims each via claimCreditRelease.
export function listDueCredits(): DueCredit[] {
  const db = getDb();
  const threshold = getAmbassadorReviewThresholdMinor();
  const rows = db
    .prepare(
      `SELECT id, partner_user_id, commission_amount, currency FROM partner_commissions
       WHERE partner_type = 'ambassador' AND status = 'pending' AND reward_type = 'account_credit'
         AND hold_release_at IS NOT NULL AND hold_release_at <= ?`,
    )
    .all(nowIso()) as Array<{ id: string; partner_user_id: string; commission_amount: number; currency: string }>;
  return rows
    .filter((r) => !(threshold > 0 && r.commission_amount >= threshold))
    .map((r) => ({
      id: r.id,
      partnerUserId: r.partner_user_id,
      commissionMinor: r.commission_amount,
      currency: r.currency,
    }));
}

export type CreditClaim = {
  customerId: string;
  email: string;
  amountMinor: number;
  currency: string;
};

// Atomically claim a pending credit row for application (pending -> credited) so
// only one writer applies the Stripe credit. Returns the details to credit, or
// null if the row was already processed or the partner has no Stripe customer.
export function claimCreditRelease(commissionId: string): CreditClaim | null {
  const db = getDb();
  const row = db
    .prepare(
      `SELECT partner_user_id, commission_amount, currency, reward_type, status
       FROM partner_commissions WHERE id = ? AND partner_type = 'ambassador'`,
    )
    .get(commissionId) as
    | { partner_user_id: string; commission_amount: number; currency: string; reward_type: string; status: string }
    | undefined;
  if (!row || row.reward_type !== 'account_credit' || row.status !== 'pending') return null;
  if (row.commission_amount <= 0) return null;
  const partner = db
    .prepare('SELECT stripe_customer_id, email FROM users WHERE id = ?')
    .get(row.partner_user_id) as { stripe_customer_id: string | null; email: string } | undefined;
  if (!partner?.stripe_customer_id) return null;

  const stamp = nowIso();
  const claimed = db
    .prepare(
      `UPDATE partner_commissions SET status = 'credited', credited_at = ?, updated_at = ?
       WHERE id = ? AND status = 'pending'`,
    )
    .run(stamp, stamp, commissionId) as { changes: number | bigint };
  if (Number(claimed.changes) === 0) return null;
  return {
    customerId: partner.stripe_customer_id,
    email: partner.email,
    amountMinor: row.commission_amount,
    currency: row.currency,
  };
}

// Re-arm a claimed credit row (credited -> pending) after a Stripe failure so
// the next release retries — the reward is never silently lost.
export function revertCreditClaim(commissionId: string): void {
  getDb()
    .prepare(
      `UPDATE partner_commissions SET status = 'pending', credited_at = NULL, updated_at = ?
       WHERE id = ? AND status = 'credited'`,
    )
    .run(nowIso(), commissionId);
}

// ---------------------------------------------------------------------------
// Commission ledger — reversals (DB mutations; Stripe clawbacks returned)
// ---------------------------------------------------------------------------

export type Clawback = { customerId: string; amountMinor: number; currency: string; description: string };
export type ReversalResult = { affected: number; clawbacks: Clawback[] };

// Reverse ambassador commissions for a refunded/disputed invoice, PRESERVING
// ledger history:
//   - pending/payable/approved (not yet settled): reduce proportionally on a
//     partial refund, or flip to reversed/disputed on a full one.
//   - credited/paid (already settled): insert a compensating NEGATIVE row (never
//     a silent delete), idempotently keyed. For a credited reward, a Stripe
//     clawback is returned so the wrapper can debit the customer's credit.
// Proportional for partial refunds, full for full refunds/chargebacks. Never
// throws (pure DB); the wrapper performs the returned clawbacks.
export function reverseAmbassadorLedgerForInvoice(
  invoiceId: string,
  opts: { refundedMinor?: number | null; chargedMinor?: number | null; reason: string; disputed?: boolean },
): ReversalResult {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT id, partner_user_id, referee_user_id, billed_amount, commission_amount,
              excluded_amount, currency, status, reward_type
       FROM partner_commissions
       WHERE stripe_invoice_id = ? AND partner_type = 'ambassador'`,
    )
    .all(invoiceId) as Array<{
    id: string;
    partner_user_id: string;
    referee_user_id: string;
    billed_amount: number;
    commission_amount: number;
    excluded_amount: number;
    currency: string;
    status: string;
    reward_type: string;
  }>;
  const result: ReversalResult = { affected: 0, clawbacks: [] };
  if (rows.length === 0) return result;

  for (const row of rows) {
    const charged = opts.chargedMinor ?? row.billed_amount;
    const refunded = opts.refundedMinor ?? row.billed_amount;
    const isFull = !opts.refundedMinor || !charged || refunded >= charged;

    const stamp = nowIso();
    if (row.status === 'pending' || row.status === 'payable' || row.status === 'approved') {
      // Cumulative semantics: Stripe's amount_refunded is a running total, so
      // reconstruct the ORIGINAL commission (current + already-excluded) and set
      // the reversed portion to the target for the CUMULATIVE refund. This makes
      // repeated partial-refund events (and redeliveries) converge instead of
      // double-reducing.
      const original = row.commission_amount + row.excluded_amount;
      const targetReversed = isFull
        ? original
        : proportionalReversalMinor(original, refunded, charged);
      // Idempotent no-op: we've already reversed at least this much.
      if (!isFull && targetReversed <= row.excluded_amount) continue;

      if (isFull || targetReversed >= original) {
        // Full reversal: restore the whole amount as 'reversed'/'disputed' so the
        // reporting rollups reflect the full reversed value and it's not payable.
        db.prepare(
          `UPDATE partner_commissions
             SET commission_amount = ?, excluded_amount = 0, status = ?, reversal_reason = ?, updated_at = ?
           WHERE id = ? AND status = ?`,
        ).run(original, opts.disputed ? 'disputed' : 'reversed', opts.reason, stamp, row.id, row.status);
      } else {
        db.prepare(
          `UPDATE partner_commissions
             SET commission_amount = ?, excluded_amount = ?, reversal_reason = ?, updated_at = ?
           WHERE id = ? AND status = ?`,
        ).run(original - targetReversed, targetReversed, opts.reason, stamp, row.id, row.status);
      }
      result.affected += 1;
      logAudit({
        type: 'ambassador_commission_reversed',
        userId: row.partner_user_id,
        message: `Commission ${row.id} reversed to ${isFull ? original : targetReversed}/${original} ${row.currency} (${opts.reason}) on invoice ${invoiceId}`,
      });
      continue;
    }

    const reverseMinor = isFull
      ? row.commission_amount
      : proportionalReversalMinor(row.commission_amount, refunded, charged);
    if (reverseMinor <= 0) continue;

    if (row.status === 'credited' || row.status === 'paid') {
      const adjKey = `${invoiceId}::rev`;
      const adjId = `pc_${randomBytes(12).toString('hex')}`;
      const inserted = db
        .prepare(
          `INSERT OR IGNORE INTO partner_commissions
            (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount,
             commission_amount, currency, status, partner_type, reward_type,
             commission_bps, excluded_amount, reversal_reason, created_at, updated_at)
           VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'ambassador', ?, NULL, 0, ?, ?, ?)`,
        )
        .run(
          adjId,
          row.partner_user_id,
          row.referee_user_id,
          adjKey,
          -reverseMinor,
          row.currency,
          opts.disputed ? 'disputed' : 'reversed',
          row.reward_type,
          opts.reason,
          stamp,
          stamp,
        ) as { changes: number | bigint };
      if (Number(inserted.changes) === 0) continue; // already compensated
      result.affected += 1;

      if (row.reward_type === 'account_credit') {
        const partner = db
          .prepare('SELECT stripe_customer_id FROM users WHERE id = ?')
          .get(row.partner_user_id) as { stripe_customer_id: string | null } | undefined;
        if (partner?.stripe_customer_id) {
          result.clawbacks.push({
            customerId: partner.stripe_customer_id,
            amountMinor: reverseMinor,
            currency: row.currency,
            description: `ZeroGEX Ambassador credit clawback (${opts.reason}, invoice ${invoiceId})`,
          });
        }
      }
      logAudit({
        type: 'ambassador_commission_reversed',
        userId: row.partner_user_id,
        message: `Compensating -${reverseMinor} ${row.currency} for settled commission on invoice ${invoiceId} (${opts.reason})`,
      });
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Commission ledger — admin actions
// ---------------------------------------------------------------------------

// Force a pending CASH commission to payable (admin approval of a reviewed row).
// Returns true if it transitioned. Credit approvals go via claimCreditRelease in
// the Stripe wrapper.
export function forceCashPayable(commissionId: string): boolean {
  const changed = getDb()
    .prepare(
      `UPDATE partner_commissions SET status = 'payable', updated_at = ?
       WHERE id = ? AND partner_type = 'ambassador' AND status = 'pending' AND reward_type = 'cash'`,
    )
    .run(nowIso(), commissionId) as { changes: number | bigint };
  return Number(changed.changes) > 0;
}

export function getCommissionRow(commissionId: string): {
  id: string;
  partnerUserId: string;
  rewardType: string;
  status: string;
} | null {
  const row = getDb()
    .prepare(
      `SELECT id, partner_user_id, reward_type, status FROM partner_commissions
       WHERE id = ? AND partner_type = 'ambassador'`,
    )
    .get(commissionId) as
    | { id: string; partner_user_id: string; reward_type: string; status: string }
    | undefined;
  if (!row) return null;
  return { id: row.id, partnerUserId: row.partner_user_id, rewardType: row.reward_type, status: row.status };
}

export function markCommissionPaid(
  commissionId: string,
  actorUserId: string,
  payoutReference: string | null,
): void {
  const db = getDb();
  const row = getCommissionRow(commissionId);
  if (!row) throw new Error('Commission not found');
  if (row.rewardType !== 'cash') throw new Error('Only cash commissions are marked paid');
  if (row.status !== 'payable') throw new Error(`Cannot pay from status "${row.status}"`);
  const stamp = nowIso();
  db.prepare(
    `UPDATE partner_commissions SET status = 'paid', paid_at = ?, payout_reference = ?, updated_at = ?
     WHERE id = ? AND status = 'payable'`,
  ).run(stamp, payoutReference, stamp, commissionId);
  logAudit({
    type: 'ambassador_commission_paid',
    userId: row.partnerUserId,
    actorUserId,
    message: `Marked commission ${commissionId} paid (ref: ${payoutReference ?? 'none'})`,
  });
}

export function adjustCommission(input: {
  commissionId?: string;
  action: 'cancel' | 'adjust';
  amountMinor?: number;
  partnerUserId?: string;
  refereeUserId?: string;
  currency?: string;
  reason: string;
  actorUserId: string;
}): void {
  const db = getDb();
  const stamp = nowIso();
  if (input.action === 'cancel') {
    if (!input.commissionId) throw new Error('commissionId required to cancel');
    const row = getCommissionRow(input.commissionId);
    if (!row) throw new Error('Commission not found');
    if (row.status === 'paid' || row.status === 'credited') {
      throw new Error('Cannot cancel a settled commission; use a compensating adjustment');
    }
    db.prepare(
      `UPDATE partner_commissions SET status = 'cancelled', reversal_reason = ?, updated_at = ? WHERE id = ?`,
    ).run(input.reason, stamp, input.commissionId);
    logAudit({
      type: 'ambassador_commission_adjusted',
      userId: row.partnerUserId,
      actorUserId: input.actorUserId,
      message: `Cancelled commission ${input.commissionId}: ${input.reason}`,
    });
    return;
  }
  if (!input.partnerUserId || typeof input.amountMinor !== 'number') {
    throw new Error('partnerUserId and amountMinor required to adjust');
  }
  const id = `pc_${randomBytes(12).toString('hex')}`;
  db.prepare(
    `INSERT INTO partner_commissions
      (id, partner_user_id, referee_user_id, stripe_invoice_id, billed_amount,
       commission_amount, currency, status, partner_type, reward_type,
       commission_bps, excluded_amount, reversal_reason, created_at, updated_at)
     VALUES (?, ?, ?, ?, 0, ?, ?, 'payable', 'ambassador', 'cash', NULL, 0, ?, ?, ?)`,
  ).run(
    id,
    input.partnerUserId,
    input.refereeUserId ?? input.partnerUserId,
    `manual::${id}`,
    input.amountMinor,
    input.currency ?? 'usd',
    input.reason,
    stamp,
    stamp,
  );
  logAudit({
    type: 'ambassador_commission_adjusted',
    userId: input.partnerUserId,
    actorUserId: input.actorUserId,
    message: `Manual adjustment ${input.amountMinor} ${input.currency ?? 'usd'}: ${input.reason}`,
  });
}

// ---------------------------------------------------------------------------
// Reporting — funnel, ledger summaries, dashboard data, analytics, CSV
// ---------------------------------------------------------------------------

export type ReferralFunnel = { registrations: number; activeTrials: number; payingCustomers: number };

export function getReferralFunnel(ambassadorUserId: string): ReferralFunnel {
  const db = getDb();
  const reg = db
    .prepare(`SELECT COUNT(*) AS c FROM referrals WHERE referrer_user_id = ?`)
    .get(ambassadorUserId) as { c: number };
  const trials = db
    .prepare(
      `SELECT COUNT(*) AS c FROM users u JOIN referrals r ON r.referee_user_id = u.id
       WHERE r.referrer_user_id = ? AND u.subscription_status = 'trialing'`,
    )
    .get(ambassadorUserId) as { c: number };
  const paying = db
    .prepare(
      `SELECT COUNT(*) AS c FROM users u JOIN referrals r ON r.referee_user_id = u.id
       WHERE r.referrer_user_id = ? AND u.subscription_status = 'active'`,
    )
    .get(ambassadorUserId) as { c: number };
  return {
    registrations: Number(reg.c ?? 0),
    activeTrials: Number(trials.c ?? 0),
    payingCustomers: Number(paying.c ?? 0),
  };
}

export type LedgerSummary = {
  pendingCashMinor: number;
  payableCashMinor: number;
  paidCashMinor: number;
  pendingCreditMinor: number;
  creditedMinor: number;
  reversedMinor: number;
  collectedRevenueMinor: number;
  currency: string;
};

export function summarizeLedger(ambassadorUserId: string): LedgerSummary {
  const rows = getDb()
    .prepare(
      `SELECT status, reward_type, commission_amount, billed_amount, currency
       FROM partner_commissions WHERE partner_user_id = ? AND partner_type = 'ambassador'`,
    )
    .all(ambassadorUserId) as Array<{
    status: string;
    reward_type: string;
    commission_amount: number;
    billed_amount: number;
    currency: string;
  }>;
  const s: LedgerSummary = {
    pendingCashMinor: 0,
    payableCashMinor: 0,
    paidCashMinor: 0,
    pendingCreditMinor: 0,
    creditedMinor: 0,
    reversedMinor: 0,
    collectedRevenueMinor: 0,
    currency: 'usd',
  };
  for (const r of rows) {
    if (r.currency) s.currency = r.currency;
    s.collectedRevenueMinor += r.billed_amount;
    if (r.reward_type === 'cash') {
      if (r.status === 'pending' || r.status === 'approved') s.pendingCashMinor += r.commission_amount;
      else if (r.status === 'payable') s.payableCashMinor += r.commission_amount;
      else if (r.status === 'paid') s.paidCashMinor += r.commission_amount;
    } else {
      if (r.status === 'pending' || r.status === 'approved') s.pendingCreditMinor += r.commission_amount;
      else if (r.status === 'credited') s.creditedMinor += r.commission_amount;
    }
    if (r.status === 'reversed' || r.status === 'disputed' || r.status === 'cancelled') {
      s.reversedMinor += Math.abs(r.commission_amount);
    }
  }
  return s;
}

// -- Link-visit tracking ----------------------------------------------------

export function recordAmbassadorVisit(code: string): boolean {
  if (!isAmbassadorProgramEnabled()) return false;
  const ambassador = findAmbassadorByReferralCode(code, false);
  if (!ambassador || !ambassador.referral_code) return false;
  getDb()
    .prepare(
      `INSERT INTO partner_link_visits (code, visits, updated_at) VALUES (?, 1, ?)
       ON CONFLICT(code) DO UPDATE SET visits = visits + 1, updated_at = excluded.updated_at`,
    )
    .run(ambassador.referral_code, nowIso());
  return true;
}

export function getVisitCount(code: string | null): number {
  if (!code) return 0;
  const row = getDb().prepare('SELECT visits FROM partner_link_visits WHERE code = ?').get(code) as
    | { visits: number }
    | undefined;
  return Number(row?.visits ?? 0);
}

// -- Dashboard data (Stripe-free; the wrapper adds the live Stripe balance) --

export type AmbassadorDashboardData = {
  status: PartnerStatus;
  designation: string | null;
  referralCode: string;
  referralLink: string;
  rewardPreference: RewardPreference;
  earlyAccess: boolean;
  stripeCustomerId: string | null;
  terms: {
    commissionPct: number;
    creditPct: number;
    commissionDurationMonths: number;
    holdingPeriodDays: number;
    attributionWindowDays: number;
    version: string | null;
  };
  pilot: { startAt: string | null; endAt: string | null } | null;
  funnel: { visits: number; registrations: number; activeTrials: number; payingCustomers: number };
  earnings: {
    currency: string;
    pendingCashMinor: number;
    payableCashMinor: number;
    paidCashMinor: number;
    pendingCreditMinor: number;
    issuedCreditMinor: number;
  };
  recentReferrals: Array<{ label: string; status: string; createdAt: string }>;
  recentActivity: Array<{
    kind: 'cash' | 'account_credit';
    status: string;
    amountMinor: number;
    currency: string;
    createdAt: string;
  }>;
};

export function getAmbassadorDashboardData(userId: string): AmbassadorDashboardData | null {
  const row = getAmbassadorRow(userId);
  if (!row || !row.referral_code) return null;
  const funnel = getReferralFunnel(userId);
  const ledger = summarizeLedger(userId);
  const db = getDb();

  const recentReferrals = (
    db
      .prepare(
        `SELECT u.email AS email, r.status AS status, r.created_at AS created_at
         FROM referrals r JOIN users u ON u.id = r.referee_user_id
         WHERE r.referrer_user_id = ? ORDER BY r.created_at DESC LIMIT 10`,
      )
      .all(userId) as Array<{ email: string; status: string; created_at: string }>
  ).map((r) => ({ label: maskEmail(r.email), status: r.status, createdAt: r.created_at }));

  const recentActivity = (
    db
      .prepare(
        `SELECT reward_type, status, commission_amount, currency, created_at
         FROM partner_commissions WHERE partner_user_id = ? AND partner_type = 'ambassador'
         ORDER BY created_at DESC LIMIT 10`,
      )
      .all(userId) as Array<{
      reward_type: string;
      status: string;
      commission_amount: number;
      currency: string;
      created_at: string;
    }>
  ).map((c) => ({
    kind: (c.reward_type === 'account_credit' ? 'account_credit' : 'cash') as 'cash' | 'account_credit',
    status: c.status,
    amountMinor: c.commission_amount,
    currency: c.currency,
    createdAt: c.created_at,
  }));

  return {
    status: (row.partner_status as PartnerStatus) ?? 'invited',
    designation: row.partner_designation,
    referralCode: row.referral_code,
    referralLink: buildReferralLink(row.referral_code),
    rewardPreference: row.partner_reward_preference === 'account_credit' ? 'account_credit' : 'cash',
    earlyAccess: row.partner_early_access === 1,
    stripeCustomerId: row.stripe_customer_id,
    terms: {
      commissionPct: row.partner_commission_bps / 100,
      creditPct: row.partner_credit_bps / 100,
      commissionDurationMonths: row.partner_commission_window_months,
      holdingPeriodDays: row.partner_holding_period_days,
      attributionWindowDays: row.partner_attribution_window_days,
      version: row.partner_terms_version,
    },
    pilot:
      row.partner_pilot_started_at || row.partner_pilot_ends_at
        ? { startAt: row.partner_pilot_started_at, endAt: row.partner_pilot_ends_at }
        : null,
    funnel: {
      visits: getVisitCount(row.referral_code),
      registrations: funnel.registrations,
      activeTrials: funnel.activeTrials,
      payingCustomers: funnel.payingCustomers,
    },
    earnings: {
      currency: ledger.currency,
      pendingCashMinor: ledger.pendingCashMinor,
      payableCashMinor: ledger.payableCashMinor,
      paidCashMinor: ledger.paidCashMinor,
      pendingCreditMinor: ledger.pendingCreditMinor,
      issuedCreditMinor: ledger.creditedMinor,
    },
    recentReferrals,
    recentActivity,
  };
}

export type AdminDetail = {
  profile: AmbassadorSummary;
  funnel: ReferralFunnel & { visits: number };
  ledger: LedgerSummary;
  commissions: Array<{
    id: string;
    refereeLabel: string;
    invoiceId: string;
    billedMinor: number;
    rewardMinor: number;
    currency: string;
    status: string;
    rewardType: string;
    holdReleaseAt: string | null;
    createdAt: string;
  }>;
  referrals: Array<{ refereeLabel: string; status: string; createdAt: string; partnerType: string }>;
  notes: string | null;
};

export function getAmbassadorAdminDetail(userId: string): AdminDetail | null {
  const row = getAmbassadorRow(userId);
  if (!row) return null;
  const db = getDb();
  const funnel = getReferralFunnel(userId);
  const ledger = summarizeLedger(userId);

  const commissions = (
    db
      .prepare(
        `SELECT pc.id, u.email AS referee_email, pc.stripe_invoice_id, pc.billed_amount,
                pc.commission_amount, pc.currency, pc.status, pc.reward_type,
                pc.hold_release_at, pc.created_at
         FROM partner_commissions pc LEFT JOIN users u ON u.id = pc.referee_user_id
         WHERE pc.partner_user_id = ? AND pc.partner_type = 'ambassador'
         ORDER BY pc.created_at DESC`,
      )
      .all(userId) as Array<{
      id: string;
      referee_email: string | null;
      stripe_invoice_id: string;
      billed_amount: number;
      commission_amount: number;
      currency: string;
      status: string;
      reward_type: string;
      hold_release_at: string | null;
      created_at: string;
    }>
  ).map((c) => ({
    id: c.id,
    refereeLabel: c.referee_email ?? 'unknown',
    invoiceId: c.stripe_invoice_id,
    billedMinor: c.billed_amount,
    rewardMinor: c.commission_amount,
    currency: c.currency,
    status: c.status,
    rewardType: c.reward_type,
    holdReleaseAt: c.hold_release_at,
    createdAt: c.created_at,
  }));

  const referrals = (
    db
      .prepare(
        `SELECT u.email AS referee_email, r.status AS status, r.created_at AS created_at,
                r.partner_type AS partner_type
         FROM referrals r LEFT JOIN users u ON u.id = r.referee_user_id
         WHERE r.referrer_user_id = ? ORDER BY r.created_at DESC`,
      )
      .all(userId) as Array<{
      referee_email: string | null;
      status: string;
      created_at: string;
      partner_type: string;
    }>
  ).map((r) => ({
    refereeLabel: r.referee_email ?? 'unknown',
    status: r.status,
    createdAt: r.created_at,
    partnerType: r.partner_type,
  }));

  return {
    profile: summarize(row),
    funnel: { ...funnel, visits: getVisitCount(row.referral_code) },
    ledger,
    commissions,
    referrals,
    notes: row.partner_notes,
  };
}

export type ProgramAnalytics = {
  ambassadors: { total: number; active: number; invited: number; paused: number; inactive: number };
  funnel: { visits: number; registrations: number; activeTrials: number; payingCustomers: number };
  money: {
    currency: string;
    collectedRevenueMinor: number;
    pendingCashMinor: number;
    payableCashMinor: number;
    paidCashMinor: number;
    issuedCreditMinor: number;
    reversedMinor: number;
  };
  conversion: { visitToRegistration: number; registrationToPaid: number };
};

export function getProgramAnalytics(): ProgramAnalytics {
  const db = getDb();
  const statusRows = db
    .prepare(
      `SELECT partner_status AS s, COUNT(*) AS c FROM users
       WHERE partner_tier = 'ambassador' GROUP BY partner_status`,
    )
    .all() as Array<{ s: string | null; c: number }>;
  const counts = { total: 0, active: 0, invited: 0, paused: 0, inactive: 0 };
  for (const r of statusRows) {
    counts.total += Number(r.c);
    if (r.s === 'active') counts.active += Number(r.c);
    else if (r.s === 'invited') counts.invited += Number(r.c);
    else if (r.s === 'paused') counts.paused += Number(r.c);
    else if (r.s === 'inactive') counts.inactive += Number(r.c);
  }

  const visits = db
    .prepare(
      `SELECT COALESCE(SUM(v.visits), 0) AS v FROM partner_link_visits v
       JOIN users u ON u.referral_code = v.code WHERE u.partner_tier = 'ambassador'`,
    )
    .get() as { v: number };

  const funnel = db
    .prepare(
      `SELECT COUNT(*) AS registrations,
              SUM(CASE WHEN u.subscription_status = 'trialing' THEN 1 ELSE 0 END) AS trials,
              SUM(CASE WHEN u.subscription_status = 'active' THEN 1 ELSE 0 END) AS paying
       FROM referrals r
       JOIN users a ON a.id = r.referrer_user_id AND a.partner_tier = 'ambassador'
       JOIN users u ON u.id = r.referee_user_id`,
    )
    .get() as { registrations: number | null; trials: number | null; paying: number | null };

  const money = db
    .prepare(
      `SELECT COALESCE(SUM(billed_amount), 0) AS revenue,
              COALESCE(SUM(CASE WHEN reward_type='cash' AND status IN ('pending','approved') THEN commission_amount ELSE 0 END), 0) AS pending_cash,
              COALESCE(SUM(CASE WHEN reward_type='cash' AND status='payable' THEN commission_amount ELSE 0 END), 0) AS payable_cash,
              COALESCE(SUM(CASE WHEN reward_type='cash' AND status='paid' THEN commission_amount ELSE 0 END), 0) AS paid_cash,
              COALESCE(SUM(CASE WHEN reward_type='account_credit' AND status='credited' THEN commission_amount ELSE 0 END), 0) AS issued_credit,
              COALESCE(SUM(CASE WHEN status IN ('reversed','disputed','cancelled') THEN ABS(commission_amount) ELSE 0 END), 0) AS reversed,
              (SELECT currency FROM partner_commissions WHERE partner_type='ambassador' ORDER BY created_at DESC LIMIT 1) AS currency
       FROM partner_commissions WHERE partner_type = 'ambassador'`,
    )
    .get() as {
    revenue: number;
    pending_cash: number;
    payable_cash: number;
    paid_cash: number;
    issued_credit: number;
    reversed: number;
    currency: string | null;
  };

  const registrations = Number(funnel.registrations ?? 0);
  const paying = Number(funnel.paying ?? 0);
  const visitCount = Number(visits.v ?? 0);
  return {
    ambassadors: counts,
    funnel: {
      visits: visitCount,
      registrations,
      activeTrials: Number(funnel.trials ?? 0),
      payingCustomers: paying,
    },
    money: {
      currency: money.currency ?? 'usd',
      collectedRevenueMinor: Number(money.revenue ?? 0),
      pendingCashMinor: Number(money.pending_cash ?? 0),
      payableCashMinor: Number(money.payable_cash ?? 0),
      paidCashMinor: Number(money.paid_cash ?? 0),
      issuedCreditMinor: Number(money.issued_credit ?? 0),
      reversedMinor: Number(money.reversed ?? 0),
    },
    conversion: {
      visitToRegistration: visitCount > 0 ? registrations / visitCount : 0,
      registrationToPaid: registrations > 0 ? paying / registrations : 0,
    },
  };
}

export function exportCommissionsCsv(filterUserId?: string): string {
  const db = getDb();
  const where = filterUserId
    ? `WHERE pc.partner_type = 'ambassador' AND pc.partner_user_id = ?`
    : `WHERE pc.partner_type = 'ambassador'`;
  const rows = db
    .prepare(
      `SELECT pc.id, pa.email AS partner_email, u.email AS referee_email, pc.stripe_invoice_id,
              pc.billed_amount, pc.commission_amount, pc.commission_bps, pc.currency,
              pc.reward_type, pc.status, pc.hold_release_at, pc.created_at, pc.paid_at,
              pc.credited_at, pc.payout_reference, pc.reversal_reason
       FROM partner_commissions pc
       LEFT JOIN users pa ON pa.id = pc.partner_user_id
       LEFT JOIN users u ON u.id = pc.referee_user_id
       ${where} ORDER BY pc.created_at DESC`,
    )
    .all(...(filterUserId ? [filterUserId] : [])) as Array<Record<string, unknown>>;

  const headers = [
    'commission_id',
    'ambassador_email',
    'referee_email',
    'stripe_invoice_id',
    'billed_amount_minor',
    'commission_amount_minor',
    'commission_bps',
    'currency',
    'reward_type',
    'status',
    'hold_release_at',
    'created_at',
    'paid_at',
    'credited_at',
    'payout_reference',
    'reversal_reason',
  ];
  const esc = (v: unknown): string => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.id,
        r.partner_email,
        r.referee_email,
        r.stripe_invoice_id,
        r.billed_amount,
        r.commission_amount,
        r.commission_bps,
        r.currency,
        r.reward_type,
        r.status,
        r.hold_release_at,
        r.created_at,
        r.paid_at,
        r.credited_at,
        r.payout_reference,
        r.reversal_reason,
      ]
        .map(esc)
        .join(','),
    );
  }
  return lines.join('\n');
}

// -- Pilot expiry -----------------------------------------------------------

export function expirePilots(): Array<{ userId: string; email: string }> {
  const db = getDb();
  const due = db
    .prepare(
      `SELECT id, email FROM users
       WHERE partner_tier = 'ambassador' AND partner_status = 'active'
         AND partner_pilot_ends_at IS NOT NULL AND partner_pilot_ends_at < ?`,
    )
    .all(nowIso()) as Array<{ id: string; email: string }>;
  for (const u of due) {
    db.prepare(
      `UPDATE users SET partner_status = 'inactive', partner_deactivated_at = ?, updated_at = ?
       WHERE id = ? AND partner_status = 'active'`,
    ).run(nowIso(), nowIso(), u.id);
    logAudit({
      type: 'ambassador_pilot_expired',
      userId: u.id,
      email: u.email,
      message: 'Pilot window ended; status active -> inactive (prior rewards preserved)',
    });
  }
  return due.map((u) => ({ userId: u.id, email: u.email }));
}

// -- Audit + helpers --------------------------------------------------------

function logAudit(input: {
  type: string;
  userId?: string;
  actorUserId?: string;
  email?: string;
  message: string;
}): void {
  try {
    getDb()
      .prepare(
        `INSERT INTO audit_events (id, type, user_id, actor_user_id, email, ip, message, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        `audit_${randomBytes(12).toString('hex')}`,
        input.type,
        input.userId ?? null,
        input.actorUserId ?? null,
        input.email ?? null,
        'ambassador',
        input.message,
        nowIso(),
      );
  } catch {
    /* audit is best-effort; never break the caller */
  }
}

function invoicePaidAtIso(invoice: Stripe.Invoice): string {
  const paidAt = (invoice as unknown as { status_transitions?: { paid_at?: number | null } })
    .status_transitions?.paid_at;
  if (typeof paidAt === 'number' && paidAt > 0) return new Date(paidAt * 1000).toISOString();
  return nowIso();
}
