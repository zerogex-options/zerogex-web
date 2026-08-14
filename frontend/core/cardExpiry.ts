// Pure decision for the PROACTIVE card-expiry reminder — nudge an active
// subscriber to update the card on file BEFORE its expiry makes a renewal fail
// (involuntary churn Stripe's Smart Retries can't save: a dead card stays dead).
// Given the card's expiration and the "YYYY-MM" we last warned this member
// about, decide whether to send now.
//
// Kept PURE (no imports) so it's unit-tested without Stripe/DB — same discipline
// as core/paymentGrace.ts. The cron (scripts/send-card-expiry-reminders.mts)
// supplies the live card expiry + the persisted latch and injects the clock.
// Locked down in tests/cardExpiry.test.ts.

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_THRESHOLD_DAYS = 45;

export type CardExpiryInput = {
  // Stripe card.exp_month (1-12) and card.exp_year (4-digit), or null when no
  // card expiry is resolvable (a wallet/Link method) — then we never notify.
  expMonth: number | null;
  expYear: number | null;
  // Injected clock (Date.now()) so the decision is deterministic under test.
  nowMs: number;
  // users.card_expiry_notified_ym — the "YYYY-MM" we last warned about, or null.
  // A different value (the member updated the card to a new expiry) re-arms the
  // reminder; an equal value means we already warned, so skip.
  alreadyNotifiedYm: string | null;
  // Notify when the card expires within this many days. Default 45 ≈ a monthly
  // cycle of runway to update before a renewal hits the dead card.
  thresholdDays?: number;
};

export type CardExpiryDecision = {
  shouldNotify: boolean;
  // The "YYYY-MM" to stamp into card_expiry_notified_ym on send.
  notifyYm: string | null;
  // "MM/YYYY" for the email copy, or null when the expiry is unusable.
  expiryLabel: string | null;
};

export function decideCardExpiryReminder(input: CardExpiryInput): CardExpiryDecision {
  const {
    expMonth,
    expYear,
    nowMs,
    alreadyNotifiedYm,
    thresholdDays = DEFAULT_THRESHOLD_DAYS,
  } = input;

  // Reject anything that isn't a real MM/YYYY — a wallet/Link method (no card),
  // or a malformed value — so we never notify on garbage.
  if (
    expMonth == null ||
    expYear == null ||
    !Number.isInteger(expMonth) ||
    !Number.isInteger(expYear) ||
    expMonth < 1 ||
    expMonth > 12 ||
    expYear < 2000 ||
    expYear > 2100
  ) {
    return { shouldNotify: false, notifyYm: null, expiryLabel: null };
  }

  const ym = `${expYear}-${String(expMonth).padStart(2, '0')}`;
  const expiryLabel = `${String(expMonth).padStart(2, '0')}/${expYear}`;

  // A card expires at the END of its exp month: it becomes invalid at the start
  // of the following month. exp_month is 1-12, and Date's monthIndex is 0-based,
  // so Date.UTC(year, expMonth, 1) is the first instant of the NEXT month.
  const expiryBoundaryMs = Date.UTC(expYear, expMonth, 1);

  // Only a still-valid card that expires within the window. An already-expired
  // card (boundary <= now) is left to the payment-failed dunning path — no point
  // sending "update before it expires" after it already has.
  const withinWindow =
    expiryBoundaryMs > nowMs && expiryBoundaryMs - nowMs <= thresholdDays * DAY_MS;
  // Already warned for THIS exact expiry → don't re-nag every run. A different
  // expiry (card updated) carries a different ym, so it re-arms on its own.
  const fresh = alreadyNotifiedYm !== ym;

  return { shouldNotify: withinWindow && fresh, notifyYm: ym, expiryLabel };
}
