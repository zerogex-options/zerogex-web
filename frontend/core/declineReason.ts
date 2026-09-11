// Why a card was declined, reduced to the handful of categories that actually
// change what you say to the member.
//
// "Declined" is not one thing. A bank blocking an unfamiliar recurring charge
// and an account that was short are opposite problems: the first is fixed by
// the member approving it with their issuer, the second by waiting for a retry,
// using another card, or moving to a cheaper plan. Telling someone whose
// account was empty to "ask your bank to approve it" is noise, and telling
// someone whose issuer blocked it that they can "settle it when funds allow" is
// worse. Until now the only way to tell them apart was opening the Stripe
// dashboard invoice by invoice.
//
// Kept PURE (no imports, plain structural reads) so it is unit-tested without
// Stripe — same discipline as core/stripeInvoice.ts, core/paymentGrace.ts and
// core/trialDunning.ts. The reads are structural for the same reason
// core/stripeInvoice.ts is: a charge can arrive from a webhook rendered in a
// different API version than the one core/stripe.ts pins for our own calls.

export type ChargeDecline = {
  // charge.failure_code, or a PaymentIntent's last_payment_error.code. Usually
  // the coarse bucket ('card_declined'), with the detail in declineCode.
  code: string | null;
  // The issuer's actual reason ('insufficient_funds', 'do_not_honor', …). This
  // is the field that carries the signal; code alone rarely distinguishes.
  declineCode: string | null;
  // The RAW ISO-8583 code the card network returned ('51', '05', …), which is
  // what charge.outcome.network_decline_code holds. Kept separate from
  // declineCode because they are different alphabets: mixing them means a
  // numeric lands in a string lookup and silently classifies as unknown, which
  // is exactly how the first real decline this module saw was mis-read.
  networkDeclineCode: string | null;
  // charge.failure_message — Stripe's customer-facing sentence.
  message: string | null;
  // charge.outcome.seller_message — the plain-English "why" written for the
  // merchant, which is often more specific than failure_message.
  sellerMessage: string | null;
};

// The buckets that map onto distinct things to DO. Deliberately coarse: more
// categories would not change the advice, and a category nobody acts on
// differently is a category that only invites mis-sorting.
export type DeclineCategory =
  // The account did not have the money. Recoverable by time more than effort.
  | 'insufficient_funds'
  // The issuer refused an otherwise-valid card — the classic cross-border /
  // unfamiliar-merchant recurring block. The member has to approve it.
  | 'issuer_block'
  // Something about the card itself is wrong or unusable: expired, mistyped,
  // wrong CVC, not supported for this currency. Needs a different card.
  | 'card_problem'
  // 3DS / SCA step-up was required and not completed.
  | 'authentication_required'
  // Transient on Stripe's or the issuer's side. Very likely to clear by itself.
  | 'try_again'
  // No decline data, or a code we do not map. Never guess here: the neutral
  // copy is correct for every case, a wrong guess is wrong in public.
  | 'unknown';

function obj(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function str(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null;
}

// Decline data off a Stripe Charge. Returns null when the charge shows no sign
// of having failed, so a caller can map over every charge without pre-filtering.
export function readChargeDecline(charge: unknown): ChargeDecline | null {
  const c = obj(charge);
  if (!c) return null;
  const outcome = obj(c.outcome);
  const decline: ChargeDecline = {
    code: str(c.failure_code),
    // outcome.reason is Stripe's NORMALIZED decline code on an issuer decline
    // ('insufficient_funds'), and is the field to trust. decline_code is the
    // same alphabet where a payload carries it. network_decline_code is NOT —
    // it is the raw numeric network code — so it is read separately below.
    declineCode: str(outcome?.reason) ?? str(c.decline_code),
    networkDeclineCode: str(outcome?.network_decline_code),
    message: str(c.failure_message),
    sellerMessage: str(outcome?.seller_message),
  };
  const failedStatus = str(c.status) === 'failed';
  const hasSignal =
    decline.code !== null ||
    decline.declineCode !== null ||
    decline.networkDeclineCode !== null ||
    decline.message !== null;
  if (!failedStatus && !hasSignal) return null;
  return decline;
}

// Decline data off a PaymentIntent (last_payment_error). The invoice-side view
// of the same failure — useful where a charge is not to hand.
export function readPaymentIntentDecline(paymentIntent: unknown): ChargeDecline | null {
  const pi = obj(paymentIntent);
  const err = obj(pi?.last_payment_error);
  if (!err) return null;
  return {
    code: str(err.code),
    declineCode: str(err.decline_code),
    networkDeclineCode: str(err.network_decline_code),
    message: str(err.message),
    sellerMessage: null,
  };
}

// Raw ISO-8583 network codes, for the payloads that carry only
// outcome.network_decline_code. Same categories as the string map — this is a
// second alphabet for the same question, not a second question. Deliberately
// partial: an unlisted code stays 'unknown' rather than being approximated.
const BY_NETWORK_CODE: Record<string, DeclineCategory> = {
  '51': 'insufficient_funds', // not sufficient funds
  '61': 'insufficient_funds', // exceeds withdrawal amount limit
  '65': 'insufficient_funds', // exceeds withdrawal count limit

  '01': 'issuer_block', // refer to card issuer
  '02': 'issuer_block', // refer to card issuer, special condition
  '04': 'issuer_block', // pick up card
  '05': 'issuer_block', // do not honor
  '07': 'issuer_block', // pick up card, special condition
  '12': 'issuer_block', // invalid transaction
  '41': 'issuer_block', // lost card
  '43': 'issuer_block', // stolen card
  '57': 'issuer_block', // transaction not permitted to cardholder
  '59': 'issuer_block', // suspected fraud
  '62': 'issuer_block', // restricted card
  '63': 'issuer_block', // security violation

  '14': 'card_problem', // invalid card number
  '54': 'card_problem', // expired card
  '82': 'card_problem', // negative CAM / CVV results

  '19': 'try_again', // re-enter transaction
  '91': 'try_again', // issuer or switch inoperative
  '96': 'try_again', // system malfunction
};

// '5' and '051' both mean 51. Normalize numeric codes to their two-digit form
// so a leading zero or a stray pad does not defeat the lookup.
function normalizeNetworkCode(raw: string | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^\d+$/.test(trimmed)) return null;
  return String(Number(trimmed)).padStart(2, '0');
}

// Stripe's documented decline_code values, grouped by what the member has to do
// about them. Anything unlisted falls through to 'unknown' rather than being
// forced into the nearest bucket.
const BY_DECLINE_CODE: Record<string, DeclineCategory> = {
  insufficient_funds: 'insufficient_funds',
  // A spending/withdrawal cap is the same conversation as an empty account:
  // wait, use another card, or spend less.
  withdrawal_count_limit_exceeded: 'insufficient_funds',
  card_velocity_exceeded: 'insufficient_funds',

  do_not_honor: 'issuer_block',
  generic_decline: 'issuer_block',
  transaction_not_allowed: 'issuer_block',
  service_not_allowed: 'issuer_block',
  restricted_card: 'issuer_block',
  security_violation: 'issuer_block',
  stop_payment_order: 'issuer_block',
  revocation_of_authorization: 'issuer_block',
  revocation_of_all_authorizations: 'issuer_block',
  no_action_taken: 'issuer_block',
  not_permitted: 'issuer_block',
  // Fraud-flavoured refusals. Same remedy for us (the member must sort it with
  // their issuer), but see declineGuidance: never repeat these to the member.
  fraudulent: 'issuer_block',
  merchant_blacklist: 'issuer_block',
  lost_card: 'issuer_block',
  stolen_card: 'issuer_block',
  pickup_card: 'issuer_block',

  expired_card: 'card_problem',
  incorrect_number: 'card_problem',
  invalid_number: 'card_problem',
  incorrect_cvc: 'card_problem',
  invalid_cvc: 'card_problem',
  incorrect_zip: 'card_problem',
  invalid_expiry_month: 'card_problem',
  invalid_expiry_year: 'card_problem',
  card_not_supported: 'card_problem',
  currency_not_supported: 'card_problem',
  invalid_account: 'card_problem',

  authentication_required: 'authentication_required',

  processing_error: 'try_again',
  issuer_not_available: 'try_again',
  try_again_later: 'try_again',
  approve_with_id: 'try_again',
  reenter_transaction: 'try_again',
};

// The coarse `code` field, consulted only when declineCode says nothing.
// 'card_declined' is deliberately absent: it is the bucket, not the reason, and
// mapping it would turn every unexplained decline into a confident wrong answer.
const BY_CODE: Record<string, DeclineCategory> = {
  expired_card: 'card_problem',
  incorrect_cvc: 'card_problem',
  incorrect_number: 'card_problem',
  invalid_cvc: 'card_problem',
  invalid_expiry_month: 'card_problem',
  invalid_expiry_year: 'card_problem',
  invalid_number: 'card_problem',
  processing_error: 'try_again',
  authentication_required: 'authentication_required',
  insufficient_funds: 'insufficient_funds',
};

export function classifyDecline(decline: ChargeDecline | null): DeclineCategory {
  if (!decline) return 'unknown';
  // Most specific first: Stripe's normalized decline code, then the raw network
  // code, then the coarse failure code.
  const byDecline = decline.declineCode
    ? BY_DECLINE_CODE[decline.declineCode.toLowerCase()]
    : undefined;
  if (byDecline) return byDecline;
  const network = normalizeNetworkCode(decline.networkDeclineCode);
  const byNetwork = network ? BY_NETWORK_CODE[network] : undefined;
  if (byNetwork) return byNetwork;
  const byCode = decline.code ? BY_CODE[decline.code.toLowerCase()] : undefined;
  return byCode ?? 'unknown';
}

// What to actually do about each category, phrased for the operator reading
// `make diagnose-user` and deciding which follow-up to send.
export function declineGuidance(category: DeclineCategory): string {
  switch (category) {
    case 'insufficient_funds':
      return 'Account was short. Retries often clear on their own (payday); offer a cheaper plan or a pause rather than pressing. Do NOT tell them to call their bank.';
    case 'issuer_block':
      return "Issuer refused an otherwise-valid card — common for cross-border recurring charges. They must approve it with their bank, or pay the invoice directly with another card. Never repeat a fraud-flavoured reason back to the member; say the bank declined it.";
    case 'card_problem':
      return 'The card itself is unusable (expired/mistyped/unsupported). They need to update it — the one case where "update your card" is the right ask.';
    case 'authentication_required':
      return '3DS/SCA was not completed. Paying the hosted invoice link walks them through the step-up.';
    case 'try_again':
      return 'Transient on Stripe or the issuer. Very likely to clear on the next automatic retry; no action needed yet.';
    case 'unknown':
      return 'No usable decline code. Use the neutral copy — never guess a reason in customer-facing mail.';
  }
}

// One line for `make diagnose-user`, e.g.
//   insufficient_funds — "Your card has insufficient funds." [card_declined/insufficient_funds]
export function describeDecline(decline: ChargeDecline | null): string {
  if (!decline) return 'no decline data';
  const category = classifyDecline(decline);
  const codes =
    [decline.code, decline.declineCode, decline.networkDeclineCode].filter(Boolean).join('/') ||
    'no code';
  const text = decline.sellerMessage ?? decline.message;
  return text ? `${category} — "${text}" [${codes}]` : `${category} [${codes}]`;
}
