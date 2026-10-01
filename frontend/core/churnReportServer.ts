import 'server-only';
import { buildChurnReport, type ChurnReport } from '@/core/churnSeries';
import { getFullSubscriberHistory } from '@/core/monitoring';
import { etBucketKeys } from '@/core/monitoringBuckets';
import { readSubscriberLedgerRows } from '@/core/subscriberLedgerSource';

// Reads what Admin → Monitoring → Churn is built from and hands it to the pure
// builder in core/churnSeries.ts.

/** The longest range the tab offers, in days. */
export const MAX_CHURN_WINDOW_DAYS = 730;

// How far back the Subscriber Ledger is read: past the longest range plus its
// 30-day lead-in, and far enough that every subscription's paid history is in
// view when it cancels. The same depth the Growth tab's daily rollup reads.
const LEDGER_SCAN_DAYS = 900;

export function getChurnReport(windowDays: number, now: Date = new Date()): ChurnReport {
  const paidCancelDays = readSubscriberLedgerRows(LEDGER_SCAN_DAYS, now.getTime())
    .filter((row) => row.kind === 'cancelScheduledPaid')
    .map((row) => etBucketKeys(new Date(row.at)).day);
  return buildChurnReport({
    today: etBucketKeys(now).day,
    windowDays: Math.min(MAX_CHURN_WINDOW_DAYS, windowDays),
    paidCancelDays,
    payingByDay: getFullSubscriberHistory(now),
  });
}
