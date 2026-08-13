import type { PageDictionary } from '@/core/LanguageContext';

// Co-located dictionary for the in-app cancellation retention modal. English is
// the required base; other locales fall back to it (usePageT), matching the
// account page's delete-account block. Translate later if desired.
export const dict: PageDictionary = {
  en: {
    dialogAria: 'Cancel subscription',
    close: 'Close',

    // Step 1 — the save offer (shown first, before any cancel).
    offerHeading: 'Wait — here’s {pct}% off to stay',
    offerBody:
      'I’d honestly rather keep you than lose you. Claim {pct}% off for a full year and your access just stays on — no re-subscribe, no re-entering a card. You’ll simply be charged the discounted rate at {date}.',
    offerBodyNoDate:
      'I’d honestly rather keep you than lose you. Claim {pct}% off for a full year and your access just stays on — no re-subscribe, no re-entering a card. You’ll simply be charged the discounted rate at the end of your current period.',
    applyDiscount: 'Keep my access & apply {pct}% off',
    applying: 'Applying…',
    declineToCancel: 'No thanks, continue to cancel',

    // Step 2 — reason capture (only if they declined the offer).
    reasonHeading: 'Sorry to see you go',
    reasonBody:
      'Mind sharing why you’re cancelling? It genuinely helps me fix what’s not working — but it’s optional.',
    reasonCommentPlaceholder: 'Anything else you’d like me to know? (optional)',
    confirmCancel: 'Cancel my subscription',
    cancelling: 'Cancelling…',
    keepPlan: 'Never mind — keep my plan',

    // Terminal — saved.
    savedHeading: 'You’re staying — welcome',
    savedBody:
      'Done. {pct}% off for a year is on your account and your access continues. You’ll be charged the discounted rate at {date} — nothing else to do.',
    savedBodyNoDate:
      'Done. {pct}% off for a year is on your account and your access continues — nothing else to do.',

    // Terminal — cancelled.
    cancelledHeading: 'Your subscription is set to cancel',
    cancelledBody:
      'You’ll keep full access until {date}. Changed your mind later? You can resubscribe anytime from the pricing page.',
    cancelledBodyNoDate:
      'You’ll keep full access until the end of your current billing period. Changed your mind later? You can resubscribe anytime from the pricing page.',
    done: 'Done',

    genericError: 'Something went wrong. Please try again in a minute.',
  },
};
