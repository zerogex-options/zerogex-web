// Which line of the admin "Total Subscribers" chart a single member is on.
//
// The counting itself is done in SQL (currentPayingCounts in core/monitoring.ts)
// because it's a GROUP BY over the whole users table; this is the same decision
// expressed for ONE row, so `make diagnose-user` can answer "why isn't this
// person in Trial Grace?" without anyone re-reading that SQL by hand. The two
// are kept in lockstep by tests/subscriberBucket.test.ts.
//
// Kept PURE (no imports) so it's unit-testable and usable from the standalone
// diagnostic scripts, which run outside Next's module resolution.

export type SubscriberBucketId =
  | 'fullSubscriber'
  | 'converting'
  | 'freeTrial'
  | 'trialGrace'
  | 'notCounted';

export type SubscriberBucketInput = {
  subscriptionStatus: string | null;
  // Tier as stored on the users row; legacy ids are folded here.
  tier: string | null;
  paymentGraceReason: string | null;
  cancelAtPeriodEnd?: boolean;
  // The subscription this member is on right now (users.stripe_subscription_id)
  // and the pair recording which subscription last had an invoice paid on it
  // (users.last_paid_subscription_id / users.last_paid_invoice_at).
  //
  // Together these separate Full Subscriber from Converting: Stripe flips a
  // subscription to `active` when the post-trial invoice is CREATED, about an
  // hour before the charge is attempted, so `active` on its own is evidence of
  // an invoice, not of money.
  //
  // Taken RAW rather than pre-reduced to one "has paid" date on purpose. The
  // reduction is the part that has to agree with the chart's SQL, so it lives
  // exactly once, in subscriptionPaidAt below, instead of at each call site.
  // The account-scoped users.first_payment_at deliberately has no say: it is
  // stamped once per ACCOUNT, so a returning member carries it into every later
  // subscription and it cannot answer "has THIS one been paid" — which is what
  // put a reactivated member on the Full Subscriber line an hour before their
  // card was charged. See core/db.ts.
  //
  // REQUIRED, with no default. An optional field quietly defaulting to "never
  // paid" is how that confusion survived: a caller which had never been taught
  // about these columns still compiled.
  stripeSubscriptionId: string | null;
  lastPaidSubscriptionId: string | null;
  lastPaidInvoiceAt: string | null;
};

export type SubscriberBucketVerdict = {
  bucket: SubscriberBucketId;
  label: string;
  // Plain-language reason, written to be read by a human debugging one account.
  why: string;
};

const LABELS: Record<SubscriberBucketId, string> = {
  fullSubscriber: 'Full Subscriber',
  converting: 'Converting',
  freeTrial: 'Free Trial',
  trialGrace: 'Trial Grace',
  notCounted: 'NOT COUNTED',
};

export function normalizeBucketTier(tier: string | null): string | null {
  if (tier === 'starter') return 'basic';
  if (tier === 'elite') return 'pro';
  return tier;
}

/**
 * When an invoice was paid ON THE SUBSCRIPTION THIS MEMBER IS CURRENTLY ON, or
 * null if none has been.
 *
 * The recorded pointer has to NAME that subscription. A member returning on a
 * new subscription still carries the record of their previous one, and that is
 * evidence about a subscription they are no longer on — counting it is what made
 * the Full Subscriber line tick up before the money arrived.
 *
 * Mirrored exactly by the CASE in currentPayingCounts (core/monitoring.ts);
 * tests/subscriberBucket.test.ts reproduces that SQL as an oracle and holds the
 * two in lockstep, so a change here without a change there fails the suite.
 */
export function subscriptionPaidAt(input: {
  stripeSubscriptionId: string | null;
  lastPaidSubscriptionId: string | null;
  lastPaidInvoiceAt: string | null;
}): string | null {
  if (!input.stripeSubscriptionId || !input.lastPaidSubscriptionId) return null;
  if (input.stripeSubscriptionId !== input.lastPaidSubscriptionId) return null;
  // Pointer set with no date is a half-written row; treat it as unpaid, which
  // is the direction that cannot promote someone who has not been charged.
  return input.lastPaidInvoiceAt;
}

export function classifySubscriberBucket(input: SubscriberBucketInput): SubscriberBucketVerdict {
  const status = input.subscriptionStatus;
  const tier = normalizeBucketTier(input.tier);
  const tierIsPaid = tier === 'pro' || tier === 'basic';
  const verdict = (bucket: SubscriberBucketId, why: string): SubscriberBucketVerdict => ({
    bucket,
    label: LABELS[bucket],
    why,
  });

  // ACCESS GATE, first and for every line. The tier the webhook last synced is
  // the single source of truth for "does this member have access right now": it
  // holds pro/basic through active, trialing, and grace, and flips to `public`
  // exactly when access is revoked. Two live-status states are NOT subscribers
  // and are caught only here:
  //   • a PAUSED subscription — Stripe leaves the status `active` while
  //     pause_collection is set, but the webhook grants no tier, so the member
  //     is paying nothing and getting nothing;
  //   • a trial held at the PAYMENT-SETUP GATE — `trialing` whose SetupIntent
  //     hasn't succeeded, so access was deliberately withheld.
  // Gating on the tier here is also what keeps this reconciled with the
  // subscription-flow chart, which books adds and losses off exactly these
  // paid<->public transitions (core/subscriptionFlow.ts).
  if (!tierIsPaid) {
    return verdict(
      'notCounted',
      status === 'active'
        ? "status 'active' but the tier is 'public' — a paused subscription: billing and access are both on hold"
        : status === 'trialing'
          ? "trialing but the tier is 'public' — access withheld because the card's payment setup hasn't succeeded"
          : status === 'past_due'
            ? 'past_due AND the tier has already dropped to public — no grace window is protecting this member'
            : `no paid tier on file (tier '${input.tier ?? 'null'}')`,
    );
  }

  // Free Trial is decided by STATUS, exactly as the chart's SQL does — a
  // trialer who has already clicked Cancel keeps their access to the end of the
  // trial, so they stay on this line until the trial actually lapses.
  if (status === 'trialing') {
    return verdict(
      'freeTrial',
      input.cancelAtPeriodEnd
        ? 'trialing with a cancel already scheduled — still counted here until the trial ends'
        : 'trialing',
    );
  }

  // Trial Grace: the trial lapsed, the FIRST charge was declined, and a recovery
  // window is holding their paid tier.
  if (status === 'past_due' && input.paymentGraceReason === 'trial') {
    return verdict(
      'trialGrace',
      'past_due, the first charge after the trial was declined, still inside the recovery window',
    );
  }

  if (status === 'active') {
    // The trial→paid step, split by whether money has actually moved. Stripe
    // creates the post-trial invoice and flips the subscription to `active`
    // roughly an hour BEFORE it attempts the charge, so an `active` with no
    // recorded payment is a charge in flight, not a customer. Counting it as a
    // Full Subscriber is what used to make the line tick up and then back down
    // an hour later when the card declined.
    const paidAt = subscriptionPaidAt(input);
    if (paidAt) {
      return verdict('fullSubscriber', `active, an invoice has cleared on this subscription (${paidAt})`);
    }
    // Naming the stale pointer matters here: "active but never paid" reads as a
    // brand-new member, and for a returning one that is the wrong investigation.
    return verdict(
      'converting',
      input.lastPaidSubscriptionId
        ? `active, but the last paid invoice was on ${input.lastPaidSubscriptionId}, not the current ` +
          `subscription — this subscription's charge is still in flight`
        : 'active but no invoice has ever cleared — the post-trial invoice exists and the charge is still in flight',
    );
  }

  // A renewal-failure grace window (or one opened before the reason column
  // existed) counts as a full subscriber: an established payer whose access has
  // not actually dropped. They reached a renewal, so they have paid by
  // definition — no firstPaymentAt gate here, which also keeps rows predating
  // the column on the line they have always been on.
  if (status === 'past_due') {
    return verdict(
      'fullSubscriber',
      `past_due inside a '${input.paymentGraceReason ?? 'unattributed'}' grace window — ` +
        'renewal grace counts as a full subscriber because access never dropped',
    );
  }

  return verdict('notCounted', `status '${status ?? 'null'}' is outside the chart entirely`);
}

// ── The ledger ─────────────────────────────────────────────────────────────
// Every change to the subscriber headcount, in order, with the member it
// happened to, why, and what it did to each line of the chart.
//
// The charts answer "how many"; this answers "who, and what just moved the
// number". Without it a Full Subscriber count ticking 105 -> 104 is a mystery
// that costs a `make diagnose-user` guess to solve, and a scheduled
// cancellation silently becomes a surprise a month later when it takes effect.
//
// Driven off the `stripe_subscription_sync` audit stream because that IS what
// moves the headcount: the webhook writes a row on every subscription state
// change carrying the status, the tier it granted, and the cancel flag — the
// exact inputs the buckets above are computed from. Walking that stream per
// subscription and emitting a row whenever the derived bucket (or the cancel
// flag) actually changes reproduces the headcount's history by construction,
// and skips the many no-op re-syncs Stripe sends in between.
//
// A payment stream is merged in alongside it, because the Converting -> Full
// Subscriber step is the one transition the sync stream cannot see: nothing
// about the subscription changes when its invoice is paid. Which audit rows
// count as a payment ON A SUBSCRIPTION — and why the account-scoped
// `stripe_first_payment` stamp is not enough on its own — is
// core/subscriptionPayments.ts.
//
// It lives in this file rather than its own so there is exactly ONE bucket
// rule: the ledger classifies with classifySubscriberBucket above, so a change
// to the chart's buckets moves the ledger with it automatically.

// How long an `active` with no observed payment stays in Converting before the
// ledger accepts it as paid, in days. This is a FALLBACK for history the
// payment stream doesn't cover — subscriptions that converted before either
// payment audit event was being written, which are exactly the rows the
// users.first_payment_at backfill marks as paid. A real payment event promotes
// immediately and is always preferred. Mirrors CONVERSION_CONFIRM_DAYS in
// core/trialConveyor and the window in core/trialDunning, for the same reason.
const CONVERSION_CONFIRM_DAYS = 2;

const DAY_MS = 86_400_000;

export type LedgerEventKind =
  | 'trialStarted'
  | 'conversionPending'
  | 'converted'
  | 'orphanRecovered'
  | 'trialChargeDeclined'
  | 'renewalFailed'
  | 'recovered'
  | 'cancelScheduledTrial'
  | 'cancelScheduledPaid'
  | 'cancelReverted'
  | 'paused'
  | 'resumed'
  | 'accessEnded';

export type LedgerRow = {
  at: string;
  email: string | null;
  userId: string | null;
  kind: LedgerEventKind;
  // What this did to each line of the Total Subscribers chart. Summing the
  // deltas over a window reproduces that line's movement across it, which is
  // what makes "why did Full Subscribers drop" answerable by reading one row.
  fullSubscriberDelta: number;
  convertingDelta: number;
  freeTrialDelta: number;
  trialGraceDelta: number;
  // Plain-language explanation, written for someone scanning the ledger.
  detail: string;
};

export type LedgerSyncEvent = {
  subId: string;
  userId: string | null;
  email: string | null;
  at: string;
  status: string | null;
  // Tier the webhook granted on this sync ('pro' | 'basic' | 'public').
  tier: string | null;
  cancelAtPeriodEnd: boolean;
};

// A subscription invoice that actually got PAID. Only the first one per
// subscription matters here (it's what promotes Converting -> Full Subscriber);
// later renewals are no-ops.
export type LedgerPaymentEvent = {
  subId: string;
  userId: string | null;
  email: string | null;
  at: string;
};

// A subscription created by ORPHAN RECOVERY to honor an invoice that was paid
// after Stripe had already canceled the subscription it belonged to
// (core/orphanPayment.ts). The `billing_orphan_payment_recovered` audit row.
//
// The ledger needs this because such a subscription is, by design, created with
// NO invoice of its own: billing is anchored at the end of the period the
// recovered invoice already paid for. So no payment can ever clear on it before
// its first renewal, and on the sync stream alone it is indistinguishable from a
// trial whose conversion charge is still in flight — which is how a member who
// had already paid came to sit on Converting for a fortnight, then get promoted
// by the fallback window under the explanation "the conversion charge was never
// reported as failed".
export type LedgerRecoveryEvent = {
  subId: string;
  userId: string | null;
  email: string | null;
  at: string;
  // The invoice whose payment this subscription re-homes, when the audit row
  // named one. Reported in the ledger row so the money is traceable.
  invoiceId: string | null;
};

export type LedgerDeleteEvent = {
  subId: string | null;
  userId: string | null;
  email: string | null;
  at: string;
  // Cancellation-survey reason carried on the terminal row, when Stripe sent one.
  reason?: string | null;
};

const KIND_LABELS: Record<LedgerEventKind, string> = {
  trialStarted: 'Trial started',
  conversionPending: 'Conversion charge pending',
  converted: 'Converted to paying',
  orphanRecovered: 'Paid period restored',
  trialChargeDeclined: 'First charge declined',
  renewalFailed: 'Renewal payment failed',
  recovered: 'Payment recovered',
  cancelScheduledTrial: 'Cancellation scheduled: trial',
  cancelScheduledPaid: 'Cancellation scheduled: paid subscription',
  cancelReverted: 'Cancellation reversed',
  paused: 'Subscription paused',
  resumed: 'Subscription resumed',
  accessEnded: 'Access ended',
};

export function ledgerKindLabel(kind: LedgerEventKind): string {
  return KIND_LABELS[kind];
}

// Headcount deltas implied by moving between two chart buckets. `notCounted`
// covers both "not on the chart yet" and "left the chart", so a member's first
// appearance and their departure are both expressed here.
function bucketDeltas(
  from: SubscriberBucketId | null,
  to: SubscriberBucketId,
): Pick<LedgerRow, 'fullSubscriberDelta' | 'convertingDelta' | 'freeTrialDelta' | 'trialGraceDelta'> {
  const score = (b: SubscriberBucketId | null) => ({
    full: b === 'fullSubscriber' ? 1 : 0,
    converting: b === 'converting' ? 1 : 0,
    trial: b === 'freeTrial' ? 1 : 0,
    grace: b === 'trialGrace' ? 1 : 0,
  });
  const a = score(from);
  const b = score(to);
  return {
    fullSubscriberDelta: b.full - a.full,
    convertingDelta: b.converting - a.converting,
    freeTrialDelta: b.trial - a.trial,
    trialGraceDelta: b.grace - a.grace,
  };
}

type SubState = {
  bucket: SubscriberBucketId | null;
  // Last identity seen on this subscription, so a row the walk synthesizes
  // (a conversion settled by the fallback window) still names the member.
  email: string | null;
  userId: string | null;
  cancelAtPeriodEnd: boolean;
  // An established payer is currently in dunning (past_due with access kept).
  dunning: boolean;
  sawTrial: boolean;
  // Timestamp (ms) of the first `active` sync, used to tell a trial still at its
  // first charge from an established payer whose renewal failed.
  firstActiveMs: number | null;
  // Set once a payment of theirs has cleared (a real event, the fallback window
  // below elapsing, or an orphan recovery having already honored a paid period
  // onto this subscription). Feeds classifySubscriberBucket's paid-subscription
  // pointer.
  paidAt: string | null;
  // The invoice an orphan recovery re-homed onto this subscription, when it is
  // one. Non-null marks the subscription as recovered, which decides both its
  // bucket (paid from the first sync) and how its row reads.
  recoveredFromInvoice: string | null;
  // A recovery was recorded for this subscription at all, even with no invoice
  // id parsed out of the audit row.
  recovered: boolean;
  // Currently dropped out of the chart by a pause rather than a lapse, so the
  // return trip can be reported as a resume instead of a new subscription.
  paused: boolean;
  ended: boolean;
};

// Whether a past_due on this sub is the trial's FIRST charge failing rather than
// an established renewal. True when the sub had a trial and has not yet held
// `active` for longer than the confirmation window — the order-independent test,
// since Stripe's trial-end `active` sync lands before the charge is attempted.
function isTrialPhase(s: SubState, nowMs: number): boolean {
  if (!s.sawTrial) return false;
  if (s.firstActiveMs == null) return true;
  return nowMs - s.firstActiveMs <= CONVERSION_CONFIRM_DAYS * DAY_MS;
}

// Whether a scheduled cancellation is ending a PAID subscription rather than a
// free trial. Money having actually moved is the deciding fact, so an observed
// (or fallback-settled) first payment answers it outright; the Full Subscriber
// bucket is accepted alongside it because an established payer whose history
// predates the payment stream reaches that bucket without one. Everything else
// — trialing, the conversion charge still in flight, a first charge already
// declined — has never completed a payment, so it is a trial being called off.
function isPaidSubscription(s: SubState): boolean {
  if (s.paidAt != null) return true;
  if (s.bucket === 'fullSubscriber') return true;
  // `converting` on a subscription whose trial was never observed is an artifact
  // of the scan starting mid-life: an established payer's routine renewal sync
  // looks identical to a trial's first `active`, and only the absence of any
  // `trialing` sync tells them apart. Two days later settleDue promotes them to
  // Full Subscriber anyway; this just keeps a cancel clicked inside that window
  // from reading as a trial the member never had.
  return s.bucket === 'converting' && !s.sawTrial;
}

/**
 * Build the ledger from the audit streams. The timed ones are merged into a
 * single chronological walk, so none of them needs to arrive pre-sorted; the
 * returned rows are newest-first, ready to render. `nowMs` closes out the
 * fallback confirmation window for any conversion still pending at the end of
 * the scan.
 *
 * `recoveries` is deliberately NOT part of that walk. A recovery is a standing
 * fact about a subscription — that it was created to carry an already-paid
 * period — not a transition the headcount passes through, and the audit row and
 * the subscription sync it describes are written within the same second in
 * whichever order the webhook happens to deliver. Reading it as set membership
 * is what makes the result independent of that order, the same reasoning
 * stampSubscriptionPayment relies on for its two columns.
 */
export function buildSubscriberLedger(
  syncs: LedgerSyncEvent[],
  deletes: LedgerDeleteEvent[],
  payments: LedgerPaymentEvent[] = [],
  recoveries: LedgerRecoveryEvent[] = [],
  nowMs: number = Date.now(),
): LedgerRow[] {
  const rows: LedgerRow[] = [];
  const subs = new Map<string, SubState>();

  const recoveredSubs = new Map<string, LedgerRecoveryEvent>();
  for (const ev of recoveries) {
    // First recovery per subscription wins; a subscription is only ever created
    // by one, and a re-run is refused by the recovered_from_invoice stamp.
    if (ev.subId && !recoveredSubs.has(ev.subId)) recoveredSubs.set(ev.subId, ev);
  }

  const stateFor = (subId: string): SubState => {
    let s = subs.get(subId);
    if (!s) {
      const recovery = recoveredSubs.get(subId);
      s = {
        bucket: null,
        email: recovery?.email ?? null,
        userId: recovery?.userId ?? null,
        cancelAtPeriodEnd: false,
        dunning: false,
        sawTrial: false,
        firstActiveMs: null,
        // A recovered subscription arrives already paid for. Seeding this from
        // the outset — rather than on reaching the recovery's own timestamp — is
        // what keeps the verdict the same whichever of the two rows lands first,
        // and it stops the fallback window ever firing on it.
        paidAt: recovery ? recovery.at : null,
        recoveredFromInvoice: recovery?.invoiceId ?? null,
        recovered: recovery != null,
        paused: false,
        ended: false,
      };
      subs.set(subId, s);
    }
    return s;
  };

  const push = (
    ev: { at: string; email: string | null; userId: string | null },
    s: SubState,
    kind: LedgerEventKind,
    to: SubscriberBucketId,
    detail: string,
  ) => {
    rows.push({
      at: ev.at,
      email: ev.email,
      userId: ev.userId,
      kind,
      ...bucketDeltas(s.bucket, to),
      detail,
    });
    s.bucket = to;
  };

  // Promote a subscription whose `active` has outlived the fallback window
  // without a payment event. Runs lazily against each event's own clock (and
  // once more at the end), so a conversion the payment stream never covered
  // still lands on the day it effectively became real rather than never.
  const settleDue = (atMs: number) => {
    for (const [subId, s] of subs) {
      if (s.bucket !== 'converting' || s.paidAt || s.ended) continue;
      if (s.firstActiveMs == null) continue;
      const dueMs = s.firstActiveMs + CONVERSION_CONFIRM_DAYS * DAY_MS;
      if (dueMs > atMs) continue;
      const at = new Date(dueMs).toISOString();
      s.paidAt = at;
      push(
        { at, email: s.email, userId: s.userId },
        s,
        'converted',
        'fullSubscriber',
        'The conversion charge was never reported as failed — counted as paid',
      );
      void subId;
    }
  };

  // ONE ordered timeline across all three streams. Every stream has to be walked
  // in real time together, because the fallback window above fires between
  // events: a trial whose charge fails an hour after `active` is deleted long
  // before its two days are up, and settling that conversion first would report
  // a member who never paid as having converted, then immediately churned.
  // Ties resolve sync -> payment -> delete, the order the states depend on.
  type Step = {
    at: number;
    rank: number;
    sync?: LedgerSyncEvent;
    payment?: LedgerPaymentEvent;
    del?: LedgerDeleteEvent;
  };
  const steps: Step[] = [];
  for (const ev of syncs) {
    if (!ev.subId) continue;
    const at = Date.parse(ev.at);
    if (Number.isFinite(at)) steps.push({ at, rank: 0, sync: ev });
  }
  for (const ev of payments) {
    if (!ev.subId) continue;
    const at = Date.parse(ev.at);
    if (Number.isFinite(at)) steps.push({ at, rank: 1, payment: ev });
  }
  for (const ev of deletes) {
    if (!ev.subId) continue;
    const at = Date.parse(ev.at);
    if (Number.isFinite(at)) steps.push({ at, rank: 2, del: ev });
  }
  steps.sort((a, b) => a.at - b.at || a.rank - b.rank);

  for (const step of steps) {
    settleDue(step.at);

    if (step.payment) {
      const ev = step.payment;
      const s = stateFor(ev.subId);
      if (ev.email) s.email = ev.email;
      if (ev.userId) s.userId = ev.userId;
      if (s.paidAt) continue; // a renewal, not the first payment
      s.paidAt = ev.at;
      if (s.bucket === 'converting') {
        push(ev, s, 'converted', 'fullSubscriber', 'The first payment cleared — now a paying subscriber');
      }
      continue;
    }

    // Terminal removals. Stripe deletes a subscription outright (with no
    // past_due at all) when a post-trial charge fails on a payment method it
    // won't retry, so this is a real departure path, not just the end of a
    // scheduled cancel.
    if (step.del) {
      const ev = step.del;
      const s = subs.get(ev.subId!);
      if (!s || s.ended) continue;
      s.ended = true;
      if (s.bucket === 'notCounted' || s.bucket === null) continue; // already off the chart
      const scheduled = s.cancelAtPeriodEnd;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: 'accessEnded',
        ...bucketDeltas(s.bucket, 'notCounted'),
        detail: scheduled
          ? `Scheduled cancellation took effect — access ended${ev.reason ? ` (${ev.reason})` : ''}`
          : isTrialPhase(s, step.at)
            ? 'Trial ended, the first charge failed and Stripe canceled the subscription'
            : `Subscription ended${ev.reason ? ` (${ev.reason})` : ''}`,
      });
      s.bucket = 'notCounted';
      continue;
    }

    const ev = step.sync!;
    const atMs = step.at;
    const s = stateFor(ev.subId);
    if (ev.email) s.email = ev.email;
    if (ev.userId) s.userId = ev.userId;

    if (ev.status === 'trialing') s.sawTrial = true;
    const trialPhase = isTrialPhase(s, atMs);
    if (ev.status === 'active' && s.firstActiveMs == null) s.firstActiveMs = atMs;

    // A past_due whose window was opened by a trial conversion belongs on the
    // Trial Grace line; an established payer's belongs with the full
    // subscribers. Derived rather than read from the row because the ledger
    // only has what the sync message carries.
    const derivedGraceReason =
      ev.status === 'past_due' ? (trialPhase ? 'trial' : 'renewal') : null;
    const next = classifySubscriberBucket({
      subscriptionStatus: ev.status,
      tier: ev.tier,
      paymentGraceReason: derivedGraceReason,
      cancelAtPeriodEnd: ev.cancelAtPeriodEnd,
      // The walk is per-subscription, so the pointer is this sub whenever a
      // payment of its own has been seen. This is what makes the ledger and the
      // chart agree by construction rather than by coincidence.
      stripeSubscriptionId: ev.subId,
      lastPaidSubscriptionId: s.paidAt ? ev.subId : null,
      lastPaidInvoiceAt: s.paidAt,
    }).bucket;

    if (next !== s.bucket) {
      // First sighting of a subscription that isn't on the chart (a trial held
      // at the payment-setup gate, say) is not an event — it never arrived.
      if (s.bucket === null && next === 'notCounted') {
        s.bucket = next;
      } else if (next === 'freeTrial') {
        push(ev, s, 'trialStarted', next, 'Free trial began — card on file, no charge yet');
      } else if (next === 'converting') {
        push(
          ev,
          s,
          'conversionPending',
          next,
          'Trial ended and Stripe raised the first invoice — the charge has not been attempted yet',
        );
      } else if (next === 'trialGrace') {
        push(
          ev,
          s,
          'trialChargeDeclined',
          next,
          'The first charge after the trial was declined — Stripe is retrying, access retained for now',
        );
      } else if (next === 'fullSubscriber') {
        if (s.recovered) {
          // Checked before the others because a recovery explains the arrival
          // whatever bucket preceded it: this member's access ended when Stripe
          // canceled the subscription their payment belonged to, so they reach
          // here from notCounted and would otherwise read as an ordinary
          // resubscribe — a new sale, which it is not. No money moved today.
          push(
            ev,
            s,
            'orphanRecovered',
            next,
            s.recoveredFromInvoice
              ? `A payment stranded by a canceled subscription was re-homed onto this one — ` +
                `the period already paid for on invoice ${s.recoveredFromInvoice}, not a new charge`
              : 'A payment stranded by a canceled subscription was re-homed onto this one — ' +
                'the period was already paid for, not a new charge',
          );
        } else if (s.bucket === 'trialGrace') {
          push(ev, s, 'recovered', next, 'The retry went through — now a paying subscriber');
        } else if (s.paused) {
          s.paused = false;
          push(ev, s, 'resumed', next, 'Pause ended — billing restarted and access restored');
        } else if (s.bucket === 'notCounted') {
          push(ev, s, 'converted', next, 'Resubscribed — paying again');
        } else {
          push(ev, s, 'converted', next, 'New paying subscriber');
        }
      } else if (ev.status === 'active') {
        // Live subscription, no tier granted: Stripe keeps a paused sub
        // `active`, so this is the retention pause, not a departure.
        s.paused = true;
        push(ev, s, 'paused', next, 'Subscription paused — billing and access on hold; this is not churn');
      } else {
        push(
          ev,
          s,
          'accessEnded',
          next,
          s.bucket === 'freeTrial'
            ? trialPhase
              ? 'Trial ended without a successful charge — access removed'
              : 'Trial ended — access removed'
            : 'Subscription lapsed — access removed',
        );
      }
    }

    // Dunning on an ESTABLISHED payer moves no counts (access is retained
    // through the recovery window) so it produces no bucket change — but it is
    // exactly the kind of thing that must not stay invisible until it becomes a
    // departure, so it gets its own row, and so does the recovery.
    if (ev.status === 'past_due' && next === 'fullSubscriber' && !s.dunning) {
      s.dunning = true;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: 'renewalFailed',
        fullSubscriberDelta: 0,
        convertingDelta: 0,
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: 'A renewal charge was declined — access retained while Stripe retries',
      });
    } else if (ev.status === 'active' && s.dunning) {
      s.dunning = false;
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: 'recovered',
        fullSubscriberDelta: 0,
        convertingDelta: 0,
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: 'The declined renewal was paid — no longer at risk',
      });
    }

    // The cancel flag moves no counts (they keep access to period end) but it is
    // the single best early warning there is, so it always gets a row — split by
    // WHAT is being canceled, because the two cost completely different things.
    // A trial cancel forfeits a conversion that was never charged; a paid cancel
    // is revenue already in hand walking out at the end of the period.
    if (ev.cancelAtPeriodEnd !== s.cancelAtPeriodEnd && !s.ended) {
      s.cancelAtPeriodEnd = ev.cancelAtPeriodEnd;
      const paid = isPaidSubscription(s);
      rows.push({
        at: ev.at,
        email: ev.email,
        userId: ev.userId,
        kind: ev.cancelAtPeriodEnd
          ? paid
            ? 'cancelScheduledPaid'
            : 'cancelScheduledTrial'
          : 'cancelReverted',
        fullSubscriberDelta: 0,
        convertingDelta: 0,
        freeTrialDelta: 0,
        trialGraceDelta: 0,
        detail: ev.cancelAtPeriodEnd
          ? paid
            ? 'Clicked Cancel on a paid subscription — keeps access until the paid period ends, then drops off'
            : 'Clicked Cancel during the free trial — keeps access until the trial ends, then leaves without ever being charged'
          : 'Cancellation reversed — staying on',
      });
    }
  }

  // Close out any conversion still inside its fallback window against the wall
  // clock, so a real one isn't withheld from the ledger just because no later
  // event happened to arrive.
  settleDue(nowMs);

  return rows.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

// Net movement of each chart line across the rows, so a header can state "Full
// Subscribers moved -2 over this window" and the rows below account for it.
export function summarizeLedger(rows: LedgerRow[]): {
  fullSubscriber: number;
  converting: number;
  freeTrial: number;
  trialGrace: number;
} {
  return rows.reduce(
    (acc, r) => ({
      fullSubscriber: acc.fullSubscriber + r.fullSubscriberDelta,
      converting: acc.converting + r.convertingDelta,
      freeTrial: acc.freeTrial + r.freeTrialDelta,
      trialGrace: acc.trialGrace + r.trialGraceDelta,
    }),
    { fullSubscriber: 0, converting: 0, freeTrial: 0, trialGrace: 0 },
  );
}
