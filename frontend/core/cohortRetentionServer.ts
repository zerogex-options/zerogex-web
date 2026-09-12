import 'server-only';
import { getDb } from './db';
import { buildCohortReport, type CohortAuditInput, type CohortUserInput } from './cohortRetention';

export function getCohortRetentionReport() {
  const db = getDb();
  const users = db.prepare(`
    SELECT id, email, created_at, first_payment_at, subscription_status, tier,
           stripe_price_id, current_period_end, cancel_at_period_end, signup_utm_source
      FROM users
     WHERE tier != 'admin'
     ORDER BY created_at ASC
  `).all() as Array<Record<string, string | number | null>>;
  const events = db.prepare(`
    SELECT user_id, type, message, created_at
      FROM audit_events
     WHERE user_id IS NOT NULL AND type IN (
       'stripe_subscription_sync', 'stripe_first_payment', 'stripe_cancellation_requested',
       'stripe_subscription_deleted', 'stripe_payment_failed'
     )
     ORDER BY user_id, created_at ASC
  `).all() as Array<Record<string, string>>;
  return buildCohortReport(
    users.map((row): CohortUserInput => ({
      id: String(row.id), email: String(row.email), createdAt: String(row.created_at),
      firstPaymentAt: row.first_payment_at == null ? null : String(row.first_payment_at),
      currentStatus: row.subscription_status == null ? null : String(row.subscription_status),
      currentTier: String(row.tier), currentPriceId: row.stripe_price_id == null ? null : String(row.stripe_price_id),
      currentPeriodEnd: row.current_period_end == null ? null : String(row.current_period_end),
      cancelAtPeriodEnd: Boolean(row.cancel_at_period_end),
      signupUtmSource: row.signup_utm_source == null ? null : String(row.signup_utm_source),
    })),
    events.map((row): CohortAuditInput => ({ userId: row.user_id, type: row.type, message: row.message, createdAt: row.created_at })),
  );
}
