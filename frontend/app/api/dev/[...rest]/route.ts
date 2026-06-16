import { NextRequest, NextResponse } from 'next/server';

import { proxyToApi } from '@/core/api/proxy';
import { requireSession, validateCsrf } from '@/core/serverAuth';

/**
 * Developer-portal BFF proxy.
 *
 * Wraps the generic `proxyToApi` with a hard session-required gate. The
 * downstream FastAPI surface at /api/dev/* requires `X-End-User-Token` —
 * which only gets minted when a session is resolved — so calling these
 * endpoints without a session would 400 from the backend anyway. We
 * short-circuit at the BFF with a 401 so:
 *
 *  (a) the on-page experience for a logged-out user is a clean redirect
 *      to /login rather than a confusing "bad request" toast, and
 *  (b) we never leak the fact that the dev portal exists to a probe by
 *      hand-crafting a request that ignores the session cookie.
 *
 * State-changing methods (POST/DELETE/PATCH/PUT) additionally require a
 * matching `x-csrf-token` header — same defense the rest of the app uses
 * for /api/account, /api/billing, etc. Without it a malicious cross-
 * origin call could ride a logged-in user's session and mint API keys
 * for them; the BFF key alone authenticates *the website* upstream, not
 * the user.
 *
 * The proxy itself adds `Authorization: Bearer <ZEROGEX_API_TOKEN>` —
 * the website BFF key, which must be provisioned with the dev_portal
 * scope (TIER_FULL or wildcard).
 */
async function gated(request: NextRequest): Promise<NextResponse> {
  const session = await requireSession();
  if (!session) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
  if (request.method !== 'GET' && request.method !== 'HEAD' && !validateCsrf(request)) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { status: 403, headers: { 'Cache-Control': 'no-store, private' } },
    );
  }
  const resp = await proxyToApi(request);
  // The dev portal mutates state (create/rotate/revoke API keys) and the
  // GET responses are user-specific. Force-uncached so nginx's shared
  // /api/ cache slot (partitioned only by auth header) can't serve a
  // stale view from another user across a session swap.
  resp.headers.set('Cache-Control', 'no-store, private');
  return resp;
}

export const dynamic = 'force-dynamic';

export const GET = gated;
export const POST = gated;
export const DELETE = gated;
export const PATCH = gated;
export const PUT = gated;
