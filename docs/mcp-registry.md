# Publishing the ZeroGEX MCP server to the official registry

Operator runbook for listing `https://zerogex.io/mcp` in the [Model Context
Protocol registry](https://registry.modelcontextprotocol.io), so Claude, ChatGPT,
Cursor and other MCP clients can discover it by name instead of being handed a URL.

The server itself is `frontend/app/mcp/route.ts`; the manifest published here is
`server.json` at the repository root. Nothing in this runbook has to run for the
endpoint to work — a registry listing is discovery, not plumbing.

## What is being published

The registry stores metadata only. It never proxies traffic, so the entry is a
pointer at our own deployment:

| Field | Value |
| --- | --- |
| Name | `io.zerogex/gamma-levels` |
| Transport | `streamable-http` |
| URL | `https://zerogex.io/mcp` |
| Auth | none — reading is free and unauthenticated |

The name is fixed by the authentication method. DNS authentication requires the
reverse-DNS form of a domain we control, so `zerogex.io` gives `io.zerogex/*`.
Changing it means re-verifying, so treat it as permanent.

## Prerequisites

1. **The endpoint is live in production.** The registry requires a remote server
   to be publicly reachable at its stated URL, and clients will try it the moment
   it lists. Confirm first:

   ```bash
   curl -sS -X POST https://zerogex.io/mcp \
     -H 'Content-Type: application/json' \
     -H 'Accept: application/json, text/event-stream' \
     -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | head -c 400
   ```

   That should return a JSON-RPC result listing `get_gamma_levels` and
   `get_market_gamma_overview`. If it returns HTML, the route did not deploy.

   Or run the full check, which is the same thing plus twelve more:

   ```bash
   cd frontend && npm run verify:mcp
   ```

   Run it against the **public URL**, not `127.0.0.1:3000`. A localhost run only
   proves the Next.js process serves the route; it says nothing about whether
   Nginx passes POST through to it, which is the half that breaks on a deploy.

2. **DNS control over `zerogex.io`**, to add one apex TXT record.

3. **OpenSSL 3.0 or later.** The Ed25519 path below needs it. macOS ships
   LibreSSL as the system `openssl`, which fails with `Algorithm Ed25519 not
   found`; use `brew install openssl@3` and call that binary explicitly.

## One-time: prove domain ownership

Generate a key pair and publish the public half as a TXT record.

```bash
MY_DOMAIN="zerogex.io"

openssl genpkey -algorithm Ed25519 -out key.pem

PUBLIC_KEY="$(openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64)"
echo "${MY_DOMAIN}. IN TXT \"v=MCPv1; k=ed25519; p=${PUBLIC_KEY}\""
```

Add that TXT record **on the apex** (`zerogex.io`), not under a selector like
`_mcp-auth.zerogex.io`. Placement follows SPF conventions, not DKIM; a record
under a selector is invisible to the registry and fails with a generic signature
error that does not point at the cause.

`key.pem` is a credential: it is what authorises publishing under the
`io.zerogex` namespace. `.gitignore` now covers `*.pem` and `mcp-registry-auth`,
because the publisher runs from the repository root and that is exactly where
the key gets generated — but keep the real copy in the password manager next to
the other deploy secrets, not only on the box. If it is ever rotated, delete the
old TXT record at the same time: a stale record is tried first and breaks
verification with a generic signature error that does not name the cause.

## Install the publisher CLI

```bash
curl -L "https://github.com/modelcontextprotocol/registry/releases/latest/download/mcp-publisher_$(uname -s | tr '[:upper:]' '[:lower:]')_$(uname -m | sed 's/x86_64/amd64/;s/aarch64/arm64/').tar.gz" \
  | tar xz mcp-publisher && sudo mv mcp-publisher /usr/local/bin/
```

Homebrew works too: `brew install mcp-publisher`.

## Publish

Run from the repository root, where `server.json` lives.

```bash
MY_DOMAIN="zerogex.io"

mcp-publisher validate

PRIVATE_KEY="$(openssl pkey -in key.pem -noout -text | grep -A3 "priv:" | tail -n +2 | tr -d ' :\n')"
mcp-publisher login dns --domain "${MY_DOMAIN}" --private-key "${PRIVATE_KEY}"

mcp-publisher publish
```

Confirm it landed:

```bash
curl -sS "https://registry.modelcontextprotocol.io/v0/servers?search=io.zerogex"
```

## Publishing an update

Bump `version` in `server.json` — the registry rejects a republish at an existing
version, and version ranges (`^1.2.3`, `1.x`) are rejected outright. Then
`mcp-publisher login dns ...` and `mcp-publisher publish` again.

The version in `server.json` should track `SERVER_INFO.version` in
`frontend/core/mcp/protocol.ts`, which is what the server reports over the wire
during `initialize`. They are two separate strings and nothing enforces the
match, so change both together.

Bump it when the tool surface changes — a tool added, removed or renamed, or an
input schema changed. Do not bump it for wording changes inside a tool result.

## Optional follow-ups

- **Icons.** The registry accepts `icons[]` pointing at HTTPS images (PNG, JPEG,
  SVG or WebP, ideally on our own domain) which clients show in server pickers.
  There is no stable public icon URL on zerogex.io today, so the field is
  omitted rather than pointed at something that might move.
- **Repository link.** `repository` is recommended for transparency, and lets
  people read the server's source before connecting. It is omitted because this
  repository is private; add it if that ever changes.

## What not to publish here

This entry covers the free delayed endpoint only. The real-time API is a Pro
feature behind a per-user key, and a registry listing implies an endpoint anyone
can connect to. If a keyed real-time server ever ships, it belongs in a separate
entry declaring its `headers` requirement — not as a version bump on this one.
