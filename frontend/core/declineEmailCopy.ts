// What a dunning email should actually SAY, given what the issuer said.
//
// THE BUG THIS EXISTS TO FIX. Both payment-failure emails used one sentence for
// every decline: "your card was declined — update your card". A live count put
// 63 declined invoices in the `insufficient_funds` category, 60 of them a
// member's first payment, $2,177.50 never collected and a recovery rate of 16%.
//
// For every one of those the card was FINE. There was nothing to update and
// nothing to re-enter. The email sent them to look at a card that worked, where
// they would find nothing wrong and conclude the fault was ours. Meanwhile the
// one action that would have collected the money — pay the open invoice, from
// any card, the moment the balance is there — was never mentioned.
//
// core/declineReason.ts has known since it was written that these are opposite
// remedies. It just was not wired to the thing the customer reads.
//
// WHERE "PAY THE OPEN INVOICE" LEADS: the account page, never Stripe's
// hosted_invoice_url. The emails used to link that URL directly, and a long
// tokenized invoice.stripe.com payment link inside a "your payment failed"
// email is the shape spam filters look for in phishing — it was the prime
// suspect when these emails started landing in spam, where no link collects
// anything. The billing portal on the account page lists the same open invoice
// and pays it from any card, so every link in the email stays on our domain.
//
// TONE IS PART OF THE CORRECTNESS HERE. Being short of money on a given day is
// not a defect in the member and the copy must not imply it is. It states what
// the bank returned, says plainly that the card is fine, and offers the link —
// no urgency, no chasing, no implication that they have done something wrong.

import type { DeclineCategory } from './declineReason.ts';

export type DeclineEmailCopy = {
  /** Why it failed, in the member's terms. Replaces the generic decline line. */
  reason: string;
  /** What will happen next, and what they can do now. May be empty. */
  remedy: string;
  /** Label for the primary button. */
  ctaLabel: string;
  /**
   * True when the primary action is "pay the open invoice" rather than "update
   * the card on file". Only a genuine card fault makes re-saving the card the
   * right remedy; everything else is better served by paying the invoice, which
   * takes ANY card and settles the debt in one step. The email links the account
   * page either way — this decides what it tells the member to do there.
   */
  preferInvoice: boolean;
};

export type DeclineEmailInput = {
  category: DeclineCategory | null;
  /** e.g. "your Visa card ending in 4242", or null when it could not be resolved. */
  cardPhrase: string | null;
  /** Stripe's next automatic retry, already formatted for a human. */
  nextAttemptLabel: string | null;
  /** A first charge after a trial reads differently from a renewal. */
  trialConversion: boolean;
};

function retrySentence(input: DeclineEmailInput): string {
  if (input.nextAttemptLabel) {
    return `Stripe will try again automatically on ${input.nextAttemptLabel}.`;
  }
  return 'Stripe has made its last automatic attempt, so it will not retry on its own.';
}

/** The "you can pay it yourself" tail. Names the account page, not a Stripe URL. */
function payTail(input: DeclineEmailInput): string {
  return input.nextAttemptLabel
    ? ' If you would rather not wait, or want to use a different card, you can pay the open invoice yourself from your account page — it takes any card.'
    : ' You can pay the open invoice yourself from your account page — it takes any card.';
}

/**
 * The reason/remedy pair for a decline, or the neutral pair when we do not know
 * what the issuer said.
 *
 * Every branch is written to be TRUE of that category and useless-but-harmless
 * if the classification is wrong. The one thing no branch may do is name a cause
 * we did not observe: `unknown` says nothing about why, because guessing at a
 * reason in customer-facing mail is how a member ends up phoning a bank that
 * never saw the charge.
 */
/**
 * The reason follows a sentence in both emails ("…start your subscription
 * ($49.00). <reason>"), and two branches open with the card phrase, which is
 * lower-case by construction ("your Visa card ending in 4242"). Rendering the
 * real email is what caught it; no unit test on the fragment ever would.
 */
function openSentence(text: string): string {
  return text.length > 0 ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function buildDeclineEmailCopy(input: DeclineEmailInput): DeclineEmailCopy {
  const copy = buildDeclineEmailCopyInner(input);
  return { ...copy, reason: openSentence(copy.reason) };
}

function buildDeclineEmailCopyInner(input: DeclineEmailInput): DeclineEmailCopy {
  const card = input.cardPhrase ?? 'the card on file';
  const opener = input.trialConversion ? 'the first charge' : 'the payment';

  switch (input.category) {
    case 'insufficient_funds':
      return {
        // States the bank's answer and immediately removes the wrong conclusion.
        // "Nothing to fix" is the load-bearing clause: without it the member goes
        // looking for a fault in a card that does not have one.
        reason: `Your bank returned ${opener} as insufficient funds at that moment — so ${card} itself is fine, and there is nothing to fix or re-enter.`,
        remedy: `${retrySentence(input)}${payTail(input)}`,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };

    case 'card_problem':
      return {
        // The one category where the account page really is the answer.
        reason: `${card} could not be used for ${opener} — it looks expired, mistyped or no longer accepted.`,
        remedy: 'Updating the card on file takes about a minute and picks the subscription straight back up.',
        ctaLabel: 'Update your card',
        preferInvoice: false,
      };

    case 'issuer_block':
      return {
        reason: `Your bank declined ${opener} on ${card}. That is usually a block on an unfamiliar recurring charge rather than anything wrong with the account.`,
        remedy: `Approving it with your bank clears it for good, and they will usually do that over the phone or in their app. ${retrySentence(input)}${payTail(input)}`,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };

    case 'authentication_required':
      return {
        reason: `Your bank asked for an extra confirmation step on ${opener} and it was not completed, so the charge did not go through.`,
        remedy: 'Paying the open invoice from your account page walks you through that step — it only takes a moment.',
        ctaLabel: 'Confirm the payment',
        preferInvoice: true,
      };

    case 'try_again':
      return {
        reason: `${opener === 'the first charge' ? 'The first charge' : 'The payment'} did not go through on ${card} — the processor returned a temporary error rather than a refusal.`,
        remedy: `${retrySentence(input)}${payTail(input)}`,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };

    case 'blocked_by_risk':
      // OUR automated check stopped this, not a bank. Saying "your card was
      // declined" would send the member to an issuer that never saw it, and
      // core/declineReason.ts forbids the bank framing outright for this case.
      return {
        reason: `${opener === 'the first charge' ? 'The first charge' : 'The payment'} did not complete — our automated payment checks stopped it, which is on our side rather than yours.`,
        remedy: 'Reply to this email and I will sort it out personally; it is usually a quick fix.',
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };

    case 'unknown':
    case null:
    default:
      // No usable code. Say only what we observed: it did not go through.
      return {
        reason: `${opener === 'the first charge' ? 'The first charge' : 'The payment'} on ${card} did not go through.`,
        remedy: `${retrySentence(input)}${payTail(input)}`,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };
  }
}
