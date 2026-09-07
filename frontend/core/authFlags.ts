export function isAuthEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === '1';
}

/**
 * Whether to offer "Continue with Apple" in the browser. The server-side
 * credentials (APPLE_CLIENT_ID / APPLE_REDIRECT_URI / the .p8 signing key)
 * are deliberately not NEXT_PUBLIC_, so the client can't derive this — flip
 * this flag once Sign in with Apple is configured in the Apple Developer
 * portal and the env vars are set. See docs/apple-sign-in-setup.md.
 */
export function isAppleAuthEnabled() {
  return process.env.NEXT_PUBLIC_APPLE_AUTH_ENABLED === '1';
}
