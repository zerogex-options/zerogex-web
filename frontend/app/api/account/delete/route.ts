import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import {
  appendAuditEvent,
  clearAuthCookies,
  getClientIp,
  requireSession,
  validateCsrf,
} from '@/core/serverAuth';
import { getStripe } from '@/core/stripe';
import { revokeAllApiKeys } from '@/core/apiKeys';

// Carries Set-Cookie (clears the session on delete); must not be cached by the
// /api/ proxy. Same rationale as the logout + session routes.
export const dynamic = 'force-dynamic';

// Self-service account deletion. This is a SOFT delete: we stamp
// users.deleted_at and keep the row so churn history, audit trail, and Stripe
// linkage stay intact — but core/serverAuth.ts filters deleted_at out of every
// auth path, so the account is immediately and permanently locked out (no local
// or OAuth login, all live sessions severed). It doubles as the marketing-email
// opt-out: the win-back cohort (and any other outbound email) excludes
// deleted_at IS NOT NULL.
//
// Order of operations is chosen so a mid-way failure never leaves a
// still-usable account:
//   1. best-effort cancel any live Stripe subscription (billing stops),
//   2. stamp deleted_at (the lockout — the irreversible-by-user step),
//   3. sever all sessions + revoke API keys + audit,
//   4. clear the caller's cookies on the response.
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Never let an admin nuke themselves through the account UI — ensureBootstrapAdmin
  // won't resurrect a soft-deleted admin (its lookup ignores deleted_at), so this
  // would strand the operator. Admin removal is a deliberate ops action, not a
  // self-service button.
  if (actor.user.tier === 'admin') {
    return NextResponse.json(
      { error: 'Admin accounts cannot be deleted from here.' },
      { status: 403 },
    );
  }

  const db = getDb();
  const row = db
    .prepare('SELECT stripe_subscription_id, deleted_at FROM users WHERE id = ?')
    .get(actor.user.id) as
    | { stripe_subscription_id: string | null; deleted_at: string | null }
    | undefined;

  if (!row) {
    // Session resolved but the row is gone — treat as already deleted.
    const gone = NextResponse.json({ ok: true });
    gone.headers.set('Cache-Control', 'no-store, private');
    clearAuthCookies(gone);
    return gone;
  }

  // Idempotent: a double-submit (or a retry after the cookie was already
  // cleared) just re-confirms the deletion without touching Stripe again.
  if (row.deleted_at) {
    const already = NextResponse.json({ ok: true });
    already.headers.set('Cache-Control', 'no-store, private');
    clearAuthCookies(already);
    return already;
  }

  // 1. Stop billing. Cancel immediately (not at period end) — the account is
  // going away, so there's nothing to keep access for. Best-effort: a Stripe
  // failure (already-cancelled, network) must not block the deletion. The
  // customer.subscription.deleted webhook that follows only updates billing
  // columns; it never clears deleted_at.
  if (row.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(row.stripe_subscription_id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.warn(
        `[account-delete] Stripe cancel failed for ${actor.user.email} (sub ${row.stripe_subscription_id}): ${message}`,
      );
    }
  }

  // 2. The lockout. From here the account cannot authenticate.
  const now = new Date().toISOString();
  db.prepare('UPDATE users SET deleted_at = ?, updated_at = ? WHERE id = ?').run(
    now,
    now,
    actor.user.id,
  );

  // 3. Sever every live session (not just the caller's) and revoke API keys so
  // no credential outlives the account. Both best-effort — the deleted_at stamp
  // above is what actually locks the account.
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(actor.user.id);
  try {
    await revokeAllApiKeys(actor.user.email);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[account-delete] API key revoke failed for ${actor.user.email}: ${message}`);
  }

  appendAuditEvent({
    type: 'account_deleted',
    userId: actor.user.id,
    email: actor.user.email,
    ip: getClientIp(request),
    message: 'User self-deleted their account (soft delete; row retained)',
  });

  // 4. Clear the caller's cookies so the browser session ends cleanly.
  const response = NextResponse.json({ ok: true });
  response.headers.set('Cache-Control', 'no-store, private');
  clearAuthCookies(response);
  return response;
}
