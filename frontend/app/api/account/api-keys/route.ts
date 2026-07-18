import { NextRequest, NextResponse } from 'next/server';
import {
  appendAuditEvent,
  attachSessionCookie,
  getClientIp,
  getSessionFromRequest,
  requireSession,
  validateCsrf,
} from '@/core/serverAuth';
import { isApiKeyEligibleTier } from '@/core/auth';
import {
  ApiKeyAdminError,
  getActiveApiKey,
  isApiKeyAdminConfigured,
  provisionApiKey,
} from '@/core/apiKeys';

export const dynamic = 'force-dynamic';

function noStore(response: NextResponse): NextResponse {
  // User-specific payload; same no-store rationale as the other account routes
  // (nginx's /api/ cache slot isn't partitioned by the session cookie).
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

// Report the caller's API-key status: whether they're entitled (Pro+), whether
// the feature is configured on this deploy, and — if they have one — the active
// key's metadata (never the secret; that is only ever returned once, by POST).
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return noStore(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));
  }

  const eligible = isApiKeyEligibleTier(session.user.tier);
  const configured = isApiKeyAdminConfigured();

  let hasActiveKey = false;
  let key: Awaited<ReturnType<typeof getActiveApiKey>> = null;
  let serviceError = false;

  if (eligible && configured) {
    try {
      key = await getActiveApiKey(session.user.email);
      hasActiveKey = key !== null;
    } catch (err) {
      // Degrade gracefully: the account page must still render. Log the
      // discriminating reason server-side; the UI shows a soft error and the
      // user can retry via the button (which surfaces the real status).
      serviceError = true;
      const message = err instanceof Error ? err.message : String(err);
      console.warn(`[api-keys] status lookup failed for ${session.user.email}: ${message}`);
    }
  }

  const response = noStore(
    NextResponse.json({ eligible, configured, serviceError, hasActiveKey, key }),
  );
  if (session.rotatedToken) attachSessionCookie(response, session.rotatedToken);
  return response;
}

// Generate (or regenerate) the caller's API key. Regeneration is implicit:
// provisioning always revokes any existing active key first, so a member has
// at most one live key. Pro-gated + CSRF-protected. The raw secret is returned
// exactly once in this response and never stored client-side.
export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Re-checked against the fresh DB read requireSession performs, so a member
  // whose Pro access just lapsed can't mint a key on a stale session.
  if (!isApiKeyEligibleTier(actor.user.tier)) {
    return NextResponse.json(
      { error: 'API keys are available on the Pro plan. Upgrade to generate one.' },
      { status: 403 },
    );
  }

  if (!isApiKeyAdminConfigured()) {
    return NextResponse.json(
      { error: 'API key generation is not available right now. Please try again later.' },
      { status: 503 },
    );
  }

  try {
    const key = await provisionApiKey(actor.user.email);
    appendAuditEvent({
      type: 'api_key_generated',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: `Generated API key ${key.name} (prefix ${key.prefix})`,
    });
    return noStore(
      NextResponse.json({
        ok: true,
        apiKey: key.apiKey,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt,
      }),
    );
  } catch (err) {
    const status = err instanceof ApiKeyAdminError && err.status ? err.status : 502;
    const message = err instanceof Error ? err.message : 'Could not generate API key';
    console.error(`[api-keys] provision failed for ${actor.user.email}: ${message}`);
    // Don't leak upstream internals to the browser; a generic message is enough
    // for the user, and the server log above has the detail.
    return NextResponse.json(
      { error: 'Could not generate your API key. Please try again.' },
      { status },
    );
  }
}
