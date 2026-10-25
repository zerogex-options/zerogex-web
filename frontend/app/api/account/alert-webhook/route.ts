import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/core/db';
import { appendAuditEvent, getClientIp, requireSession, validateCsrf } from '@/core/serverAuth';
import { tierIncludesWallAlerts } from '@/core/wallAlertsDelivery';
import {
  WebhookSendError,
  buildWebhookTestMessage,
  maskWebhookUrl,
  parseWebhookUrl,
  postWebhook,
  type AlertWebhookView,
  type WebhookProvider,
  type WebhookUrlProblem,
} from '@/core/wallAlertWebhook';

// A member's Discord / Slack webhook for wall alerts (one per member).
//
//   GET    — what is saved: provider, a masked address, and whether it works.
//   PUT    — {url}: check it is a Discord or Slack webhook, post a test
//            message, and save it only if that message landed.
//   POST   — post a test message to the saved webhook again (clears a
//            "not working" state when it lands).
//   DELETE — forget it. Rules keep their Discord / Slack choice; their alerts
//            are cancelled until a webhook is saved again.
//
// The full address never leaves the server: anyone holding it can post to the
// member's channel. Delivery itself is scripts/wall-alerts-webhooks.mts.

export const dynamic = 'force-dynamic';

interface WebhookRow {
  url: string;
  provider: WebhookProvider;
  created_at: string;
  updated_at: string;
  last_ok_at: string | null;
  failed_at: string | null;
  last_error: string | null;
}

const PROBLEM_TEXT: Record<WebhookUrlProblem, string> = {
  empty: 'Paste your Discord or Slack webhook address.',
  too_long: 'That address is too long to be a webhook.',
  not_url: 'That is not a web address.',
  not_https: 'Webhook addresses start with https://.',
  not_webhook:
    'That is not a Discord or Slack webhook. It should start with https://discord.com/api/webhooks/ or https://hooks.slack.com/services/.',
};

// One test post per member per window. A test is a request from our server to
// Discord or Slack; unthrottled, one member could get our address rate-limited
// by the provider for everyone's real alerts. PM2 runs one process, so memory
// is the right place for this.
const TEST_EVERY_MS = 10_000;
const lastTestAt = new Map<string, number>();

function testAllowed(userId: string): boolean {
  const now = Date.now();
  if (now - (lastTestAt.get(userId) ?? 0) < TEST_EVERY_MS) return false;
  lastTestAt.set(userId, now);
  return true;
}

function json(body: unknown, status = 200): NextResponse {
  // Per-member data: never cached by the /api/ proxy.
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store, private' } });
}

function view(row: WebhookRow | undefined): AlertWebhookView | null {
  if (!row) return null;
  return {
    provider: row.provider,
    masked: maskWebhookUrl(row.url),
    created_at: row.created_at,
    updated_at: row.updated_at,
    last_ok_at: row.last_ok_at,
    failed_at: row.failed_at,
    last_error: row.last_error,
  };
}

function load(userId: string): WebhookRow | undefined {
  return getDb()
    .prepare(
      'SELECT url, provider, created_at, updated_at, last_ok_at, failed_at, last_error FROM wall_alert_webhooks WHERE user_id = ?',
    )
    .get(userId) as WebhookRow | undefined;
}

function appUrl(request: NextRequest): string {
  return (process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/+$/, '');
}

type Member = NonNullable<Awaited<ReturnType<typeof requireSession>>>;

/** The signed-in member allowed to change alert delivery, or the response refusing them. */
async function allowedMember(request: NextRequest): Promise<Member | NextResponse> {
  if (!validateCsrf(request)) return json({ error: 'Invalid CSRF token' }, 403);
  const actor = await requireSession();
  if (!actor) return json({ error: 'Authentication required' }, 401);
  if (!tierIncludesWallAlerts(actor.user.tier)) {
    return json({ error: 'Wall alerts are part of the Basic plan.' }, 403);
  }
  return actor;
}

function sendFailure(err: unknown): string {
  return err instanceof WebhookSendError ? err.message : 'The test message could not be sent.';
}

export async function GET() {
  const actor = await requireSession();
  if (!actor) return json({ error: 'Authentication required' }, 401);
  return json({ webhook: view(load(actor.user.id)) });
}

export async function PUT(request: NextRequest) {
  const actor = await allowedMember(request);
  if (actor instanceof NextResponse) return actor;

  const body = (await request.json().catch(() => null)) as { url?: unknown } | null;
  const parsed = parseWebhookUrl(body?.url);
  if (!parsed.ok) return json({ error: PROBLEM_TEXT[parsed.problem], problem: parsed.problem }, 422);
  if (!testAllowed(actor.user.id)) {
    return json({ error: 'Wait a few seconds before trying again.', problem: 'too_soon' }, 429);
  }

  try {
    await postWebhook(parsed.url, buildWebhookTestMessage(parsed.provider, appUrl(request)));
  } catch (err) {
    return json({ error: sendFailure(err), problem: 'test_failed' }, 422);
  }

  const now = new Date().toISOString();
  getDb()
    .prepare(
      `INSERT INTO wall_alert_webhooks (user_id, url, provider, created_at, updated_at, last_ok_at, failed_at, last_error)
       VALUES (?, ?, ?, ?, ?, ?, NULL, NULL)
       ON CONFLICT(user_id) DO UPDATE SET
         url = excluded.url, provider = excluded.provider, updated_at = excluded.updated_at,
         last_ok_at = excluded.last_ok_at, failed_at = NULL, last_error = NULL`,
    )
    .run(actor.user.id, parsed.url, parsed.provider, now, now, now);
  appendAuditEvent({
    type: 'wall_alert_webhook_saved',
    userId: actor.user.id,
    email: actor.user.email,
    ip: getClientIp(request),
    message: `Saved a ${parsed.provider} webhook for wall alerts`,
  });
  return json({ webhook: view(load(actor.user.id)) });
}

export async function POST(request: NextRequest) {
  const actor = await allowedMember(request);
  if (actor instanceof NextResponse) return actor;

  const row = load(actor.user.id);
  if (!row) return json({ error: 'No webhook is saved.', problem: 'none' }, 404);
  if (!testAllowed(actor.user.id)) {
    return json({ error: 'Wait a few seconds before trying again.', problem: 'too_soon' }, 429);
  }

  const db = getDb();
  const now = new Date().toISOString();
  try {
    await postWebhook(row.url, buildWebhookTestMessage(row.provider, appUrl(request)));
  } catch (err) {
    // Only a webhook the provider says is gone is marked so; a timeout or a
    // rate limit says nothing about the address.
    if (err instanceof WebhookSendError && err.broken) {
      db.prepare('UPDATE wall_alert_webhooks SET failed_at = ?, last_error = ?, updated_at = ? WHERE user_id = ?').run(
        now,
        err.message,
        now,
        actor.user.id,
      );
    }
    return json({ error: sendFailure(err), problem: 'test_failed', webhook: view(load(actor.user.id)) }, 422);
  }
  db.prepare(
    'UPDATE wall_alert_webhooks SET last_ok_at = ?, failed_at = NULL, last_error = NULL, updated_at = ? WHERE user_id = ?',
  ).run(now, now, actor.user.id);
  return json({ ok: true, webhook: view(load(actor.user.id)) });
}

export async function DELETE(request: NextRequest) {
  if (!validateCsrf(request)) return json({ error: 'Invalid CSRF token' }, 403);
  const actor = await requireSession();
  if (!actor) return json({ error: 'Authentication required' }, 401);
  const removed = getDb().prepare('DELETE FROM wall_alert_webhooks WHERE user_id = ?').run(actor.user.id);
  if (Number(removed.changes) > 0) {
    appendAuditEvent({
      type: 'wall_alert_webhook_removed',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: 'Removed the wall-alert webhook',
    });
  }
  return json({ webhook: null });
}
