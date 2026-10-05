// WHERE a failed invoice payment died, not just that it did.
//
// core/stripeDeclineLookup.ts answers "what reason did the decline give" well
// enough to choose the dunning copy. It cannot answer the question underneath:
// did the charge ever reach the issuing bank? "The payment failed." with
// `payment_intent_generic_payment_failed` reads the same whether the issuer
// refused it, Stripe Radar blocked it before authorization, or Stripe never sent
// it at all — and those have opposite remedies. Stripe does say which, on the
// latest charge's `outcome.network_status`:
//
//   approved_by_network      the issuer said yes; something after that failed
//   declined_by_network      the issuer (or the card network) said no
//   not_sent_to_network      Stripe stopped it first — a Radar block
//                            (`outcome.type = 'blocked'`) or an invalid request
//   reversed_after_approval  the issuer approved and Stripe blocked it after
//
// and on the PaymentIntent's `last_payment_error`, which carries the advice
// codes and the error `type` the charge does not.
//
// OBSERVABILITY ONLY. Nothing here feeds the decline category, the dunning
// email, retries, subscription state or access — those keep reading
// core/stripeDeclineLookup.ts exactly as before. This module only decides what
// extra columns land on the payment_declines row.
//
// BEST-EFFORT, every path. Each Stripe read is its own step: a failure is
// written into `errors` and the next step still runs, so whatever WAS obtained
// is kept. Nothing here throws — a webhook that 500s makes Stripe re-send the
// event, and with it the member's dunning email.
//
// NEVER reads card numbers, CVC, client_secret, or the billing details on
// `last_payment_error.payment_method`. Every field is picked by name.

import type Stripe from 'stripe';
import { readInvoicePaymentIntentId } from './stripeInvoice.ts';

/** PaymentIntent `last_payment_error`, as far as diagnosing a decline goes. */
export type PaymentIntentError = {
  /** card_error, invalid_request_error, api_error, … */
  type: string | null;
  code: string | null;
  declineCode: string | null;
  /** confirm_card_data | do_not_try_again | try_again_later */
  adviceCode: string | null;
  /** The network's own 2-digit retry advice. */
  networkAdviceCode: string | null;
  /** Brand-specific 2–4 digit reason the authorization failed. */
  networkDeclineCode: string | null;
  message: string | null;
};

/** The latest charge's `outcome`. */
export type ChargeOutcome = {
  networkStatus: string | null;
  /** authorized | manual_review | issuer_declined | blocked | invalid */
  type: string | null;
  reason: string | null;
  /** normal | elevated | highest | not_assessed | unknown */
  riskLevel: string | null;
  /** 0–100; only with Radar for Fraud Teams. */
  riskScore: number | null;
  /** The Radar rule that matched, by id. */
  rule: string | null;
  sellerMessage: string | null;
  adviceCode: string | null;
  networkAdviceCode: string | null;
  networkDeclineCode: string | null;
};

/** The latest charge's `payment_method_details`, safe fields only. */
export type ChargeMethod = {
  /** card | link | cashapp | … */
  type: string | null;
  brand: string | null;
  /** The network the charge actually ran on — can differ from the brand. */
  network: string | null;
  last4: string | null;
  country: string | null;
  funding: string | null;
  /** pass | fail | unavailable | unchecked */
  postalCheck: string | null;
  cvcCheck: string | null;
  /** 3-D Secure: authenticated | attempt_acknowledged | failed | … */
  threeDSecureResult: string | null;
  threeDSecureResultReason: string | null;
};

export type PaymentFailureDiagnostics = {
  paymentIntentId: string | null;
  /** requires_payment_method, requires_action (3-D Secure pending), … */
  paymentIntentStatus: string | null;
  chargeId: string | null;
  intentError: PaymentIntentError | null;
  outcome: ChargeOutcome | null;
  method: ChargeMethod | null;
  /** One line per step that failed or found nothing. Empty when complete. */
  errors: string[];
};

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function idOf(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  return str(obj(value)?.id);
}

export function readPaymentIntentError(intent: unknown): PaymentIntentError | null {
  const err = obj(obj(intent)?.last_payment_error);
  if (!err) return null;
  return {
    type: str(err.type),
    code: str(err.code),
    declineCode: str(err.decline_code),
    adviceCode: str(err.advice_code),
    networkAdviceCode: str(err.network_advice_code),
    networkDeclineCode: str(err.network_decline_code),
    message: str(err.message),
  };
}

export function readChargeOutcome(charge: unknown): ChargeOutcome | null {
  const outcome = obj(obj(charge)?.outcome);
  if (!outcome) return null;
  return {
    networkStatus: str(outcome.network_status),
    type: str(outcome.type),
    reason: str(outcome.reason),
    riskLevel: str(outcome.risk_level),
    riskScore: num(outcome.risk_score),
    // A bare id, or the expanded rule object.
    rule: idOf(outcome.rule),
    sellerMessage: str(outcome.seller_message),
    adviceCode: str(outcome.advice_code),
    networkAdviceCode: str(outcome.network_advice_code),
    networkDeclineCode: str(outcome.network_decline_code),
  };
}

export function readChargeMethod(charge: unknown): ChargeMethod | null {
  const details = obj(obj(charge)?.payment_method_details);
  if (!details) return null;
  // A Link or wallet charge has no `card`; its type is still the signal.
  const card = obj(details.card);
  const checks = obj(card?.checks);
  const threeDS = obj(card?.three_d_secure);
  return {
    type: str(details.type),
    brand: str(card?.brand),
    network: str(card?.network),
    last4: str(card?.last4),
    country: str(card?.country),
    funding: str(card?.funding),
    postalCheck: str(checks?.address_postal_code_check),
    cvcCheck: str(checks?.cvc_check),
    threeDSecureResult: str(threeDS?.result),
    threeDSecureResultReason: str(threeDS?.result_reason),
  };
}

// What this module needs from a Stripe client. `invoicePayments` is the Invoice
// Payments API (2025-03-31.basil and later); stripe-node 17, which this project
// pins along with the acacia API version, does not have it. It is used only when
// the SDK in hand does, so an SDK upgrade picks it up without a code change and
// the current one never calls an endpoint its API version predates.
type DiagnosticsClient = {
  charges: { retrieve(id: string): Promise<unknown> };
  paymentIntents: { retrieve(id: string, params?: { expand?: string[] }): Promise<unknown> };
  invoicePayments?: {
    list(params: { invoice: string; limit?: number }): Promise<{ data?: unknown[] }>;
  };
};

const MESSAGE_LIMIT = 300;

async function attempt<T>(errors: string[], label: string, call: () => Promise<T>): Promise<T | null> {
  try {
    return await call();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`${label}: ${message.slice(0, MESSAGE_LIMIT)}`);
    return null;
  }
}

// The newest PaymentIntent an Invoice Payments list names.
function latestListedPaymentIntentId(list: { data?: unknown[] } | null): string | null {
  const entries = (list?.data ?? [])
    .map((entry) => obj(entry))
    .filter((entry): entry is Record<string, unknown> => entry !== null)
    .sort((a, b) => (num(b.created) ?? 0) - (num(a.created) ?? 0));
  for (const entry of entries) {
    const id = idOf(obj(entry.payment)?.payment_intent);
    if (id) return id;
  }
  return null;
}

/**
 * Read where a failed invoice payment died.
 *
 * `known` is what core/stripeDeclineLookup.ts already resolved, so the common
 * webhook path costs one extra read (the PaymentIntent, with its latest charge
 * expanded).
 *
 * The PaymentIntent is resolved version-tolerantly, first hit wins:
 *
 *   1. what the decline lookup resolved (it re-reads a basil-shaped event
 *      invoice through our acacia-pinned client, which still names the intent)
 *   2. the invoice in hand: acacia `payment_intent`, or basil
 *      `payments.data[].payment.payment_intent` when the list was included
 *   3. the known charge's own `payment_intent`
 *   4. the Invoice Payments API, when the SDK has it
 *
 * The charge described is the intent's `latest_charge`, which is the attempt
 * that just failed. When the intent cannot be read, the charge the decline
 * lookup found is read directly instead, so the outcome is not lost with it.
 */
export async function collectPaymentFailureDiagnostics(
  stripe: Stripe,
  invoice: unknown,
  known: { paymentIntentId?: string | null; chargeId?: string | null } = {},
): Promise<PaymentFailureDiagnostics> {
  const errors: string[] = [];
  const diagnostics: PaymentFailureDiagnostics = {
    paymentIntentId: null,
    paymentIntentStatus: null,
    chargeId: null,
    intentError: null,
    outcome: null,
    method: null,
    errors,
  };
  try {
    const client = stripe as unknown as DiagnosticsClient;
    const invoiceId = idOf(invoice);
    const knownChargeId = known.chargeId ?? null;
    let charge: unknown = null;

    let intentId = known.paymentIntentId ?? readInvoicePaymentIntentId(invoice);
    if (!intentId && knownChargeId) {
      charge = await attempt(errors, `charges.retrieve ${knownChargeId}`, () =>
        client.charges.retrieve(knownChargeId),
      );
      intentId = idOf(obj(charge)?.payment_intent);
    }
    const invoicePayments = client.invoicePayments;
    if (!intentId && invoiceId && invoicePayments) {
      const list = await attempt(errors, `invoicePayments.list ${invoiceId}`, () =>
        invoicePayments.list({ invoice: invoiceId, limit: 10 }),
      );
      intentId = latestListedPaymentIntentId(list);
    }

    if (intentId) {
      const paymentIntentId = intentId;
      diagnostics.paymentIntentId = paymentIntentId;
      const intent = await attempt(errors, `paymentIntents.retrieve ${paymentIntentId}`, () =>
        client.paymentIntents.retrieve(paymentIntentId, { expand: ['latest_charge'] }),
      );
      diagnostics.paymentIntentStatus = str(obj(intent)?.status);
      diagnostics.intentError = readPaymentIntentError(intent);
      const latest = obj(intent)?.latest_charge;
      if (obj(latest)) {
        charge = latest;
      } else if (typeof latest === 'string' && latest && idOf(charge) !== latest) {
        // Not expanded after all; read it rather than describe an older charge.
        charge =
          (await attempt(errors, `charges.retrieve ${latest}`, () => client.charges.retrieve(latest))) ??
          charge;
      }
    } else {
      errors.push(`no PaymentIntent found for invoice ${invoiceId ?? '(no id)'}`);
    }

    if (!charge && knownChargeId) {
      charge = await attempt(errors, `charges.retrieve ${knownChargeId}`, () =>
        client.charges.retrieve(knownChargeId),
      );
    }

    diagnostics.chargeId = idOf(charge) ?? knownChargeId;
    diagnostics.outcome = readChargeOutcome(charge);
    diagnostics.method = readChargeMethod(charge);
  } catch (err) {
    // Every step above already catches its own Stripe errors; this is the
    // backstop for anything else. Whatever was filled in before it stays.
    const message = err instanceof Error ? err.message : String(err);
    errors.push(`diagnostics: ${message.slice(0, MESSAGE_LIMIT)}`);
  }
  return diagnostics;
}

/**
 * Everything that went wrong reading this failure from Stripe, as one line for
 * the row's `diagnostic_error` and the audit log — or null when nothing did.
 */
export function describeDiagnosticProblems(input: {
  lookupError?: string | null;
  diagnostics?: PaymentFailureDiagnostics | null;
}): string | null {
  const parts: string[] = [];
  if (input.lookupError) parts.push(`decline lookup: ${input.lookupError}`);
  for (const error of input.diagnostics?.errors ?? []) parts.push(error);
  return parts.length > 0 ? parts.join('; ').slice(0, 1000) : null;
}
