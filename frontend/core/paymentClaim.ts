// Pure logic behind ONE question, asked when a member says "you charged me" and
// our records say otherwise: did ZeroGEX ever actually take this person's money?
//
// Why this needs its own module rather than a Dashboard search:
//
//   The Stripe Dashboard's search is keyed on the CUSTOMER. Type an email and
//   you get that customer's payments, invoices and subscriptions — which is
//   exactly the wrong scope for this question, because every way a member's
//   money reaches us without landing on their customer record is invisible to
//   it:
//
//     - a second customer object under a different email (they signed up twice,
//       or Checkout created one from a typed address),
//     - a charge with no customer at all (a Payment Link, a one-off invoice),
//     - an incomplete PaymentIntent, which the Payments list hides by default
//       and which can still have left a real authorization on the statement,
//     - a charge on a customer whose local user row was deleted or never linked.
//
//   In every one of those the honest answer is "yes, we have their money" and
//   the email search says "no payments found". Telling a member who is holding
//   a statement line that they were never charged — when they were — is the
//   worst outcome available to us, so the sweep has to run on something the
//   customer record cannot hide: the CARD itself.
//
//   Stripe assigns every distinct card number a stable `fingerprint`, shared
//   across customers, and charge search can query it. That makes the question
//   answerable account-wide: every charge ever made with this physical card,
//   under any customer, any email, any product, linked or not.
//
// This module holds only the decision and the query construction (unit-tested
// in tests/paymentClaim.test.ts); scripts/trace-payment-claim.mts performs the
// Stripe reads and renders the report.

// A statement line as the member reports it — an amount, maybe a date, maybe
// the last four. Every field is optional because members send what they have.
export type StatementClaim = {
  // Minor units (cents), as parseStatementAmount returns.
  amountMinor: number | null;
  // The date printed on the statement. Card statements show a POSTED date,
  // which trails the authorization by 1-3 business days, so this is a hint for
  // the search window, never an equality test.
  postedDateIso: string | null;
  last4: string | null;
};

const DAY_SECONDS = 24 * 60 * 60;

// How far either side of a reported statement date to search. Posting lags
// authorization, so the window reaches much further BACK than forward: a line
// posted Monday is routinely a charge made the previous Thursday. Forward slack
// exists only for a member reading the authorization date off a pending entry.
export const DEFAULT_LEAD_DAYS = 8;
export const DEFAULT_LAG_DAYS = 3;

/**
 * Parse an amount off a statement into minor units.
 *
 * Accepts "$29.50", "29.50", "29,50" (comma decimal), "1,234.56" and "29".
 * A bare integer is read as DOLLARS ("29" -> 2900), because that is how a
 * member types it; nobody reports a statement line in cents.
 *
 * Returns null for anything it cannot read, so a typo can never silently
 * become a search for $0.00 — a search that would match nothing and produce a
 * confident, wrong "we never charged you".
 */
export function parseStatementAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Strip currency symbols/codes and spaces, keep digits and separators.
  const cleaned = trimmed.replace(/[^\d.,-]/g, '');
  if (!cleaned || cleaned.includes('-')) return null;

  // A strict grammar rather than "find the last separator". The loose version
  // read "29.5.5" as $295.50 — a plausible-looking amount from input nobody
  // meant, which would send the sweep after the wrong number and come back
  // with a confident "no such charge". Anything that is not exactly one of
  // these five shapes is refused instead.
  const GROUPED_COMMA = /^\d{1,3}(?:,\d{3})+(?:\.(\d{1,2}))?$/; // 1,234.56
  const GROUPED_DOT = /^\d{1,3}(?:\.\d{3})+(?:,(\d{1,2}))?$/; // 1.234,56
  const SIMPLE_DECIMAL = /^(\d+)[.,](\d{1,2})$/; // 29.50, 29,50, 29.5
  const THOUSANDS_ONLY = /^(\d+)[.,](\d{3})$/; // 2.500 -> two thousand five hundred
  const PLAIN = /^\d+$/; // 29

  let wholeDigits: string;
  let fraction: string;

  let m: RegExpExecArray | null;
  if ((m = GROUPED_COMMA.exec(cleaned))) {
    wholeDigits = cleaned.split('.')[0].replace(/,/g, '');
    fraction = m[1] ?? '';
  } else if ((m = GROUPED_DOT.exec(cleaned))) {
    wholeDigits = cleaned.split(',')[0].replace(/\./g, '');
    fraction = m[1] ?? '';
  } else if ((m = SIMPLE_DECIMAL.exec(cleaned))) {
    wholeDigits = m[1];
    fraction = m[2];
  } else if ((m = THOUSANDS_ONLY.exec(cleaned))) {
    // Ambiguous by construction ("2.500" is $2,500 in one locale and $2.50 in
    // no locale at all). Read as thousands, matching the grouped forms above.
    wholeDigits = `${m[1]}${m[2]}`;
    fraction = '';
  } else if (PLAIN.test(cleaned)) {
    // A bare integer is DOLLARS. Nobody reports a statement line in cents.
    wholeDigits = cleaned;
    fraction = '';
  } else {
    return null;
  }

  const cents = fraction.padEnd(2, '0');
  const value = Number.parseInt(wholeDigits, 10) * 100 + Number.parseInt(cents || '0', 10);
  return Number.isSafeInteger(value) ? value : null;
}

/**
 * The Unix-second window to search around a reported statement date.
 *
 * Returns null for an unparseable date rather than defaulting to "now", so a
 * bad date widens nothing and the caller falls back to an explicit range.
 */
export function statementSearchWindow(input: {
  postedDateIso: string;
  leadDays?: number;
  lagDays?: number;
}): { fromUnix: number; toUnix: number } | null {
  // Only two shapes are accepted: a bare YYYY-MM-DD, and a full ISO timestamp.
  // Date.parse will happily read "sept 13" or "9/13" as SOME date, in the
  // local zone, in the current year, by rules that are implementation-defined —
  // and this tool's entire job is to not produce confident answers from input
  // it only half-understood. An unreadable date is refused so the operator
  // retypes it, rather than searching a window nobody chose.
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(input.postedDateIso);
  const isIsoStamp = /^\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:?\d{2})?$/.test(input.postedDateIso);
  if (!isDateOnly && !isIsoStamp) return null;

  const parsed = Date.parse(isDateOnly ? `${input.postedDateIso}T00:00:00Z` : input.postedDateIso);
  if (!Number.isFinite(parsed)) return null;

  const lead = input.leadDays ?? DEFAULT_LEAD_DAYS;
  const lag = input.lagDays ?? DEFAULT_LAG_DAYS;
  const atUnix = Math.floor(parsed / 1000);
  return {
    fromUnix: atUnix - lead * DAY_SECONDS,
    // +1 day so the lag count includes the whole of the last day.
    toUnix: atUnix + (lag + 1) * DAY_SECONDS,
  };
}

// Stripe search string literals are double-quoted; backslashes and quotes
// inside them have to be escaped or the query is rejected (or, worse, silently
// re-parsed into a different query).
export function quoteSearchValue(value: string): string {
  return `"${value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

export type ChargeSearchQuery = {
  // What this query proves if it hits, for the report.
  label: string;
  // How much weight a hit carries, and it is the difference between an answer
  // and a guess. 'card' means the same physical card, so the money is this
  // person's however it reached us. 'circumstantial' means only the amount, the
  // date or the last four lined up — which every other member paying the same
  // rate also does. A circumstantial hit is a LEAD. It is never evidence that
  // we hold THIS person's money, and decidePaymentClaim will not let it become
  // one.
  strength: 'card' | 'circumstantial';
  query: string;
};

/**
 * Build every charge-search query worth running for a claim.
 *
 * Deliberately several narrow queries rather than one wide OR: Stripe's search
 * caps results per query, and a single OR across fingerprint + email + amount
 * would let a chatty term (an amount every subscription shares) crowd out the
 * decisive one. Run them all, merge by charge id.
 */
export function buildChargeSearchQueries(input: {
  fingerprints: string[];
  claim: StatementClaim;
  window: { fromUnix: number; toUnix: number } | null;
}): ChargeSearchQuery[] {
  const queries: ChargeSearchQuery[] = [];
  const windowClause = input.window
    ? ` AND created>${input.window.fromUnix} AND created<${input.window.toUnix}`
    : '';

  // 1. The decisive one. No window: we want this card's WHOLE history with us,
  //    because a claim about September is not evidence about August.
  for (const fingerprint of input.fingerprints) {
    queries.push({
      label: `card fingerprint ${fingerprint}`,
      strength: 'card',
      query: `payment_method_details.card.fingerprint:${quoteSearchValue(fingerprint)}`,
    });
  }

  // NOTE: there is deliberately no billing-email query. Stripe's charge search
  // does not support `billing_details.email` — it rejects the query outright —
  // so a second account under a different email cannot be found charge-side at
  // all. It is found customer-side instead (the caller searches customers by
  // email and by cardholder name) and then through the fingerprints of whatever
  // cards those customers hold.

  // 3. Amount + date window. The weakest — it will collect unrelated members
  //    who pay the same rate — but it is the only query that can run when we
  //    have no card on file at all, which is exactly the "we have no record of
  //    you" case this tool exists for.
  if (input.claim.amountMinor != null) {
    queries.push({
      label: input.window
        ? `amount ${formatMinor(input.claim.amountMinor)} in the statement window`
        : `amount ${formatMinor(input.claim.amountMinor)}`,
      strength: 'circumstantial',
      query: `amount:${input.claim.amountMinor}${windowClause}`,
    });
  }

  // 4. Last four + window, when they gave a card we do not hold. Same weakness
  //    as amount (last4 collides), same reason to run it.
  if (input.claim.last4 && input.fingerprints.length === 0) {
    queries.push({
      label: `card ending ${input.claim.last4}`,
      strength: 'circumstantial',
      query: `payment_method_details.card.last4:${quoteSearchValue(input.claim.last4)}${windowClause}`,
    });
  }

  return queries;
}

export function formatMinor(minor: number, currency = 'usd'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(minor);
  const symbol = currency.toLowerCase() === 'usd' ? '$' : '';
  const body = `${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return `${sign}${symbol}${body}${symbol ? '' : ` ${currency.toUpperCase()}`}`;
}

// One money movement, flattened out of a Stripe charge for the decision.
export type ChargeEvidence = {
  id: string;
  amountMinor: number;
  amountRefundedMinor: number;
  currency: string;
  // Stripe charge status: 'succeeded' | 'pending' | 'failed'.
  status: string;
  createdUnix: number;
  customerId: string | null;
  // The local user this charge's customer maps to, or null when nothing local
  // owns it — the orphan/second-account case this tool exists to surface.
  localUserId: string | null;
  // True when the charge belongs to the very customer we looked up by email.
  onClaimedCustomer: boolean;
  // WHY this charge is in the report, and the only thing that decides whether
  // it can support a verdict:
  //
  //   'card'           the same physical card (fingerprint). Theirs.
  //   'account'        a charge on a Stripe customer we resolved from their own
  //                    email. Theirs.
  //   'circumstantial' the amount, the date or the last four lined up, and
  //                    nothing else did. NOT theirs — or at least not shown to
  //                    be. Every other member on the same rate matches this.
  //
  // The first live run of this tool matched seven charges at the claimed amount
  // inside the claimed window. Five were one unrelated member's dunning
  // retries; two were two more members' successful renewals. Folding those into
  // the total produced "WE HAVE THEIR MONEY — $59.00" about a member whose card
  // had never successfully paid us once. Hence this field.
  matchStrength: ChargeMatchStrength;
  // Card brand/last4 as it appears on the charge, so an operator can hold a
  // lead up against what the member says they paid with.
  cardLabel: string | null;
  disputed: boolean;
  description: string | null;
  invoiceId: string | null;
};

export type ChargeMatchStrength = 'card' | 'account' | 'circumstantial';

export function isAttributable(charge: ChargeEvidence): boolean {
  return charge.matchStrength !== 'circumstantial';
}

function isSettled(charge: ChargeEvidence): boolean {
  // 'pending' counts: it is on their statement and the money is on its way to
  // us. Calling that "not a charge" is the error this module exists to prevent.
  return charge.status === 'succeeded' || charge.status === 'pending';
}

export type PaymentClaimVerdict =
  // Money was collected from THIS person and is still ours. They are right.
  | { kind: 'collected'; netMinor: number; charges: ChargeEvidence[]; unlinked: ChargeEvidence[]; leads: ChargeEvidence[] }
  // Collected from them and given back.
  | { kind: 'refunded'; netMinor: number; charges: ChargeEvidence[]; unlinked: ChargeEvidence[]; leads: ChargeEvidence[] }
  // Their card/accounts show attempts, none of which settled.
  | { kind: 'attempted_only'; charges: ChargeEvidence[]; leads: ChargeEvidence[] }
  // Nothing attributable to them, but charges matched the amount or date. These
  // belong to somebody; whether that somebody is them is not established here.
  | { kind: 'leads_only'; leads: ChargeEvidence[] }
  // A query failed, so "nothing" cannot honestly be claimed.
  | { kind: 'inconclusive'; failedQueries: string[]; leads: ChargeEvidence[] }
  // Nothing matched, on any query, and every query ran.
  | { kind: 'none' };

/**
 * Turn the merged evidence into the one sentence the operator has to be able to
 * say out loud.
 *
 * Two rules do all the work, and they cut in opposite directions on purpose:
 *
 *   1. Only ATTRIBUTABLE charges — same card, or a customer resolved from their
 *      own email — can support "we have your money". A charge that merely
 *      shares an amount and a week with the claim is a lead to run down, and
 *      saying otherwise invents money the member never sent us.
 *
 *   2. "We have no charge from you" requires that NOTHING matched and that
 *      every query actually ran. One settled charge on their card outranks
 *      every local record saying they are unpaid, because the local record is
 *      the thing under suspicion; and a query that errored means the sweep has
 *      a hole in it, which is not the same as a clean sweep.
 *
 * Between those two sits `leads_only`, which is the honest answer far more
 * often than either confident one.
 */
export function decidePaymentClaim(input: {
  charges: ChargeEvidence[];
  // Labels of searches that errored. A hole in the sweep, not an empty result.
  failedQueries?: string[];
}): PaymentClaimVerdict {
  const failedQueries = input.failedQueries ?? [];
  const attributable = input.charges.filter(isAttributable);
  const leads = input.charges.filter((c) => !isAttributable(c) && isSettled(c));

  const settled = attributable.filter(isSettled);
  if (settled.length > 0) {
    const netMinor = settled.reduce((sum, c) => sum + c.amountMinor - c.amountRefundedMinor, 0);
    const unlinked = settled.filter((c) => c.localUserId === null || !c.onClaimedCustomer);
    return netMinor > 0
      ? { kind: 'collected', netMinor, charges: settled, unlinked, leads }
      : { kind: 'refunded', netMinor, charges: settled, unlinked, leads };
  }

  if (attributable.length > 0) return { kind: 'attempted_only', charges: attributable, leads };
  if (leads.length > 0) return { kind: 'leads_only', leads };
  if (failedQueries.length > 0) return { kind: 'inconclusive', failedQueries, leads };
  return { kind: 'none' };
}
