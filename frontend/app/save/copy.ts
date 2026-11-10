// The words on the self-serve save page (app/save/route.ts): the confirmation a
// member lands on from the yellow button in the cancellation email, and the page
// after they claim. Pure and HTML-ready (the date is escaped here), so the
// wording is tested without Next, Stripe or the database
// (tests/savePageCopy.test.ts).
//
// A yearly plan reads as the renewal, matching the email's yearly offer and its
// "Renew at 25% off" button (buildCancellationEmail in core/mailer.ts). On a
// yearly plan the save coupon is a one-time discount on the next yearly invoice
// and nothing is charged when it is claimed, so "Keep my access" told a member
// with eleven paid months left that they were about to lose them
// (docs/outreach/2026-11-09-michasbausrl-yellow-button-annual.md). Monthly,
// quarterly and unknown plans keep the wording they had.
//
// The yearly page only says what is true at any moment: access lasts until the
// period end either way, and renewing charges nothing today. It does not repeat
// the email's "You've already paid through": the email knows when a trial
// conversion charge is still in flight, and this page reads only the database.

import type { BillingCadence } from '../../core/billingPlans.ts';
import type { SaveOffer } from '../../core/retentionToken.ts';

export const SAVE_PAGE_TITLE = 'ZeroGEX - Keep your access';
const YEARLY_TITLE = 'ZeroGEX - Your renewal';

export type SavePageInput = {
  pct: number;
  offer: SaveOffer;
  // The plan's billing period (priceIdToSku on the member's price), or null
  // when the price maps to no plan. Only 'annual' changes the words.
  cadence: BillingCadence | null;
  // The period end formatted for display ("October 20, 2027"), or null when
  // the member's row has none.
  endsOn: string | null;
};

export type SaveOfferPageCopy = {
  title: string;
  heading: string;
  intro: string;
  button: string;
  footer: string;
};

export type SaveDonePageCopy = {
  title: string;
  heading: string;
  body: string;
};

const NO_DATE = 'the end of your current period';

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// The confirmation page. Opening it changes nothing; its button claims.
export function saveOfferPageCopy(input: SavePageInput): SaveOfferPageCopy {
  const { pct } = input;
  const until = input.endsOn ? escapeHtml(input.endsOn) : NO_DATE;
  if (input.cadence === 'annual') {
    const when = input.endsOn ? `on ${until}` : `at ${NO_DATE}`;
    return {
      title: YEARLY_TITLE,
      heading: `Keep ZeroGEX going at ${pct}% off`,
      intro:
        `Your access lasts until ${until} either way. Renew now and your next year is <strong>${pct}% off</strong>: ` +
        `${when} you&rsquo;ll be charged the discounted rate instead of your plan ending. ` +
        'Renewing charges nothing today, and there&rsquo;s no card to re-enter.',
      button: `Renew at ${pct}% off`,
      footer: `Prefer to let it end? Just ignore this. Nothing changes, and your access lasts until ${until}.`,
    };
  }
  const term = input.offer === 'price' ? 'for the next 12 months' : 'for a full year';
  return {
    title: SAVE_PAGE_TITLE,
    heading: `Wait - here&rsquo;s ${pct}% off to stay`,
    intro:
      `Before you go - I&rsquo;d rather keep you than lose you. Claim <strong>${pct}% off ${term}</strong> ` +
      'and your access stays on, no re-subscribe and no re-entering a card. You&rsquo;ll simply be charged the ' +
      `discounted rate at ${until} instead of canceling.`,
    button: `Keep my access &amp; apply ${pct}% off`,
    footer: 'Prefer to still cancel? Just ignore this - nothing changes and your cancellation stands.',
  };
}

// The page after a successful claim.
export function saveDonePageCopy(input: SavePageInput): SaveDonePageCopy {
  const { pct } = input;
  const until = input.endsOn ? escapeHtml(input.endsOn) : NO_DATE;
  if (input.cadence === 'annual') {
    const when = input.endsOn ? `on ${until}` : `at ${NO_DATE}`;
    return {
      title: YEARLY_TITLE,
      heading: 'You&rsquo;re set to renew - thank you',
      body:
        `Done. Your plan now renews ${when} at <strong>${pct}% off your next year</strong>, and that&rsquo;s when ` +
        'the discounted rate is charged. Your access carries on as before - nothing else to do. ' +
        'Thanks for sticking with ZeroGEX.',
    };
  }
  return {
    title: SAVE_PAGE_TITLE,
    heading: 'You&rsquo;re staying - welcome back',
    body:
      `Done. Your access continues and <strong>${pct}% off for a year</strong> is on your account. ` +
      `You&rsquo;ll be charged the discounted rate at ${until} - nothing else to do. ` +
      'Thanks for giving ZeroGEX another shot.',
  };
}
