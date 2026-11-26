import type { PageDictionary } from '@/core/LanguageContext';

// Co-located dictionary for the in-app cancellation retention modal. English is
// the required base; other locales fall back to it (usePageT), matching the
// account page's delete-account block. Translate later if desired.
export const dict: PageDictionary = {
  en: {
    dialogAria: 'Cancel subscription',
    close: 'Close',

    // Step 1 — the save offer (shown first, before any cancel).
    offerHeading: 'Wait\u00a0- here’s {pct}% off to stay',
    offerBody:
      'I’d honestly rather keep you than lose you. Claim {pct}% off for a full year and your access just stays on\u00a0- no re-subscribe, no re-entering a card. You’ll simply be charged the discounted rate at {date}.',
    offerBodyNoDate:
      'I’d honestly rather keep you than lose you. Claim {pct}% off for a full year and your access just stays on\u00a0- no re-subscribe, no re-entering a card. You’ll simply be charged the discounted rate at the end of your current period.',
    applyDiscount: 'Keep my access & apply {pct}% off',
    applying: 'Applying…',
    declineToCancel: 'No thanks, continue to cancel',

    // Plan offers: a longer billing period, shown with the save offer (or alone
    // once that offer has been used).
    plansHeading: 'Before you go\u00a0- pay less with a longer plan',
    plansBody:
      'A longer billing period costs less per month than paying monthly. Your access carries straight on, with a credit for the unused part of what you’ve already paid.',
    plansSubheading: 'Or pay less with a longer plan',
    planOfferAnnual: 'Switch to {tier} annual: {price} a year',
    planOfferQuarterly: 'Switch to {tier} quarterly: {price} every 3 months',
    planOfferPerMonth: 'About {perMonth} a month',
    switchConfirmHeading: 'Switch to {tier} {period}?',
    switchConfirmBodyAnnual:
      'You’ll be charged {amount} today: the annual price, less a credit for the unused part of your current billing period. Your plan then renews once a year from today.',
    switchConfirmBodyQuarterly:
      'You’ll be charged {amount} today: the quarterly price, less a credit for the unused part of your current billing period. Your plan then renews every 3 months from today.',
    confirmSwitch: 'Switch and pay {amount}',
    switching: 'Switching…',
    switchBack: 'Back',
    switchPortalLink: 'Continue in the billing portal',
    switchedHeading: 'You’re on {tier} {period}',
    switchedBodyAnnual:
      'Thanks for staying. Your annual plan started today, and your receipt is on its way by email. It renews a year from today.',
    switchedBodyQuarterly:
      'Thanks for staying. Your quarterly plan started today, and your receipt is on its way by email. It renews 3 months from today.',

    // Step 2 — reason capture (only if they declined the offer).
    reasonHeading: 'Sorry to see you go',
    reasonBody:
      'Mind sharing why you’re canceling? It genuinely helps me fix what’s not working\u00a0- but it’s optional.',
    reasonCommentPlaceholder: 'Anything else you’d like me to know? (optional)',
    confirmCancel: 'Cancel my subscription',
    canceling: 'Canceling…',
    keepPlan: 'Never mind\u00a0- keep my plan',
    cancelAnyway: 'No thanks, cancel my subscription',

    // Reason answer \u2014 "Too complex / hard to use".
    complexHeading: 'ZeroGEX can be as simple as you want',
    complexBodyDashboard:
      'You don\u2019t have to use every chart. In My Dashboard you pick exactly what\u2019s on your screen: start with one or two views, like the key levels and a single chart, and add more only when you want them. Remove anything that gets in the way.',
    complexBodyEducation:
      'And if it\u2019s the ideas that feel heavy, the Education hub explains every chart in plain English, starting from what gamma exposure is and why it moves price.',
    complexDashboardCta: 'Build a simpler dashboard',
    complexEducationCta: 'Open the Education hub',

    // Reason answer \u2014 "Too expensive".
    priceOfferHeading: 'Would half price help?',
    priceOfferBody:
      'Stay for {pct}% off for the next 12 months. Your access just stays on, with no re-subscribing and no new card. You\u2019ll be charged the discounted rate starting {date}.',
    priceOfferBodyNoDate:
      'Stay for {pct}% off for the next 12 months. Your access just stays on, with no re-subscribing and no new card. You\u2019ll be charged the discounted rate starting at the end of your current period.',
    priceOfferUnavailable: 'This offer isn\u2019t available on your account. You can still cancel below.',

    // Terminal — saved.
    savedHeading: 'You’re staying\u00a0- welcome',
    savedBody:
      'Done. {pct}% off for a year is on your account and your access continues. You’ll be charged the discounted rate at {date}\u00a0- nothing else to do.',
    savedBodyNoDate:
      'Done. {pct}% off for a year is on your account and your access continues\u00a0- nothing else to do.',

    // Terminal — canceled.
    canceledHeading: 'Your subscription is set to cancel',
    canceledBody:
      'You’ll keep full access until {date}. Changed your mind later? You can resubscribe anytime from the pricing page.',
    canceledBodyNoDate:
      'You’ll keep full access until the end of your current billing period. Changed your mind later? You can resubscribe anytime from the pricing page.',
    // Canceled while paused: the cancel ended the pause, so access is back until
    // the period ends (core/subscriptionPause.ts scheduleCancelParams).
    canceledEndedPauseBody:
      'Canceling ended your pause, so your full access is back until {date}. After that your plan ends, and nothing more will be charged. Changed your mind later? You can resubscribe anytime from the pricing page.',
    canceledEndedPauseBodyNoDate:
      'Canceling ended your pause, so your full access is back until the end of your current billing period. After that your plan ends, and nothing more will be charged. Changed your mind later? You can resubscribe anytime from the pricing page.',
    // Terminal — canceled after a failed payment: ended now, not at period end.
    canceledNowHeading: 'Your subscription is canceled',
    canceledNowBody:
      'Your last payment didn’t go through, so your plan ended now instead of at the end of the billing period, and that unpaid bill is canceled too. Nothing more will be charged. Changed your mind later? You can resubscribe anytime from the pricing page.',
    canceledNowBodyBillOpen:
      'Your last payment didn’t go through, so your plan ended now instead of at the end of the billing period. Changed your mind later? You can resubscribe anytime from the pricing page.',
    // Terminal — there was nothing left to cancel.
    alreadyEndedHeading: 'Your subscription has already ended',
    alreadyEndedBody:
      'There’s nothing left to cancel. Changed your mind later? You can resubscribe anytime from the pricing page.',
    done: 'Done',

    // Pause-instead-of-cancel.
    pauseInstead: 'Pause instead of canceling',
    pauseHeading: 'Would a break help?',
    pauseBody:
      "Pause your subscription instead\u00a0- no charge and no access while it's paused, and it picks back up automatically. How long would you like?",
    // Pro plans only (core/subscriptionPause.ts pauseRevokesApiKeys): the pause
    // revokes the member's API key, and a revoked key can't be switched back on.
    // Shown above the month buttons, since picking a length is the confirmation.
    pauseApiKeyWarning:
      "If you use the API: pausing switches off your API key, and it can't be turned back on. When Pro comes back, generate a new key under API Access on your Account page and put it in any script, spreadsheet, or NinjaTrader chart that used the old one.",
    pauseMonth: '{n} month',
    pauseMonths: '{n} months',
    pauseBack: 'Back',
    pausedHeading: 'Your subscription is paused',
    pausedBody:
      "You won't be charged, and your access resumes automatically on {date}. Come back before then and I'll switch it right back on\u00a0- nothing to re-set up.",
    pausedBodyNoDate:
      "You won't be charged while paused, and it resumes automatically. Come back anytime.",
    // Pro plans only, after pausedBody / pausedBodyNoDate.
    pausedApiKeyNote:
      "The one exception is your API key: it switches off with the pause and can't be turned back on, so generate a new one under API Access on your Account page once Pro is back.",

    genericError: 'Something went wrong. Please try again in a minute.',
    // A cancel that didn't go through: say so plainly, and give a way out that
    // doesn't depend on this window working.
    cancelError:
      'Your subscription wasn’t canceled. Please try again in a minute. If it still doesn’t work, email support@zerogex.io and I’ll cancel it for you.',
  },
};
