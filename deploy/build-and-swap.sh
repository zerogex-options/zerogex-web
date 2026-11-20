#!/usr/bin/env bash
#
# Put a new build of the website live only once it has finished building, and
# keep the build it replaced so it can go straight back.
#
#   deploy/build-and-swap.sh            build, swap in, restart PM2, check
#   deploy/build-and-swap.sh rollback   swap the previous build back in
#
# `make deploy`, `make rebuild` and `make rollback` run this after
# `nvm use 22`, so npm and pm2 below are the Node 22 ones.
#
# Why: the running site serves frontend/.next, and `next build` empties its
# output folder before it compiles. Deploys used to build straight into .next,
# so every deploy broke the live site for the length of the build, and a build
# that failed left it with nothing to serve. On Nov 19, 2026 a type error in a
# test file stopped the build at "Failed to type check", and the site returned
# 502 until the next morning.
#
# Now the build goes into .next-staging (ZEROGEX_DIST_DIR, which
# next.config.ts and next-sitemap.config.mjs read) while .next keeps serving.
# Only a finished build is moved into .next. The build it replaced stays in
# .next-previous. If the new one doesn't answer within HEALTH_WAIT_SECONDS of
# its restart, the previous one goes straight back.
#
# A build made in .next-staging runs from .next unchanged: Next 16 records the
# folder in each route, but `next start` replaces it with its own on every
# request. tsconfig.json lists .next-staging's type folders because `next
# build` adds any that are missing, and that would leave the tracked file
# edited on the server after every deploy.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FRONTEND="$REPO_ROOT/frontend"
LIVE="$FRONTEND/.next"
STAGING="$FRONTEND/.next-staging"
PREVIOUS="$FRONTEND/.next-previous"
FAILED="$FRONTEND/.next-failed"
SWAP="$FRONTEND/.next-swap"

APP_NAME="${WEB_PM2_NAME:-zerogex-web}"
WEB_PORT="${WEB_PORT:-3000}"
HEALTH_URL="http://127.0.0.1:${WEB_PORT}/terms"
HEALTH_WAIT_SECONDS="${HEALTH_WAIT_SECONDS:-60}"

log() { echo "[build-and-swap] $*"; }

build_id() { cat "$1/BUILD_ID" 2>/dev/null || echo "none"; }

# True once /terms answers with anything but a server error. It is rendered on
# every request, so it runs the same layout, session and proxy code as every
# other page, and it never calls the data backend. The homepage and
# /api/health both do, and a hung backend kept the homepage from answering at
# all in testing: no reason to throw away a good build. Next is ready in a
# second or two, but the box has just finished a build, so allow it a minute.
site_answers() {
  local deadline=$((SECONDS + HEALTH_WAIT_SECONDS)) code=""
  while [ "$SECONDS" -lt "$deadline" ]; do
    code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$HEALTH_URL" || true)"
    case "$code" in
      [234]??) log "  ✓ $HEALTH_URL answered $code"; return 0 ;;
    esac
    sleep 2
  done
  if [ -z "$code" ] || [ "$code" = "000" ]; then code="no answer"; fi
  log "  ✗ $HEALTH_URL gave $code for ${HEALTH_WAIT_SECONDS}s"
  return 1
}

# Folders move with the app stopped, so the old server can't regenerate a page
# (the 60 s gamma-levels pages) into the build that replaces it in the moment
# before its restart. The trap restarts the app even if a move fails.
stop_app() {
  pm2 stop "$APP_NAME" >/dev/null
  trap 'pm2 restart "$APP_NAME" >/dev/null 2>&1 || true' EXIT
}

start_app() {
  trap - EXIT
  log "Restarting $APP_NAME"
  pm2 restart "$APP_NAME"
}

build_and_swap() {
  cd "$FRONTEND"
  local live_id new_id
  live_id="$(build_id "$LIVE")"

  log "Building into .next-staging. The live site keeps serving build $live_id meanwhile."
  rm -rf "$STAGING" "$FAILED" "$SWAP"
  # Generated types only feed the type checker. The running site never reads
  # them. Left in place, the live build's copy would sit beside the new one
  # (tsconfig.json includes both folders) and fail the build on duplicate
  # declarations.
  rm -rf "$LIVE/types" "$LIVE/dev/types"
  if ! ZEROGEX_DIST_DIR=.next-staging npm run build; then
    rm -rf "$STAGING"
    log "✗ Build failed. The live site was not touched: it is still serving build $live_id."
    exit 1
  fi
  new_id="$(build_id "$STAGING")"

  log "Built $new_id. Swapping it in for $live_id."
  # The build before last. Nothing serves it, and deleting it first keeps the
  # app's stop below as short as possible.
  rm -rf "$PREVIOUS"
  stop_app
  if [ -d "$LIVE" ]; then mv "$LIVE" "$PREVIOUS"; fi
  mv "$STAGING" "$LIVE"
  start_app

  if site_answers; then
    # A rollback needs the build, not its image and data caches.
    rm -rf "$PREVIOUS/cache" || true
    log "✓ Live: build $new_id. The one it replaced ($live_id) is kept for: make rollback"
    return 0
  fi

  if [ ! -d "$PREVIOUS" ]; then
    log "✗ Build $new_id isn't answering, and there's no previous build to go back to. Check: make logs"
    exit 1
  fi
  log "✗ Build $new_id isn't answering. Putting build $live_id back."
  stop_app
  mv "$LIVE" "$FAILED"
  mv "$PREVIOUS" "$LIVE"
  start_app
  if site_answers; then
    log "✓ The site is back on build $live_id. make logs shows why $new_id didn't start."
  else
    log "✗ Build $live_id isn't answering either, so it isn't the new build. Check: make logs"
  fi
  rm -rf "$FAILED" || true
  exit 1
}

rollback() {
  if [ ! -d "$PREVIOUS" ]; then
    log "✗ There's no previous build in frontend/.next-previous to go back to."
    exit 1
  fi
  local live_id prev_id
  live_id="$(build_id "$LIVE")"
  prev_id="$(build_id "$PREVIOUS")"

  log "Rolling back from build $live_id to $prev_id."
  rm -rf "$SWAP"
  stop_app
  if [ -d "$LIVE" ]; then mv "$LIVE" "$SWAP"; fi
  mv "$PREVIOUS" "$LIVE"
  if [ -d "$SWAP" ]; then mv "$SWAP" "$PREVIOUS"; fi
  start_app

  if site_answers; then
    log "✓ Live: build $prev_id. make rollback again puts $live_id back."
    log "  Only the build went back, not the code: the next deploy builds the checked-out code again."
  else
    log "✗ Build $prev_id isn't answering either. Check: make logs"
    exit 1
  fi
}

case "${1:-}" in
  "") build_and_swap ;;
  rollback) rollback ;;
  *) echo "Usage: $0 [rollback]" >&2; exit 2 ;;
esac
