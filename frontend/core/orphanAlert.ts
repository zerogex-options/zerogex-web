// The operator alert for a payment that left its member with nothing.
//
// WHY THIS EXISTS. scan-orphan-payments.mts has always been able to find these;
// it printed them to a terminal nobody was watching, on a schedule that did not
// exist. Its own header describes the cost: "a stranded member sees a Public
// account, assumes the payment failed like the five dunning emails said, and
// quietly stops showing up."
//
// It became urgent when the dunning emails started carrying Stripe's hosted
// invoice link. That link is the right thing to send — it is the only way a
// member can settle an invoice on any card, the moment they have the money —
// but it also makes it far easier to pay an invoice whose period has already
// elapsed, which is precisely the payment that lands with no entitlement
// attached. Making that path easier without watching it would have been the
// worst of both.
//
// DETECTION ONLY. Nothing here restores access, refunds anything, or decides
// whether a member who paid for time they never got should be granted a fresh
// period. That last one is a pricing decision and stays with a human; this just
// makes sure a human finds out within a day.

export type OrphanBucket = 'recoverable' | 'lost_paid_time' | 'needs_review';

export const ORPHAN_BUCKET_HEADLINE: Record<OrphanBucket, string> = {
  recoverable: 'Paid, sitting on a free tier, and the plan to restore is unambiguous',
  lost_paid_time: 'Paid, then lost access before the period they bought was over',
  needs_review: 'Money collected with no entitlement, and the fix is not obvious',
};

export type OrphanFinding = {
  bucket: OrphanBucket;
  email: string;
  invoiceId: string;
  /** Already formatted for display, e.g. "$49.00". */
  amount: string;
  paidAt: string;
  coveredThrough: string;
  /** Bucket-specific colour: the ruling-out reason, or the paid days lost. */
  detail: string | null;
  /** The exact command to run. Every one of these is a dry run by default. */
  command: string;
};

/**
 * Buckets in the order a human should work them: the ones with a known fix
 * first, the judgement calls last.
 */
const BUCKET_ORDER: readonly OrphanBucket[] = ['recoverable', 'lost_paid_time', 'needs_review'];

export type OrphanAlert = {
  subject: string;
  /** Plain-text body lines. The HTML version is rendered from the same data. */
  findings: OrphanFinding[];
  /** Invoice ids this alert covers, for the caller's idempotency latch. */
  invoiceIds: string[];
};

/**
 * Build one alert covering everything new, or null when there is nothing to say.
 *
 * ONE EMAIL PER RUN, not one per finding. A daily sweep that turns up four
 * stranded members should arrive as one message a person reads, not four they
 * start filtering — the opposite trade-off from the cancellation alert, which
 * is per-event because each one carries a separate reply window.
 */
export function buildOrphanAlert(findings: readonly OrphanFinding[]): OrphanAlert | null {
  if (findings.length === 0) return null;
  const sorted = [...findings].sort(
    (a, b) =>
      BUCKET_ORDER.indexOf(a.bucket) - BUCKET_ORDER.indexOf(b.bucket)
      || a.paidAt.localeCompare(b.paidAt)
      || a.invoiceId.localeCompare(b.invoiceId),
  );
  const people = new Set(sorted.map((f) => f.email)).size;
  const subject =
    people === 1
      ? `ZeroGEX: ${sorted[0].email} paid and got nothing`
      : `ZeroGEX: ${people} members paid and got nothing`;
  return { subject, findings: sorted, invoiceIds: sorted.map((f) => f.invoiceId) };
}

/** Group for rendering, dropping the buckets with nothing in them. */
export function groupByBucket(
  findings: readonly OrphanFinding[],
): Array<{ bucket: OrphanBucket; headline: string; findings: OrphanFinding[] }> {
  return BUCKET_ORDER.map((bucket) => ({
    bucket,
    headline: ORPHAN_BUCKET_HEADLINE[bucket],
    findings: findings.filter((f) => f.bucket === bucket),
  })).filter((group) => group.findings.length > 0);
}

/** The audit message that latches one invoice, so it is alerted exactly once. */
export function orphanLatchMessage(invoiceId: string): string {
  return `Orphan-payment alert sent for invoice ${invoiceId}`;
}

export const ORPHAN_LATCH_AUDIT_TYPE = 'orphan_payment_alert_sent';
