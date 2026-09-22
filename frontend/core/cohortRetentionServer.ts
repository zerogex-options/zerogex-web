// Deliberately NOT marked `server-only`, and using explicit `./x.ts` imports —
// the same exception core/dailyMetrics.ts and core/excludedAccountsServer.ts
// take, for the same reason: scripts/audit-customer-classification.mts loads
// this under bare Node, where the guard throws and the "@/" alias does not
// resolve. It is still server code; it opens the SQLite DB through ./db.ts, and
// a client component that imported it for anything but a type would fail the
// build on node:sqlite.
import { getDb } from './db.ts';
import {
  buildCohortReport,
  type BillingCadence,
  type CadenceSource,
  type CohortAuditInput,
  type CohortReport,
  type CohortUserInput,
} from './cohortRetention.ts';
import { summarizeExcluded, type ExcludedAccountsSummary } from './excludedAccounts.ts';
import { loadExcludedAccounts } from './excludedAccountsServer.ts';
import { parseAmountTable } from './pricing.ts';
import { buildRenewalReport, type RenewalReport } from './renewalRetention.ts';
import { priceIdToSku } from './stripe.ts';

export type CohortRetentionPayload = CohortReport & {
  /** Who was held out of every number above, and under which rule. */
  excluded: ExcludedAccountsSummary;
  /** Monthly renewal ladder and the scheduled-cancellation risk pool. */
  renewals: RenewalReport;
  /** How many ever-paid customers the cadence filter can actually place. */
  cadenceCoverage: { monthly: number; annual: number; unknown: number };
};

const AUDIT_TYPES = [
  'stripe_subscription_sync', 'stripe_first_payment', 'stripe_cancellation_requested',
  'stripe_subscription_deleted', 'stripe_payment_failed', 'stripe_invoice_paid',
  'payment_recovered_email_sent', 'billing_payment_grace_active', 'billing_payment_grace_ended',
  // Carries `cadence=monthly|annual`. The ONLY surviving record of what a
  // churned customer was on: clearSubscriptionFromUser nulls stripe_price_id,
  // so without this every cancelled subscriber would drop out of a
  // cadence-filtered view and the renewal rate would be computed over survivors.
  'billing_checkout_started',
];

type InvoiceHistoryRow = {
  invoice_id: string;
  user_id: string | null;
  subscription_id: string | null;
  price_id: string | null;
  billing_reason: string | null;
  amount_paid: number;
  paid_at: string;
  period_start: string | null;
  period_end: string | null;
};

/**
 * Invoices imported from the Stripe API, rendered into the same audit-message
 * shape the webhook writes so one parser reads both sources. The cohort builder
 * dedupes on invoice id, so an invoice present in both is counted once.
 *
 * Returns [] when the table has not been created yet (a deploy that predates the
 * migration), because a missing backfill must degrade to "unobservable", never
 * to a crashed dashboard.
 */
function loadImportedInvoices(db: ReturnType<typeof getDb>): CohortAuditInput[] {
  let rows: InvoiceHistoryRow[];
  try {
    rows = db.prepare(`
      SELECT invoice_id, user_id, subscription_id, price_id, billing_reason,
             amount_paid, paid_at, period_start, period_end
        FROM stripe_invoice_history
       WHERE user_id IS NOT NULL AND status = 'paid'
       ORDER BY paid_at ASC
    `).all() as InvoiceHistoryRow[];
  } catch {
    return [];
  }
  return rows.map((row): CohortAuditInput => {
    const periodStartUnix = row.period_start == null ? null : Math.floor(Date.parse(row.period_start) / 1000);
    const periodEndUnix = row.period_end == null ? null : Math.floor(Date.parse(row.period_end) / 1000);
    return {
      userId: String(row.user_id),
      type: 'stripe_invoice_paid',
      createdAt: String(row.paid_at),
      message: `Invoice ${row.invoice_id} paid for sub ${row.subscription_id ?? 'unknown'}`
        + ` amount=${row.amount_paid}`
        + ` billing_reason=${row.billing_reason ?? 'unknown'}`
        + ` period_start=${periodStartUnix != null && Number.isFinite(periodStartUnix) ? periodStartUnix : 'unknown'}`
        + ` period_end=${periodEndUnix != null && Number.isFinite(periodEndUnix) ? periodEndUnix : 'unknown'}`
        + ` price=${row.price_id ?? 'unknown'}`,
    };
  });
}

/**
 * What was this customer billed on? Three sources, most reliable first, because
 * the obvious one disappears the moment a subscription is deleted.
 */
export function resolveCadence(
  currentPriceId: string | null,
  events: ReadonlyArray<CohortAuditInput>,
): { cadence: BillingCadence | null; source: CadenceSource } {
  if (currentPriceId) {
    const sku = priceIdToSku(currentPriceId);
    if (sku) return { cadence: sku.cadence, source: 'current_price' };
  }
  // The price id rides along on every paid invoice, and invoices are never
  // deleted — so a churned customer's cadence survives here.
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type !== 'stripe_invoice_paid') continue;
    const priceId = event.message.match(/\bprice=(price_[A-Za-z0-9]+)/)?.[1];
    const sku = priceId ? priceIdToSku(priceId) : null;
    if (sku) return { cadence: sku.cadence, source: 'invoice_price' };
  }
  // The period the invoice actually paid for. A price id that maps to no SKU —
  // a retired price, a founding rate, anything the env table has not been told
  // about — leaves the length of the billing period as plain evidence, and a
  // year-long period is an annual subscription whatever the price is called.
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type !== 'stripe_invoice_paid') continue;
    const start = Number(event.message.match(/\bperiod_start=(\d+)/)?.[1]);
    const end = Number(event.message.match(/\bperiod_end=(\d+)/)?.[1]);
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) continue;
    const days = (end - start) / 86_400;
    // Well clear of both: a month is 28–31 days, a year is 365–366.
    if (days >= 300) return { cadence: 'annual', source: 'invoice_period' };
    if (days <= 45) return { cadence: 'monthly', source: 'invoice_period' };
  }
  // Last resort: what they chose at checkout. Weakest of the four — a customer
  // who opened three checkout sessions and bought on the fourth leaves a trail
  // whose last entry is not necessarily what they bought.
  for (let index = events.length - 1; index >= 0; index--) {
    const event = events[index];
    if (event.type !== 'billing_checkout_started') continue;
    const cadence = event.message.match(/\bcadence=(monthly|annual)\b/)?.[1];
    if (cadence === 'monthly' || cadence === 'annual') return { cadence, source: 'checkout_audit' };
  }
  return { cadence: null, source: 'unknown' };
}

export function getCohortRetentionReport(cadence?: BillingCadence): CohortRetentionPayload {
  const db = getDb();
  // Admin, comped partners and comped members are removed from the SOURCE rows,
  // not netted out downstream, so they cannot reach a denominator anywhere in
  // the report. See core/excludedAccounts.ts for why each rule exists.
  const excludedAccounts = loadExcludedAccounts();
  const excludedIds = new Set(excludedAccounts.map((account) => account.id));
  const users = db.prepare(`
    SELECT id, email, created_at, first_payment_at, subscription_status, tier,
           stripe_price_id, current_period_end, cancel_at_period_end, signup_utm_source,
           founding_member_started_at, founding_lifetime_applied_at
      FROM users
     ORDER BY created_at ASC
  `).all() as Array<Record<string, string | number | null>>;
  const auditRows = db.prepare(`
    SELECT user_id, type, message, created_at
      FROM audit_events
     WHERE user_id IS NOT NULL AND type IN (${AUDIT_TYPES.map(() => '?').join(', ')})
     ORDER BY user_id, created_at ASC
  `).all(...AUDIT_TYPES) as Array<Record<string, string>>;

  const events: CohortAuditInput[] = [
    ...auditRows.flatMap((row): CohortAuditInput[] => excludedIds.has(row.user_id)
      ? []
      : [{ userId: row.user_id, type: row.type, message: row.message, createdAt: row.created_at }]),
    ...loadImportedInvoices(db).filter((event) => !excludedIds.has(event.userId)),
  ].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));

  const eventsByUser = new Map<string, CohortAuditInput[]>();
  for (const event of events) {
    const list = eventsByUser.get(event.userId) ?? [];
    list.push(event);
    eventsByUser.set(event.userId, list);
  }

  const mappedUsers = users
    .filter((row) => !excludedIds.has(String(row.id)))
    .map((row): CohortUserInput => {
      const id = String(row.id);
      const currentPriceId = row.stripe_price_id == null ? null : String(row.stripe_price_id);
      const resolved = resolveCadence(currentPriceId, eventsByUser.get(id) ?? []);
      return {
        id,
        email: String(row.email),
        createdAt: String(row.created_at),
        firstPaymentAt: row.first_payment_at == null ? null : String(row.first_payment_at),
        currentStatus: row.subscription_status == null ? null : String(row.subscription_status),
        currentTier: String(row.tier),
        currentPriceId,
        currentPeriodEnd: row.current_period_end == null ? null : String(row.current_period_end),
        cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
        signupUtmSource: row.signup_utm_source == null ? null : String(row.signup_utm_source),
        // Same rule the MRR snapshot uses: a founding member still on the intro
        // rate, before the lifetime discount replaces it.
        foundingRate: row.founding_member_started_at != null && row.founding_lifetime_applied_at == null,
        cadence: resolved.cadence,
        cadenceSource: resolved.source,
      };
    });

  // The cadence filter selects a SUBSET, and anything it cannot place is
  // reported rather than silently dropped — see cadenceCoverage below.
  const selectedUsers = cadence ? mappedUsers.filter((user) => user.cadence === cadence) : mappedUsers;
  const report = buildCohortReport(selectedUsers, events);

  // Renewals always read the full monthly population, never the cadence
  // selection: a monthly renewal ladder built from an annual filter is not a
  // smaller answer, it is a different question with no answer.
  const everyone = cadence ? buildCohortReport(mappedUsers, events) : report;
  const renewals = buildRenewalReport(everyone.users, parseAmountTable(process.env.MRR_PRICE_TABLE_JSON));

  const everPaid = everyone.users.filter((user) => user.firstPaidAt != null);
  return {
    ...report,
    excluded: summarizeExcluded(excludedAccounts),
    renewals,
    cadenceCoverage: {
      monthly: everPaid.filter((user) => user.cadence === 'monthly').length,
      annual: everPaid.filter((user) => user.cadence === 'annual').length,
      unknown: everPaid.filter((user) => user.cadence == null).length,
    },
  };
}
