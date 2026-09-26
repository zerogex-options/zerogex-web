// What a dunning email should actually SAY, given what the issuer said.
//
// FIRST FIX: RIGHT INSTRUCTION FOR THE REASON. Both payment-failure emails used
// to send one sentence for every decline: "your card was declined — update your
// card". A live count put 63 declined invoices in the `insufficient_funds`
// category, 60 of them a member's first payment, and for every one of those the
// card worked. core/declineReason.ts sorts declines into the handful of
// categories that call for different instructions, and this file turns each
// one into the words the member reads.
//
// SECOND FIX: SAY WHAT TO DO. The wording that replaced "update your card" was
// so careful not to alarm anyone that it never asked anyone to do anything. In
// the order a member read it: "your card itself is fine, there is nothing to
// fix", "good news: nothing changes right now", "Stripe will try again
// automatically". Taken together that says "ignore this email". About one
// declined invoice in six was ever collected, and almost nobody replied. So
// every branch now opens with what happened and gives ONE instruction the
// member can act on today:
//
//   * not enough money, or a dead card -> pay with (or add) a different card
//   * the bank refused it              -> call the bank to approve it, or use
//                                         a different card
//   * no usable reason                 -> either of the two
//
// WHAT HAS NOT CHANGED. No branch names a cause we did not observe: an unknown
// decline gets both instructions and no guessed reason. A Radar block is never
// blamed on the member's bank (core/declineReason.ts), because a member who
// phones a bank that never saw the charge concludes the email was the scam.
// And being short of money on a given day is not a defect in the member, so
// the copy states the bank's answer and the fix, and never scolds.
//
// WHERE THE BUTTON LEADS: our signed /pay link, never Stripe's
// hosted_invoice_url. A long tokenized invoice.stripe.com payment link inside a
// "your payment failed" email is the shape spam filters look for in phishing.
// /pay redirects to the same Stripe page at click time, so the member still
// pays in one click, from any card, without signing in, and every link in the
// email stays on our domain (core/payLink.ts).

import type { DeclineCategory } from './declineReason.ts';

export type DeclineEmailCopy = {
  /**
   * Subject for the first dunning email. States the failure plainly; the
   * instruction follows in the body's opening lines, which is also the preview
   * text an inbox shows beside the subject.
   */
  subject: string;
  /**
   * Why it failed, in the member's terms, one sentence. Empty when no reason
   * was observed: the instruction then stands on its own.
   */
  reason: string;
  /** The instruction: what to do, today. Never empty. */
  remedy: string;
  /**
   * A second, true thing worth saying after the deadline, or null. Either the
   * keep-this-card route for a short balance (have the money there before the
   * next retry), or the warning that no retries are left.
   */
  followUp: string | null;
  /** Label for the primary button. */
  ctaLabel: string;
  /**
   * True when the primary action is "pay the open invoice" rather than "update
   * the card on file". Only a genuine card fault makes re-saving the card the
   * right remedy; everything else is better served by paying the invoice, which
   * takes ANY card and settles the debt in one step. True sends the button to
   * the signed /pay link; false sends it to the account page to update the card.
   */
  preferInvoice: boolean;
};

export type DeclineEmailInput = {
  category: DeclineCategory | null;
  /**
   * Stripe's next automatic retry, already formatted for a human. Null when
   * none is scheduled or it is not known.
   */
  nextAttemptLabel: string | null;
  /**
   * True only when Stripe itself says no retry is left. Kept apart from a
   * missing date, which can also just mean the caller could not ask Stripe,
   * because "the subscription will be canceled" is not a thing to say on a guess.
   */
  retriesExhausted: boolean;
  /** A first charge after a trial gets a trial-framed subject. */
  trialConversion: boolean;
};

/**
 * No retry is coming. Said plainly, because it is the one fact that turns
 * "it may sort itself out" into "nothing happens unless you act".
 */
const NO_RETRIES_LEFT =
  'There are no automatic retries left, so unless the payment is made, the subscription will be canceled.';

function subjectFor(category: DeclineCategory | null, trialConversion: boolean): string {
  // Subjects take a plain space before the hyphen, never the no-break space the
  // body uses: they do not wrap, and unusual spacing characters in a subject can
  // count against a message with spam filters.
  if (category === 'authentication_required') {
    return trialConversion
      ? 'Your ZeroGEX trial ended - please confirm your payment'
      : 'Please confirm your ZeroGEX payment';
  }
  if (category === 'blocked_by_risk') {
    // "Declined" would read as the member's bank refusing, which it did not.
    return trialConversion
      ? "Your ZeroGEX trial ended - your payment didn't go through"
      : "Your ZeroGEX payment didn't go through";
  }
  return trialConversion
    ? 'Your ZeroGEX trial ended - your payment was declined'
    : 'Your ZeroGEX payment was declined';
}

/**
 * The words for a decline, or the both-ways instruction when we do not know
 * what the issuer said.
 *
 * The reason sentences never name the card: the email's opening sentence
 * already does, and naming it twice in three lines reads as a template.
 */
export function buildDeclineEmailCopy(input: DeclineEmailInput): DeclineEmailCopy {
  const subject = subjectFor(input.category, input.trialConversion);
  const finalFollowUp = input.retriesExhausted ? NO_RETRIES_LEFT : null;

  switch (input.category) {
    case 'insufficient_funds':
      return {
        subject,
        reason: 'Your bank declined it for insufficient funds.',
        remedy: 'Please pay with a different card using the button below.',
        // Waiting is a real option here, unlike for any other reason: the same
        // card clears once the money is in the account. It is offered as a
        // deadline to meet, not as a reason to do nothing.
        followUp: input.nextAttemptLabel
          ? `If you'd rather keep using this card, make sure the funds are in the account before ${input.nextAttemptLabel}, when we'll try it again.`
          : finalFollowUp,
        ctaLabel: 'Pay with a different card',
        preferInvoice: true,
      };

    case 'card_problem':
      return {
        subject,
        // The one category where the account page really is the answer.
        reason: "The card couldn't be charged. It looks expired, entered incorrectly, or no longer active.",
        remedy: 'Please update your card using the button below.',
        followUp: finalFollowUp,
        ctaLabel: 'Update your card',
        preferInvoice: false,
      };

    case 'issuer_block':
      return {
        subject,
        // Never repeat a fraud-flavored code back to the member (a lost-card or
        // "fraudulent" decline lands here too); "your bank declined" is all.
        reason: 'Your bank declined the charge.',
        remedy:
          'Please call your bank (the number is on the back of your card), ask them to approve the charge from ZeroGEX, then complete the payment with the button below. Or skip the call and pay with a different card.',
        followUp: finalFollowUp,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };

    case 'authentication_required':
      return {
        subject,
        reason: 'Your bank needs you to confirm it first.',
        // Paying the open invoice walks the member through the bank's check.
        remedy: 'Please confirm the payment using the button below. It only takes a moment.',
        followUp: finalFollowUp,
        ctaLabel: 'Confirm the payment',
        preferInvoice: true,
      };

    case 'blocked_by_risk':
      // OUR automated check stopped this, not a bank. Telling the member to call
      // their bank would send them to an issuer that never saw it, and
      // core/declineReason.ts forbids the bank framing outright for this case.
      return {
        subject,
        reason: 'Our automated payment checks stopped the charge, which is on our side rather than yours.',
        remedy:
          "Please try again using the button below, with the same card or a different one. If it's stopped again, reply to this email and I'll sort it out personally.",
        followUp: finalFollowUp,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };

    case 'try_again':
    case 'unknown':
    case null:
    default:
      // `try_again` shares the no-reason copy on evidence: its codes read like a
      // glitch, and six of them made 27 attempts between them without a single
      // one clearing (core/declineReason.ts, TRANSIENT_ATTEMPT_LIMIT). Promising
      // that a retry will fix it is the one thing this copy must not do.
      return {
        subject,
        reason: '',
        remedy:
          'Please pay with a different card using the button below, or call your bank and ask them to approve the charge from ZeroGEX.',
        followUp: finalFollowUp,
        ctaLabel: 'Complete the payment',
        preferInvoice: true,
      };
  }
}
