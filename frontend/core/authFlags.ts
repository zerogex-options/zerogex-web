export function isAuthEnabled() {
  return process.env.NEXT_PUBLIC_AUTH_ENABLED === '1';
}
