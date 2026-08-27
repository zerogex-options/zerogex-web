// Pure, testable logic behind the admin "Conversion Conveyor" tab — the
// assembly-line view of the trial→paying pipeline. Extracted from
// core/monitoring.ts (mirrors core/subscriptionFlow.ts) so the classification,
// countdown, and outcome accounting can be unit-tested without a database. No
// `server-only`, DB, Stripe SDK, or fs imports, so it's safe to import from a
// test AND from the client component that renders the belt.
//
// THE MENTAL MODEL: a free trial is a package riding a conveyor belt.
//
//   [ trial starts ] ───────── belt ─────────▶ [ first charge ] ──▶ PAYING
//                       │                            │
//                       │ member clicks Cancel       │ card declined
//                       ▼                            ▼
//                   rolls off                    stalled (grace retry)
//
// Every rider is in exactly one of three live states (ConveyorState) and has a
// hard deadline — the instant the belt delivers them to the charge. That
// deadline is what the tab counts down to, so "when do I get paid, and by
// whom" is answerable at a glance instead of inferred from aggregate charts.

// Nominal free-trial length, mirroring TRIAL_PERIOD_DAYS in
// app/api/billing/checkout/route.ts. Used ONLY as the belt's fallback scale
// when a rider's true boarding time can't be recovered from the audit log (a
// trial that started before the retained event window). Real riders are
// positioned from their actual boardedAt, so a reactivation trial (30d) or a
// founding trial (absolute date) still renders at the correct progress.
export const NOMINAL_TRIAL_DAYS = 7;

const DAY_MS = 86_400_000;

// Where a rider currently sits on the belt:
//   running    — trialing, no cancellation scheduled. Still heading for the
//                charge; this is the cohort that converts.
//   rollingOff — trialing but cancel_at_period_end is set. The member clicked
//                Cancel: they keep access until the trial ends, then leave
//                WITHOUT ever being charged. Already off the conveyor in every
//                sense that matters to revenue.
//   stalled    — the belt reached the end and the FIRST charge was declined
//                (subscription past_due with payment_grace_reason='trial').
//                Not yet lost: Stripe's retries run inside the bounded
//                payment-recovery window, so these can still convert.
export type ConveyorState = 'running' | 'rollingOff' | 'stalled';

// One trial in flight. `convertsAt` is the deadline the belt is counting down
// to: the first-charge instant for running/rollingOff riders, and the grace
// deadline (last retry) for a stalled one.
export type ConveyorRider = {
  userId: string;
  email: string | null;
  state: ConveyorState;
  tier: 'basic' | 'pro' | null;
  cadence: 'monthly' | 'annual' | null;
  founding: boolean;
  // ISO instants. `boardedAt` is null when the trial started before the
  // retained audit window (belt position then falls back to the nominal span).
  boardedAt: string | null;
  convertsAt: string | null;
  // $/month this rider is worth the moment it converts. 0 when the price id
  // isn't mappable to a SKU — never guessed, so the belt's value can't inflate.
  monthlyValue: number;
};

// Decide which lane a subscriber row belongs in, or null when the row isn't on
// the belt at all. Deliberately mirrors the tier/status semantics the Stripe
// webhook writes (core/db.ts column docs): `trialing` means the free trial is
// still running, and a `past_due` row is only a TRIAL stall when the grace
// window was opened by a trial-conversion failure — an established payer's
// failed renewal is ordinary dunning, not a conveyor event.
export function classifyRider(row: {
  subscriptionStatus: string | null;
  cancelAtPeriodEnd: boolean;
  paymentGraceReason: string | null;
}): ConveyorState | null {
  if (row.subscriptionStatus === 'trialing') {
    return row.cancelAtPeriodEnd ? 'rollingOff' : 'running';
  }
  if (row.subscriptionStatus === 'past_due' && row.paymentGraceReason === 'trial') {
    return 'stalled';
  }
  return null;
}

// Fraction of the belt travelled, clamped to [0, 1]. Uses the rider's true
// span (boarded → charge) when both ends are known; otherwise it walks back
// `fallbackSpanMs` from the deadline so a rider with no recoverable boarding
// time still renders somewhere sane instead of pinned at 0.
export function beltProgress(input: {
  boardedAtMs: number | null;
  convertsAtMs: number | null;
  nowMs: number;
  fallbackSpanMs?: number;
}): number {
  const { convertsAtMs, nowMs } = input;
  if (convertsAtMs == null || !Number.isFinite(convertsAtMs)) return 0;
  const fallbackSpan = input.fallbackSpanMs ?? NOMINAL_TRIAL_DAYS * DAY_MS;
  const boarded =
    input.boardedAtMs != null && Number.isFinite(input.boardedAtMs) && input.boardedAtMs < convertsAtMs
      ? input.boardedAtMs
      : convertsAtMs - fallbackSpan;
  const span = convertsAtMs - boarded;
  if (span <= 0) return 1;
  return Math.min(1, Math.max(0, (nowMs - boarded) / span));
}

export type CountdownParts = {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  // True once the deadline has passed (or is unknown): the belt has delivered
  // and we're waiting on Stripe to report the outcome.
  expired: boolean;
};

// Split a remaining-milliseconds value into whole d/h/m/s. Floors rather than
// rounds so a countdown never displays a unit it hasn't fully reached, and
// clamps at zero so a deadline that slipped past between polls reads 0:00:00:00
// instead of going negative.
export function countdownParts(remainingMs: number | null): CountdownParts {
  if (remainingMs == null || !Number.isFinite(remainingMs) || remainingMs <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const totalSeconds = Math.floor(remainingMs / 1000);
  return {
    days: Math.floor(totalSeconds / 86_400),
    hours: Math.floor((totalSeconds % 86_400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    expired: false,
  };
}

// Fixed-width d:hh:mm:ss for the ticker. Zero-padded throughout so the digits
// don't jitter as they tick, and the day field is kept even at 0 so every row
// in the queue lines up in one column.
export function formatCountdown(remainingMs: number | null): string {
  const p = countdownParts(remainingMs);
  if (p.expired) return '0:00:00:00';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${p.days}:${pad(p.hours)}:${pad(p.minutes)}:${pad(p.seconds)}`;
}

// ── Historical outcomes ────────────────────────────────────────────────────
// What actually happened to trials that already reached the end of the belt.
// Reconstructed from the same `stripe_subscription_sync` / deletion audit
// streams core/subscriptionFlow.ts reads, scanned oldest-first.

export type ConveyorSyncEvent = {
  subId: string;
  // Stripe subscription status on this sync (trialing/active/past_due/…).
  status: string | null;
  // ET day-bucket key, or null when outside the window / unparseable.
  day: string | null;
};

export type ConveyorDeleteEvent = {
  subId: string | null;
  day: string | null;
};

export type ConveyorDayDelta = {
  // Trials that STARTED that day (first `trialing` sync for the sub).
  boarded: number;
  // Trials that converted: the sub's first `active` sync AFTER a trial.
  converted: number;
  // Trials that ended without ever being charged — cancelled/expired/deleted
  // while still un-converted.
  rolledOff: number;
  // Trials whose first conversion charge was declined (trialing → past_due).
  // Undecided: these later resolve into a conversion or a roll-off.
  stalled: number;
};

export function emptyConveyorDelta(): ConveyorDayDelta {
  return { boarded: 0, converted: 0, rolledOff: 0, stalled: 0 };
}

// Statuses that terminate a subscription without a successful charge.
const TERMINAL_STATUSES = new Set(['canceled', 'cancelled', 'incomplete_expired', 'unpaid']);

// Book per-day trial outcomes from an ORDERED (oldest-first) sync stream plus
// the terminal deletion rows.
//
// Only subs whose `trialing` sync we actually observed are attributed: a sub
// whose trial began before the retained window has no boarding event, so
// crediting its later `active` sync as a "conversion" would invent a trial we
// never saw. Under-counting the tail is the honest failure mode — it keeps the
// conversion RATE computed over a self-consistent cohort.
//
// A sub converts at most once (the first `active` after its trial); everything
// after that is ordinary subscription life, so a member who converts and later
// churns is NOT booked as a trial roll-off.
export function accumulateTrialOutcomes(
  syncs: ConveyorSyncEvent[],
  deletes: ConveyorDeleteEvent[],
): Map<string, ConveyorDayDelta> {
  const byDay = new Map<string, ConveyorDayDelta>();
  const book = (day: string | null, key: keyof ConveyorDayDelta) => {
    if (!day) return;
    const existing = byDay.get(day) ?? emptyConveyorDelta();
    existing[key] += 1;
    byDay.set(day, existing);
  };

  type SubState = { sawTrial: boolean; converted: boolean; stalled: boolean; terminal: boolean };
  const subs = new Map<string, SubState>();
  const stateFor = (subId: string): SubState => {
    let s = subs.get(subId);
    if (!s) {
      s = { sawTrial: false, converted: false, stalled: false, terminal: false };
      subs.set(subId, s);
    }
    return s;
  };

  for (const ev of syncs) {
    if (!ev.subId) continue;
    const s = stateFor(ev.subId);
    if (ev.status === 'trialing') {
      // Re-entering `trialing` after a conversion would be a brand-new trial on
      // the same sub id; treat the first boarding as the one that counts.
      if (!s.sawTrial) {
        s.sawTrial = true;
        book(ev.day, 'boarded');
      }
      continue;
    }
    if (!s.sawTrial || s.converted || s.terminal) continue;
    if (ev.status === 'active') {
      s.converted = true;
      book(ev.day, 'converted');
    } else if (ev.status === 'past_due') {
      // One stall per trial: Stripe re-syncs on every retry attempt.
      if (!s.stalled) {
        s.stalled = true;
        book(ev.day, 'stalled');
      }
    } else if (ev.status && TERMINAL_STATUSES.has(ev.status)) {
      s.terminal = true;
      book(ev.day, 'rolledOff');
    }
  }

  for (const ev of deletes) {
    if (!ev.subId) continue;
    const s = subs.get(ev.subId);
    // A deletion only ends a TRIAL when we saw the trial and it never converted;
    // `terminal` guards the sub whose cancel already booked via a sync.
    if (!s || !s.sawTrial || s.converted || s.terminal) continue;
    s.terminal = true;
    book(ev.day, 'rolledOff');
  }

  return byDay;
}

export type ConveyorOutcomes = ConveyorDayDelta & {
  windowDays: number;
  // converted / (converted + rolledOff). Null until at least one trial has
  // actually been decided — stalled trials are still in flight and are
  // deliberately excluded from the denominator rather than assumed lost.
  conversionRate: number | null;
};

export function summarizeTrialOutcomes(
  byDay: Map<string, ConveyorDayDelta>,
  days: string[],
  windowDays: number,
): ConveyorOutcomes {
  const total = emptyConveyorDelta();
  for (const day of days) {
    const d = byDay.get(day);
    if (!d) continue;
    total.boarded += d.boarded;
    total.converted += d.converted;
    total.rolledOff += d.rolledOff;
    total.stalled += d.stalled;
  }
  const decided = total.converted + total.rolledOff;
  return {
    ...total,
    windowDays,
    conversionRate: decided > 0 ? total.converted / decided : null,
  };
}

// ── Live belt summary ──────────────────────────────────────────────────────

export type ConveyorTotals = {
  running: number;
  rollingOff: number;
  stalled: number;
  // $/month riding the belt that is still heading for a charge (`running`).
  beltValue: number;
  // $/month already lost (rollingOff) or at risk of being lost (stalled).
  atRiskValue: number;
  // Deadline of the next rider due to be charged, ISO — the "next payday".
  // Only `running` riders count: a rolling-off rider's deadline is a departure,
  // not a charge.
  nextConversionAt: string | null;
};

export function summarizeRiders(riders: ConveyorRider[]): ConveyorTotals {
  const totals: ConveyorTotals = {
    running: 0,
    rollingOff: 0,
    stalled: 0,
    beltValue: 0,
    atRiskValue: 0,
    nextConversionAt: null,
  };
  let nextMs = Number.POSITIVE_INFINITY;
  for (const r of riders) {
    if (r.state === 'running') {
      totals.running += 1;
      totals.beltValue += r.monthlyValue;
      const at = r.convertsAt ? Date.parse(r.convertsAt) : NaN;
      if (Number.isFinite(at) && at < nextMs) {
        nextMs = at;
        totals.nextConversionAt = r.convertsAt;
      }
    } else if (r.state === 'rollingOff') {
      totals.rollingOff += 1;
      totals.atRiskValue += r.monthlyValue;
    } else {
      totals.stalled += 1;
      totals.atRiskValue += r.monthlyValue;
    }
  }
  return totals;
}

// Sort order for the queue: soonest deadline first, so the top row is always
// the next thing to happen. Riders with no deadline (a sub Stripe hasn't
// reported a period end for) sink to the bottom rather than sorting as "now".
export function sortRidersByDeadline(riders: ConveyorRider[]): ConveyorRider[] {
  return [...riders].sort((a, b) => {
    const at = a.convertsAt ? Date.parse(a.convertsAt) : NaN;
    const bt = b.convertsAt ? Date.parse(b.convertsAt) : NaN;
    const aOk = Number.isFinite(at);
    const bOk = Number.isFinite(bt);
    if (!aOk && !bOk) return 0;
    if (!aOk) return 1;
    if (!bOk) return -1;
    return at - bt;
  });
}
