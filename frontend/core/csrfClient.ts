'use client';

import { CSRF_COOKIE_NAME } from '@/core/auth';

/**
 * Read the double-submit CSRF token straight from its (non-HttpOnly) cookie.
 *
 * The server's validateCsrf() only checks that the `x-csrf-token` header
 * equals the `zgx_csrf` cookie, so the cookie's *current* value is the single
 * source of truth — echoing it back is what makes a state-changing request
 * pass. Reading it live (rather than from a copy captured earlier) is what
 * makes the auth forms immune to another request quietly rewriting the cookie.
 */
export function readCsrfCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${CSRF_COOKIE_NAME}=`;
  const match = document.cookie.split('; ').find((row) => row.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

/**
 * Resolve the CSRF token to send with a state-changing request.
 *
 * Returns the value actually stored in the `zgx_csrf` cookie, minting one via
 * /api/auth/csrf first if none exists yet. We deliberately return the COOKIE
 * value rather than the token in the /api/auth/csrf JSON body: the same cookie
 * is also written by /api/auth/session (with the session's CSRF secret) for any
 * still-valid session, and on the auth pages both requests fire from the shared
 * layout at mount. Whichever lands last owns the cookie, and only the cookie's
 * value will match server-side — so the header must echo the cookie, not a
 * separately-fetched token that may have been clobbered.
 */
export async function getCsrfToken(): Promise<string | null> {
  const existing = readCsrfCookie();
  if (existing) return existing;

  try {
    await fetch('/api/auth/csrf', { credentials: 'include' });
  } catch {
    return null;
  }
  return readCsrfCookie();
}
