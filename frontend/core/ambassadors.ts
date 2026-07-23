import type Stripe from 'stripe';
import { getStripe } from '@/core/stripe';
import {
  sendAmbassadorInviteEmail,
  sendAmbassadorActivatedEmail,
  sendAmbassadorCommissionEmail,
} from '@/core/mailer';
import * as ledger from '@/core/ambassadorLedger';
import { isAmbassadorProgramEnabled } from '@/core/ambassadorConfig';

// ZeroGEX Ambassador Program — Stripe + email orchestration.
//
// Thin wrapper over core/ambassadorLedger.ts (the Stripe-free, unit-testable
// DB + math core). This layer adds the side effects the ledger deliberately
// avoids: Stripe balance transactions (account-credit rewards + clawbacks),
// reading the live Stripe balance for the dashboard, and transactional email.
// It re-exports the ledger surface the app/API/webhook consume so callers have
// a single import site.

// -- Re-exports (pure DB/logic; see core/ambassadorLedger.ts) ---------------
export {
  getAmbassadorRow,
  isAmbassador,
  isActiveAmbassador,
  findAmbassadorByReferralCode,
  recordAmbassadorReferral,
  acceptAmbassadorInvitation,
  setRewardPreference,
  setAmbassadorStatus,
  updateAmbassadorTerms,
  listAmbassadors,
  searchUsersForInvite,
  maybeAccrueAmbassadorCommission,
  markCommissionPaid,
  adjustCommission,
  getAmbassadorAdminDetail,
  getProgramAnalytics,
  exportCommissionsCsv,
  expirePilots,
  recordAmbassadorVisit,
  getVisitCount,
  buildReferralLink,
} from '@/core/ambassadorLedger';
export type {
  AmbassadorRow,
  AmbassadorSummary,
  AmbassadorAccrualOutcome,
  AmbassadorDashboardData,
  AdminDetail,
  ProgramAnalytics,
  ReferralFunnel,
  LedgerSummary,
  Clawback,
  AttributionOutcome,
  InviteAmbassadorInput,
} from '@/core/ambassadorLedger';

// The same account-credit mechanism the Refer-a-Friend program uses: a NEGATIVE
// customer balance transaction is a credit Stripe auto-applies to the next
// invoice.
async function applyAccountCredit(
  customerId: string,
  amountMinor: number,
  currency: string,
  description: string,
): Promise<void> {
  if (amountMinor <= 0) return;
  await getStripe().customers.createBalanceTransaction(customerId, {
    amount: -amountMinor,
    currency,
    description,
  });
}

// Invite an existing user AND send the invitation email (best-effort — a mailer
// hiccup never unwinds the profile creation). Returns the created profile.
export async function inviteAmbassadorAndNotify(
  input: ledger.InviteAmbassadorInput & { appUrl: string },
): Promise<ledger.AmbassadorRow> {
  const row = ledger.inviteAmbassador(input);
  try {
    await sendAmbassadorInviteEmail(row.email, {
      designation: row.partner_designation,
      acceptUrl: `${input.appUrl.replace(/\/+$/, '')}/account/ambassador`,
    });
  } catch (err) {
    console.error('[ambassadors] invite email failed:', err);
  }
  return row;
}

// Wrap the ledger's invite for callers that don't want the email (CLI/tests).
export const inviteAmbassador = ledger.inviteAmbassador;

// Release all DUE ambassador commissions:
//   - cash rows -> 'payable' (pure DB, via the ledger)
//   - credit rows -> apply a Stripe balance credit, then -> 'credited'
// Credit application claims the row FIRST (so only one writer calls Stripe) and
// re-arms it on failure. Best-effort per row.
export async function releaseAmbassadorCommissions(applyCredits = true): Promise<{
  cashReleased: number;
  creditsIssued: number;
  creditMinorIssued: number;
  heldForReview: number;
  errors: number;
}> {
  const out = { cashReleased: 0, creditsIssued: 0, creditMinorIssued: 0, heldForReview: 0, errors: 0 };
  if (!isAmbassadorProgramEnabled()) return out;

  const cash = ledger.releaseDueCash();
  out.cashReleased = cash.cashReleased;
  out.heldForReview = cash.heldForReview;

  if (!applyCredits) return out;
  for (const due of ledger.listDueCredits()) {
    const claim = ledger.claimCreditRelease(due.id);
    if (!claim) continue;
    try {
      await applyAccountCredit(
        claim.customerId,
        claim.amountMinor,
        claim.currency,
        `ZeroGEX Ambassador credit (commission ${due.id})`,
      );
      out.creditsIssued += 1;
      out.creditMinorIssued += claim.amountMinor;
    } catch (err) {
      ledger.revertCreditClaim(due.id);
      out.errors += 1;
      console.error(`[ambassadors] credit apply failed for ${due.id}:`, err);
    }
  }
  return out;
}

// Admin approval of a reviewed pending commission: cash -> payable; credit ->
// apply now and mark credited.
export async function approveCommission(commissionId: string, actorUserId: string): Promise<void> {
  const row = ledger.getCommissionRow(commissionId);
  if (!row) throw new Error('Commission not found');
  if (row.status !== 'pending') throw new Error(`Cannot approve from status "${row.status}"`);
  if (row.rewardType === 'account_credit') {
    const claim = ledger.claimCreditRelease(commissionId);
    if (claim) {
      try {
        await applyAccountCredit(
          claim.customerId,
          claim.amountMinor,
          claim.currency,
          `ZeroGEX Ambassador credit (commission ${commissionId})`,
        );
      } catch (err) {
        ledger.revertCreditClaim(commissionId);
        throw err;
      }
    }
  } else {
    ledger.forceCashPayable(commissionId);
  }
}

// Reverse ambassador commissions for a refunded/disputed invoice: the ledger
// performs the DB reversal (proportional/full, compensating negatives), and this
// wrapper performs any returned Stripe credit clawbacks. Best-effort on the
// clawback; the ledger row is the source of truth regardless.
export async function reverseAmbassadorCommissionsForInvoice(
  invoiceId: string,
  opts: { refundedMinor?: number | null; chargedMinor?: number | null; reason: string; disputed?: boolean },
): Promise<number> {
  const result = ledger.reverseAmbassadorLedgerForInvoice(invoiceId, opts);
  for (const c of result.clawbacks) {
    try {
      await getStripe().customers.createBalanceTransaction(c.customerId, {
        amount: c.amountMinor, // positive => reduces the customer's credit
        currency: c.currency,
        description: c.description,
      });
    } catch (err) {
      console.error(`[ambassadors] credit clawback failed for invoice ${invoiceId}:`, err);
    }
  }
  return result.affected;
}

// Notify an ambassador that their invitation was accepted / they're active.
export async function notifyAmbassadorActivated(email: string, appUrl: string): Promise<void> {
  try {
    await sendAmbassadorActivatedEmail(email, {
      dashboardUrl: `${appUrl.replace(/\/+$/, '')}/account/ambassador`,
    });
  } catch (err) {
    console.error('[ambassadors] activation email failed:', err);
  }
}

// Build the ambassador's dashboard payload, augmenting the ledger data with the
// live Stripe balance (credit awaiting the next invoice) and lazily releasing
// any DUE CASH so figures don't lag the cron. Never calls Stripe WRITE APIs on a
// read. Returns null if the user isn't an ambassador.
export async function getAmbassadorDashboard(userId: string): Promise<
  (ledger.AmbassadorDashboardData & { earnings: ledger.AmbassadorDashboardData['earnings'] & { creditOnNextBillMinor?: number } }) | null
> {
  // Lazy, side-effect-free cash release (no Stripe writes).
  try {
    ledger.releaseDueCash();
  } catch {
    /* best-effort */
  }
  const data = ledger.getAmbassadorDashboardData(userId);
  if (!data) return null;

  let creditOnNextBillMinor: number | undefined;
  if (data.stripeCustomerId) {
    try {
      const customer = await getStripe().customers.retrieve(data.stripeCustomerId);
      if (!('deleted' in customer) || !customer.deleted) {
        const balance = (customer as Stripe.Customer).balance;
        if (typeof balance === 'number' && balance < 0) creditOnNextBillMinor = -balance;
      }
    } catch {
      /* omit on Stripe hiccup */
    }
  }
  return { ...data, earnings: { ...data.earnings, creditOnNextBillMinor } };
}

// Notify an ambassador of a newly earned commission (best-effort).
export async function notifyCommissionEarned(
  email: string,
  opts: { rewardType: 'cash' | 'account_credit'; amountFormatted: string; appUrl: string },
): Promise<void> {
  try {
    await sendAmbassadorCommissionEmail(email, {
      rewardType: opts.rewardType,
      amountFormatted: opts.amountFormatted,
      dashboardUrl: `${opts.appUrl.replace(/\/+$/, '')}/account/ambassador`,
    });
  } catch (err) {
    console.error('[ambassadors] commission email failed:', err);
  }
}
