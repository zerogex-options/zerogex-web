// Pure logic for the PAUSE-instead-of-cancel retention lever. A paused
// subscription keeps its Stripe subscription alive (so it auto-resumes on its own)
// but is billed nothing and — per the webhook's entitlement gate — grants no
// access, so it is NOT churn: the member takes a bounded break and comes back
// instead of cancelling outright.
//
// Kept PURE (no imports) so it's unit-tested without Stripe. The webhook derives
// entitlement from derivePauseState(subscription.pause_collection); the
// cancel-flow route uses clampPauseMonths + computeResumesAtUnix to set a bounded
// pause_collection. Locked down in tests/subscriptionPause.test.ts.

export const PAUSE_MONTH_OPTIONS = [1, 2, 3] as const;
const MIN_PAUSE_MONTHS = 1;
const MAX_PAUSE_MONTHS = 3;

// The shape we read off subscription.pause_collection (declared locally so this
// module doesn't depend on the Stripe types). Both fields optional/nullable
// exactly as Stripe delivers them.
export type PauseCollectionInput =
  | {
      behavior?: string | null;
      resumesAt?: number | null;
    }
  | null
  | undefined;

export type PauseState = {
  // Whether billing is paused (any pause_collection behavior present).
  paused: boolean;
  // ISO of the scheduled auto-resume, or null (an indefinite pause, or not paused).
  resumesAtIso: string | null;
};

export function derivePauseState(input: PauseCollectionInput): PauseState {
  if (!input || !input.behavior) return { paused: false, resumesAtIso: null };
  const resumesAtIso =
    typeof input.resumesAt === 'number' && Number.isFinite(input.resumesAt)
      ? new Date(input.resumesAt * 1000).toISOString()
      : null;
  return { paused: true, resumesAtIso };
}

// Clamp a requested pause length to the allowed [1, 3] months. A retention pause
// is a short break, not an indefinite freeze — a paused sub pays nothing and has
// no access, so it must stay bounded. A malformed request defaults to 1 month.
export function clampPauseMonths(requested: unknown): number {
  const n =
    typeof requested === 'number'
      ? requested
      : typeof requested === 'string'
        ? Number(requested)
        : Number.NaN;
  if (!Number.isFinite(n)) return MIN_PAUSE_MONTHS;
  return Math.max(MIN_PAUSE_MONTHS, Math.min(MAX_PAUSE_MONTHS, Math.floor(n)));
}

// The Unix-seconds instant a pause of `months` starting at nowMs should resume.
// Calendar-month arithmetic (not 30×days) so "1 month" lands on the same day
// next month.
export function computeResumesAtUnix(nowMs: number, months: number): number {
  const d = new Date(nowMs);
  d.setMonth(d.getMonth() + months);
  return Math.floor(d.getTime() / 1000);
}
