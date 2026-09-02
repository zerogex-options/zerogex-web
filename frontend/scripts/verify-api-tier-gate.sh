#!/usr/bin/env bash
#
# Smoke-test the BFF consumer-tier gate (core/api/apiTierGate.ts) from OUTSIDE
# the app, against a running deployment. Unit tests prove the decision table;
# this proves the deployed BFF actually enforces it and — just as important —
# that nothing a paying member or an anonymous visitor needs got locked out.
#
# Usage:
#   ./scripts/verify-api-tier-gate.sh [BASE_URL]          # anonymous checks
#   ZGX_SESSION=<cookie> TIER=basic ./scripts/verify-api-tier-gate.sh [BASE_URL]
#   ZGX_SESSION=<cookie> TIER=pro   ./scripts/verify-api-tier-gate.sh [BASE_URL]
#
# BASE_URL defaults to https://zerogex.io. Get ZGX_SESSION from a logged-in
# browser: DevTools -> Application -> Cookies -> zgx_session.
#
# Exits non-zero if any check fails, so it can gate a deploy.

set -uo pipefail

BASE="${1:-https://zerogex.io}"
SESSION="${ZGX_SESSION:-}"
TIER="${TIER:-}"
PASS=0; FAIL=0

code() { # code <path> -> prints HTTP status, or 000 if unreachable
  local args=(-s -o /dev/null -w '%{http_code}' --max-time 20) out
  [ -n "$SESSION" ] && args+=(-H "Cookie: zgx_session=$SESSION")
  # curl prints %{http_code} (000 on a connection failure) and exits non-zero;
  # swallow the status so a dead host yields exactly "000", never "000" twice.
  out="$(curl "${args[@]}" "$BASE$1" 2>/dev/null)"
  [ -n "$out" ] && printf '%s' "$out" || printf '000'
}

# A host we cannot reach must never satisfy a check. Without this, every
# `refute` silently PASSES against a down deploy (000 != the refuted code) and
# the script reports green on a site that is serving nothing at all.
unreachable() { # unreachable <status> <path>
  [ "$1" = "000" ] || return 1
  FAIL=$((FAIL+1))
  printf '  \033[31mFAIL\033[0m 000 (unreachable) %s\n       -> No response from %s. Is it up, and is BASE_URL right?\n' "$2" "$BASE"
  return 0
}

expect() { # expect <want> <path> <why>
  local want="$1" path="$2" why="$3" got
  got="$(code "$path")"
  unreachable "$got" "$path" && return
  if [ "$got" = "$want" ]; then
    PASS=$((PASS+1)); printf '  \033[32mok\033[0m   %-3s %s\n' "$got" "$path"
  else
    FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %-3s (want %s) %s\n       -> %s\n' "$got" "$want" "$path" "$why"
  fi
}

refute() { # refute <unwanted> <path> <why>
  local bad="$1" path="$2" why="$3" got
  got="$(code "$path")"
  unreachable "$got" "$path" && return
  if [ "$got" != "$bad" ]; then
    PASS=$((PASS+1)); printf '  \033[32mok\033[0m   %-3s %s\n' "$got" "$path"
  else
    FAIL=$((FAIL+1)); printf '  \033[31mFAIL\033[0m %-3s (must not be %s) %s\n       -> %s\n' "$got" "$bad" "$path" "$why"
  fi
}

# Paths the gate protects. Anonymous must be refused; a member of the right
# tier must be served.
BASIC_PATHS=(
  "/api/market/historical?symbol=SPY&timeframe=5min&window_units=30"
  "/api/market/open-interest?symbol=SPY&underlying=SPY"
  "/api/market/session-levels?symbol=SPY"
  "/api/gex/summary?symbol=SPY&underlying=SPY"
)
PRO_PATHS=(
  "/api/tradeworkz/summary"
  "/api/tradeworkz/bots"
  "/api/tradeworkz/leaderboard?period=30d"
  "/api/tradeworkz/equity-curves?days=90"
  "/api/tradeworkz/performance-trend?days=60&windows=5,10,20"
)
# Must stay reachable with no session — anonymous chrome and free content.
OPEN_PATHS=(
  "/api/health"
  "/api/market/quote?symbol=SPY&underlying=SPY"
  "/api/market/session-closes?symbol=SPY&underlying=SPY"
  "/api/news"
)
# Free pages that must still render for a logged-out visitor.
PUBLIC_PAGES=( "/" "/chart" "/spx-gamma-levels" "/pricing" "/replay" )

echo "Target: $BASE"
if [ -z "$SESSION" ]; then
  echo
  echo "== Anonymous: premium data must be refused (401) =="
  for p in "${BASIC_PATHS[@]}" "${PRO_PATHS[@]}"; do
    expect 401 "$p" "PAYWALL BYPASS: this returns data to anyone."
  done

  echo
  echo "== Anonymous: open endpoints must NOT be refused =="
  for p in "${OPEN_PATHS[@]}"; do
    refute 401 "$p" "Over-gated: anonymous header chrome / free content is broken."
  done

  echo
  echo "== Anonymous: free pages must still render (200) =="
  for p in "${PUBLIC_PAGES[@]}"; do
    expect 200 "$p" "A free/SEO page is broken for logged-out visitors."
  done
else
  [ -n "$TIER" ] || { echo "Set TIER=basic or TIER=pro alongside ZGX_SESSION." >&2; exit 2; }
  echo "Session: supplied (TIER=$TIER)"
  echo
  echo "== Member ($TIER): Basic data must be served =="
  for p in "${BASIC_PATHS[@]}"; do
    refute 403 "$p" "A PAYING MEMBER IS LOCKED OUT of data their plan includes."
  done

  echo
  echo "== Member ($TIER): Pro data =="
  if [ "$TIER" = "pro" ]; then
    for p in "${PRO_PATHS[@]}"; do
      refute 403 "$p" "A PAYING PRO MEMBER IS LOCKED OUT of the TradeWorkz surface."
    done
  else
    for p in "${PRO_PATHS[@]}"; do
      expect 403 "$p" "A Basic member can reach Pro data — the gate is not enforcing."
    done
  fi

  echo
  echo "== Member: per-user prefs must stay reachable at any tier =="
  refute 403 "/api/tradeworkz/me/follows" "Follow management is broken; a downgraded member cannot unfollow."
  refute 403 "/api/tradeworkz/me/feed"    "The notification feed is broken."
fi

echo
echo "-------------------------------------------"
printf 'passed: %d   failed: %d\n' "$PASS" "$FAIL"
[ "$FAIL" -eq 0 ] || { echo "SMOKE TEST FAILED — do not leave this deployed."; exit 1; }
echo "All checks passed."
