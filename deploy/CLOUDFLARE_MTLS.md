# Locking the origin to Cloudflare — Authenticated Origin Pulls (mTLS)

This is the robust, no-IP-list way to ensure the **website** origin
(`zerogex.io`) can only be reached *through* Cloudflare, so Cloudflare's WAF /
DDoS protection can't be bypassed by hitting the origin IP directly. Cloudflare
presents a client certificate on every origin pull; nginx verifies it. Unlike an
IP allow-list, there's nothing to keep fresh.

It replaces the earlier IP-based "origin gate" (reverted) — no
`$realip_remote_addr` map, no staleness→403 failure mode.

## Scope & caveats (read first)

- **Website only.** `api.zerogex.io` is served **direct-to-origin** (grey-cloud
  DNS, its own nginx server block). It is deliberately *not* covered — enabling
  mTLS there would reject every direct API consumer (external keys, the
  NinjaTrader tool, etc.). This runbook only touches the `zerogex.io` vhost.
  Covering the API too is a separate project: proxy `api.zerogex.io` through
  Cloudflare first (and verify CF's ~100 s edge timeout doesn't break heavy API
  queries) — only then extend mTLS to it.
- **TLS-cert renewal is unaffected.** Let's Encrypt validates over `:80`
  (HTTP-01); mTLS is only on the `:443` website vhost.
- **Per-vhost client-cert verification relies on SNI.** It works on modern nginx
  (Ubuntu's build) for both TLS 1.2 and 1.3, but *always* prove it with the
  `optional` dry-run below before enforcing — a misconfig in `on` mode rejects
  all website traffic.

## How it's wired

`deploy/steps/070.ssl` reads `WEB_ORIGIN_MTLS` and injects into the `zerogex.io`
`:443` block only:

| `WEB_ORIGIN_MTLS` | nginx behavior |
|---|---|
| unset / `off` / `0` | disabled (default) |
| `optional` | request CF's cert, expose `$ssl_client_verify` via the `X-Origin-mTLS` response header, **do not reject** (dry-run) |
| `on` / `1` / `enforce` | reject any connection without a valid CF cert |

The Cloudflare origin-pull CA is fetched to
`/etc/nginx/cloudflare/authenticated_origin_pull_ca.pem` when enabling.

## Safe rollout (do this in order, ideally off-hours)

**1. Turn on Authenticated Origin Pulls in Cloudflare FIRST.**
Dashboard → SSL/TLS → Origin Server → *Authenticated Origin Pulls* → enable
(zone-level). This only makes CF *present* the cert; the origin still ignores it,
so there's no effect yet. (Zone-level uses Cloudflare's shared origin-pull cert,
which the CA above verifies. For per-hostname/customer certs, see the CF docs —
same nginx wiring, your own CA file.)

**2. Deploy in dry-run (`optional`) and verify.**
```bash
export WEB_ORIGIN_MTLS=optional WEB_DOMAIN=zerogex.io LETSENCRYPT_EMAIL=<you>
./deploy/deploy.sh --start-from ssl        # step 070 rewrites :443 + reloads; no HTTPS blip
```
Confirm real Cloudflare traffic authenticates (expect `SUCCESS`):
```bash
curl -sI https://zerogex.io/ | grep -i x-origin-mtls          # -> x-origin-mtls: SUCCESS
```
And confirm a **direct-to-origin** hit is seen as un-verified (expect `NONE`):
```bash
curl -sI --resolve zerogex.io:443:<ORIGIN_IP> https://zerogex.io/ | grep -i x-origin-mtls  # -> NONE
```
If website traffic shows anything other than `SUCCESS`, **stop** and investigate
— do not enforce.

**3. Enforce.**
```bash
export WEB_ORIGIN_MTLS=on
./deploy/deploy.sh --start-from ssl
```
Now direct-to-origin requests are refused at the TLS layer; only Cloudflare gets
through. Re-check that the site is healthy and 403/handshake errors aren't
hitting real users:
```bash
sudo tail -f /var/log/nginx/access.log | awk '$9==400 || $9==403'
```

## Rollback

Instant, no deploy needed:
```bash
# comment out the two mTLS directives in the :443 block, then reload
sudo sed -i '/Cloudflare Authenticated Origin Pulls (mTLS)/d; /ssl_client_certificate .*authenticated_origin_pull_ca/d; /ssl_verify_client/d' \
  /etc/nginx/sites-available/zerogex-web
sudo nginx -t && sudo systemctl reload nginx
```
And set `WEB_ORIGIN_MTLS=off` (or unset it) so the next deploy doesn't re-add it.
Optionally turn Authenticated Origin Pulls back off in the Cloudflare dashboard
(harmless to leave on — the origin simply stops verifying).

## Persistence

Because it's env-gated in `070.ssl`, the setting survives redeploys: keep
`WEB_ORIGIN_MTLS=on` in whatever environment the deploy sources so a future
`deploy` re-applies it. A hand-edit of the live config would be wiped the next
time step 070 runs — use the env var, not a manual edit.
