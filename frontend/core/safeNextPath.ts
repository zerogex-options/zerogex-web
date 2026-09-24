// Where to send someone after they sign in, from the ?next= they arrived with.
//
// THE BUG THIS EXISTS FOR. The login page accepted any `next` that began with
// "/", and `//evil.example` does. It handed that to router.replace, and to
// window.location after a password sign-in, and both resolve it as a
// protocol-relative URL: off the site. Because /login forwards a visitor who is
// ALREADY signed in straight away, zerogex.io/login?next=//evil.example sent a
// member to another site in one click — a phishing link carrying our domain.
//
// So the value is resolved the way the browser will resolve it and kept only
// if it lands on our own origin. That also catches what a prefix check misses:
// a backslash (`/\evil`) and a tab or newline the parser strips (`/\t/evil`)
// both become `//evil`. Dot segments are the subtle one: `/..//evil` stays on
// our origin while it is being parsed, then normalizes to the path `//evil`,
// which leaves the site the moment it is used — so the normalized path is
// checked again.
//
// Pure and browser-safe: the login and register pages use it, and so do the
// Google and Apple sign-in routes, which carry `next` across the provider
// round-trip in a cookie and must not be an open redirect either.

// Any fixed origin works: the question is only whether the value resolves to
// the SAME origin it was resolved against, which is true of paths and false of
// anything carrying a scheme or a host.
const BASE = 'https://zerogex.invalid';

export function safeNextPath(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return null;
  let url: URL;
  try {
    url = new URL(raw, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  const path = `${url.pathname}${url.search}${url.hash}`;
  if (path.startsWith('//') || path.startsWith('/\\')) return null;
  // Never back to an auth page: the signed-in forward would loop on it.
  if (url.pathname.startsWith('/login') || url.pathname.startsWith('/register')) return null;
  return path;
}

/**
 * Where a Google or Apple sign-in lands: the page the member was on their way
 * to, when there was one, else the default — /pricing for an account with no
 * paid access (the dashboard would only bounce it to /unauthorized), otherwise
 * the dashboard.
 */
export function postSignInDestination(rawNext: string | null | undefined, tier: string): string {
  return safeNextPath(rawNext) ?? (tier === 'public' ? '/pricing' : '/dashboard');
}
