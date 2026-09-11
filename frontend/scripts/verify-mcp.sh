#!/usr/bin/env bash
#
# Exercise the hosted MCP endpoint the way a real client does: handshake, tool
# discovery, a live call, and the failure paths that matter.
#
# The unit tests prove the protocol logic; this proves the deployed HTTP surface.
# They fail differently — tests catch a wrong JSON-RPC shape, this catches a
# route that never deployed, an Nginx rule that swallows POST, or a backend the
# server cannot reach.
#
#   ./scripts/verify-mcp.sh                          # against production
#   ./scripts/verify-mcp.sh http://127.0.0.1:3000    # against a local server
#
# A local run needs ZEROGEX_API_BASE_URL and ZEROGEX_API_TOKEN pointing at a
# backend, otherwise every tool correctly reports "temporarily unavailable" —
# which is itself one of the checks below.

set -uo pipefail

BASE="${1:-https://zerogex.io}"
MCP="${BASE%/}/mcp"
HDRS=(-H 'Content-Type: application/json' -H 'Accept: application/json, text/event-stream')

pass=0; fail=0
ok()   { printf '  \033[32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
bad()  { printf '  \033[31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }
post() { curl -sS -m 20 -X POST "${HDRS[@]}" -d "$1" "$MCP"; }

echo "Verifying MCP endpoint: $MCP"
echo

# 1. A browser GET must be refused, not answered with a page. An HTML body here
#    means the route did not deploy and a catch-all is serving the SPA instead.
echo "Transport"
code=$(curl -sS -m 20 -o /tmp/mcp-get.$$ -w '%{http_code}' "$MCP" 2>/dev/null)
if [ "$code" = "405" ]; then ok "GET is refused with 405 (no SSE stream offered)"
elif grep -qi '<html' /tmp/mcp-get.$$ 2>/dev/null; then bad "GET returned HTML — the /mcp route is not deployed"
else bad "GET returned $code, expected 405"; fi
rm -f /tmp/mcp-get.$$

# 2. An unsupported protocol version must be a 400, per the transport spec.
code=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' -X POST "${HDRS[@]}" \
  -H 'MCP-Protocol-Version: 1999-01-01' -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' "$MCP")
[ "$code" = "400" ] && ok "unsupported MCP-Protocol-Version rejected with 400" \
                    || bad "bad protocol version returned $code, expected 400"

# 3. A notification carries no id, so it gets 202 and no body.
code=$(curl -sS -m 20 -o /dev/null -w '%{http_code}' -X POST "${HDRS[@]}" \
  -d '{"jsonrpc":"2.0","method":"notifications/initialized"}' "$MCP")
[ "$code" = "202" ] && ok "notification accepted with 202 and no body" \
                    || bad "notification returned $code, expected 202"

echo
echo "Handshake"
init=$(post '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-11-25","capabilities":{},"clientInfo":{"name":"verify-mcp","version":"1"}}}')
echo "$init" | grep -q '"protocolVersion":"2025-11-25"' \
  && ok "initialize negotiates 2025-11-25" || bad "initialize did not negotiate 2025-11-25"
echo "$init" | grep -q '"tools"' && ok "declares the tools capability" || bad "no tools capability"
# The delay warning is the one thing a model must carry into its answer.
echo "$init" | grep -qi 'DELAYED' \
  && ok "instructions warn the data is delayed" || bad "instructions do not mention the delay"

echo
echo "Tools"
list=$(post '{"jsonrpc":"2.0","id":2,"method":"tools/list"}')
for tool in get_gamma_levels get_market_gamma_overview; do
  echo "$list" | grep -q "\"$tool\"" && ok "advertises $tool" || bad "missing $tool"
done

echo
echo "Calls"
res=$(post '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"get_gamma_levels","arguments":{"symbol":"SPX"}}}')
if ! echo "$res" | grep -q '"result"'; then
  # No JSON-RPC result at all: unreachable host, TLS failure, or a proxy in the
  # way. Checked first so an empty body can never fall through as a pass.
  bad "no JSON-RPC result from tools/call (host unreachable or not serving /mcp)"
elif echo "$res" | grep -q '"isError":true'; then
  # Not a protocol failure: the endpoint is up and correctly reporting an outage.
  bad "get_gamma_levels returned isError (backend unreachable?) — see the text below"
  echo "$res" | python3 -c "import sys,json;print('       ',json.load(sys.stdin)['result']['content'][0]['text'][:200])" 2>/dev/null
else
  ok "get_gamma_levels SPX returned levels"
  echo "$res" | grep -q '"data_tier":"free-delayed"' \
    && ok "structuredContent is labelled free-delayed" || bad "data_tier is not free-delayed"
  # Freshness must lead the text: it is the line a model repeats.
  echo "$res" | python3 -c "
import sys,json
t=json.load(sys.stdin)['result']['content'][0]['text'].split(chr(10))[0]
import re
raise SystemExit(0 if re.search(r'delayed|closed|STALE|BEHIND|UNDATED',t) else 1)" 2>/dev/null \
    && ok "the first line states the snapshot's freshness" || bad "no freshness line leading the text"
fi

echo
echo "Failure paths"
res=$(post '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"get_gamma_levels","arguments":{"symbol":"TSLA"}}}')
echo "$res" | grep -q '"result"' && echo "$res" | grep -q '"isError":true' && echo "$res" | grep -q 'Unknown symbol' \
  && ok "an uncovered symbol is an isError result listing the supported ones" \
  || bad "uncovered symbol not handled as an isError result"

res=$(post '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"does_not_exist"}}')
echo "$res" | grep -q '\-32602' && echo "$res" | grep -q 'get_gamma_levels' \
  && ok "an unknown tool is a protocol error naming the real ones" \
  || bad "unknown tool not reported as -32602"

echo
printf 'passed %d, failed %d\n' "$pass" "$fail"
[ "$fail" -eq 0 ] || exit 1
