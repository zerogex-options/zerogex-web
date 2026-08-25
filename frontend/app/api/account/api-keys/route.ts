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
import { MAX_ACTIVE_API_KEYS } from '@/core/apiKeyLimits';
import { sanitizeKeyLabel } from '@/core/apiKeyNaming';
import {
  ApiKeyAdminError,
  isApiKeyAdminConfigured,
  listActiveApiKeys,
  provisionApiKey,
  revokeApiKey,
  type ApiKeyInfo,
} from '@/core/apiKeys';

export const dynamic = 'force-dynamic';

function noStore(response: NextResponse): NextResponse {
  // User-specific payload; same no-store rationale as the other account routes
  // (nginx's /api/ cache slot isn't partitioned by the session cookie).
  response.headers.set('Cache-Control', 'no-store, private');
  return response;
}

const AT_CAP_MESSAGE =
  `You can have ${MAX_ACTIVE_API_KEYS} API keys at a time. ` +
  'Revoke one you no longer use, then create a new one.';

// Report the caller's API-key status: whether they're entitled (Pro+), whether
// the feature is configured on this deploy, and the metadata for each key they
// hold (never the secret; that is only ever returned once, by POST).
export async function GET(request: NextRequest) {
  const session = await getSessionFromRequest(request);
  if (!session) {
    return noStore(NextResponse.json({ error: 'Authentication required' }, { status: 401 }));
  }

  const eligible = isApiKeyEligibleTier(session.user.tier);
  const configured = isApiKeyAdminConfigured();

  let keys: ApiKeyInfo[] = [];
  let serviceError = false;

  if (eligible && configured) {
    try {
      keys = await listActiveApiKeys(session.user.email);
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
    NextResponse.json({
      eligible,
      configured,
      serviceError,
      keys,
      maxKeys: MAX_ACTIVE_API_KEYS,
      // Retained for any client still on the pre-multi-key payload: a
      // mid-deploy browser holding the old bundle keeps rendering its single
      // key instead of showing "no key". `key` is the newest, which is what
      // that UI meant by "your key".
      hasActiveKey: keys.length > 0,
      key: keys.length > 0 ? keys[keys.length - 1] : null,
    }),
  );
  if (session.rotatedToken) attachSessionCookie(response, session.rotatedToken);
  return response;
}

// Generate an additional API key for the caller. Minting is additive: the
// user's other keys keep working, so putting a key on a second machine no
// longer silently kills the first. Capped at MAX_ACTIVE_API_KEYS, Pro-gated,
// and CSRF-protected. The raw secret is returned exactly once in this response
// and never stored client-side.
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

  // The device label is optional; an absent or unparseable body just means
  // "no label", and the key service falls back to the email local-part.
  const body = (await request.json().catch(() => ({}))) as { label?: unknown };
  const label = typeof body.label === 'string' ? sanitizeKeyLabel(body.label) : '';

  try {
    // Enforce the cap here rather than trusting the UI's disabled button. The
    // key service enforces it too and answers 409 (handled below), so this
    // check is for the friendlier message, not for the guarantee.
    const existing = await listActiveApiKeys(actor.user.email);
    if (existing.length >= MAX_ACTIVE_API_KEYS) {
      return noStore(NextResponse.json({ error: AT_CAP_MESSAGE }, { status: 409 }));
    }

    const key = await provisionApiKey(actor.user.email, label);
    appendAuditEvent({
      type: 'api_key_generated',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: `Generated API key ${key.name} (prefix ${key.prefix}); ${existing.length + 1} of ${MAX_ACTIVE_API_KEYS} active`,
    });
    return noStore(
      NextResponse.json({
        ok: true,
        apiKey: key.apiKey,
        id: key.id,
        name: key.name,
        prefix: key.prefix,
        createdAt: key.createdAt,
      }),
    );
  } catch (err) {
    const status = err instanceof ApiKeyAdminError && err.status ? err.status : 502;
    const message = err instanceof Error ? err.message : 'Could not generate API key';
    console.error(`[api-keys] provision failed for ${actor.user.email}: ${message}`);
    // The key service refusing on its own cap (a race against another tab, or
    // this deploy's mirror of the number drifting from its authority) is a real
    // answer, not an outage — tell the user what to do about it.
    if (status === 409) {
      return NextResponse.json({ error: AT_CAP_MESSAGE }, { status: 409 });
    }
    // Don't leak upstream internals to the browser; a generic message is enough
    // for the user, and the server log above has the detail.
    return NextResponse.json(
      { error: 'Could not generate your API key. Please try again.' },
      { status },
    );
  }
}

// Revoke ONE of the caller's keys, leaving the others working — the point of
// holding several. CSRF-protected and scoped to the caller's own keys (the key
// service matches on user_id as well as key id, so another account's id
// revokes nothing).
//
// Deliberately not Pro-gated: revoking is cleanup, it only ever removes the
// caller's own access, and a member whose Pro lapsed should still be able to
// tidy up rather than be locked out of their own key list.
export async function DELETE(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const actor = await requireSession();
  if (!actor) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!isApiKeyAdminConfigured()) {
    return NextResponse.json(
      { error: 'API key management is not available right now. Please try again later.' },
      { status: 503 },
    );
  }

  // Query param rather than a body: DELETE bodies are optional in the spec and
  // dropped by some intermediaries, and there's nothing here worth hiding —
  // the key id isn't a secret, and CSRF still rides in the header.
  const raw = request.nextUrl.searchParams.get('id');
  const id = Number(raw);
  if (!raw || !Number.isInteger(id) || id < 1) {
    return NextResponse.json({ error: 'A valid key id is required.' }, { status: 400 });
  }

  try {
    const revoked = await revokeApiKey(actor.user.email, id);
    if (!revoked) {
      // Absent, already revoked, or someone else's — indistinguishable to the
      // caller on purpose, so this can't be used to probe for other accounts'
      // key ids.
      return NextResponse.json({ error: 'That key no longer exists.' }, { status: 404 });
    }
    appendAuditEvent({
      type: 'api_key_revoked',
      userId: actor.user.id,
      email: actor.user.email,
      ip: getClientIp(request),
      message: `Revoked API key ${revoked.name} (prefix ${revoked.prefix})`,
    });
    return noStore(NextResponse.json({ ok: true, id: revoked.id, name: revoked.name }));
  } catch (err) {
    const status = err instanceof ApiKeyAdminError && err.status ? err.status : 502;
    const message = err instanceof Error ? err.message : 'Could not revoke API key';
    console.error(`[api-keys] revoke failed for ${actor.user.email} key=${id}: ${message}`);
    return NextResponse.json(
      { error: 'Could not revoke that key. Please try again.' },
      { status },
    );
  }
}
