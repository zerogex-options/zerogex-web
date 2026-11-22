// The visitor's address, as nginx established it.
//
// nginx's real_ip module rewrites $remote_addr from Cloudflare's
// CF-Connecting-IP, trusted only from Cloudflare's ranges
// (deploy/steps/050.nginx), and sends it upstream as X-Real-IP, replacing any
// X-Real-IP the visitor sent. It also APPENDS $remote_addr to X-Forwarded-For
// ($proxy_add_x_forwarded_for), so the FIRST X-Forwarded-For entry is whatever
// the visitor typed. Reading that one let a script pick a new address for every
// request: it skipped every per-IP limit (login, password reset, signup, the
// levels email) and wrote any address it liked into the audit log. The LAST
// entry is the one nginx added, so it is the fallback.
//
// Kept free of Next imports so tests can load it.

export function clientIpFromHeaders(headers: { get(name: string): string | null }): string | null {
  const real = headers.get('x-real-ip')?.trim();
  if (real) return real;
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    const hops = forwarded
      .split(',')
      .map((hop) => hop.trim())
      .filter(Boolean);
    if (hops.length > 0) return hops[hops.length - 1];
  }
  return null;
}
