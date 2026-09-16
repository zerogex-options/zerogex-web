#!/usr/bin/env bash
# Regenerates docs/automated-email-audit.pdf: every automated email rendered as
# the recipient sees it, with its exact trigger and schedule.
#
#   make email-audit                 # -> docs/automated-email-audit.pdf (committed)
#   make email-audit OUT=/tmp/audit  # working files somewhere else
#
# DEV MACHINE ONLY: printing needs a Chromium, which the production box has no
# reason to carry. The committed PDF is the artifact; prod never renders it.
#
# Run it after ANY change to email copy — a stale audit is worse than none,
# because it reads as authoritative. The catalogue metadata (what fires each
# email and when) lives in catalog.mjs and is maintained by hand; the bodies are
# captured from the live senders and never are.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND="$(cd "$HERE/../.." && pwd)"
OUT="${OUT:-$FRONTEND/build/email-audit}"
NODE_RUN=(node --experimental-strip-types --no-warnings)

mkdir -p "$OUT"
rm -f "$OUT/scripts.ndjson"

# Resend is never reached: capture.mts swaps the transport for a stub, so these
# are throwaway values that only have to satisfy the mailer's env checks.
export RESEND_API_KEY="${RESEND_API_KEY:-re_audit_stub}"
export RESEND_FROM_EMAIL="${RESEND_FROM_EMAIL:-ZeroGEX <hello@zerogex.io>}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-https://zerogex.io}"

echo "==> rendering mailer.ts senders"
(cd "$HERE" && "${NODE_RUN[@]}" capture.mts "$OUT/captured.json")

# The three operator alerts build their HTML inline rather than through
# mailer.ts, so they are rendered by running the real script against the stub.
# Best-effort: signup-alarm needs an auth DB and unit-failure-alert needs a
# journal, so off-box one or both degrade. The report tolerates a missing body.
echo "==> rendering standalone operator scripts"
export CAPTURE_OUT="$OUT/scripts.ndjson"
export UNIT_ALERT_EMAIL="${UNIT_ALERT_EMAIL:-ops@zerogex.io}"
export FOH_REMINDER_EMAIL="${FOH_REMINDER_EMAIL:-ops@zerogex.io}"
export SIGNUP_ALARM_EMAIL="${SIGNUP_ALARM_EMAIL:-ops@zerogex.io}"

# Exit 0 is NOT proof of a render: these scripts exit cleanly when they decide
# there is nothing to alert about, which reported "ok" for a body that was never
# captured. Check the ndjson for this id instead.
capture_script() {
  local id="$1"; shift
  CAPTURE_ID="$id" "${NODE_RUN[@]}" --import="$HERE/stub-resend.mts" "$@" >/dev/null 2>&1 || true
  if grep -q "\"__id\":\"$id\"" "$CAPTURE_OUT" 2>/dev/null; then
    echo "    ok   $id"
  else
    echo "    skip $id (no send issued — needs the live box)"
  fi
}
cd "$FRONTEND"
capture_script unit-failure-alert     scripts/send-unit-failure-alert.mts --unit zerogex-web-trial-reminders.service
capture_script foh-donation-reminder  scripts/send-foh-donation-reminder.mts --quarter "Q3 2026"
# --force clears the active-hours and cooldown gates but NOT the signup floor, so
# on a box with healthy signups the alarm correctly declines to fire and renders
# nothing. An absurd --min puts the count below the floor so the body renders.
capture_script signup-alarm           scripts/send-signup-alarm.mts --force --min 999999

echo "==> building report"
(cd "$HERE" && node build-report.mjs "$OUT")

# Chromium prints the PDF. Prefer an explicit CHROME, then the Playwright
# install this repo already depends on, then whatever is on PATH.
CHROME="${CHROME:-}"
if [ -z "$CHROME" ]; then
  for c in /opt/pw-browsers/chromium-*/chrome-linux/chrome \
           "$HOME/.cache/ms-playwright"/chromium-*/chrome-linux/chrome \
           "$(command -v chromium || true)" "$(command -v google-chrome || true)"; do
    [ -x "$c" ] && CHROME="$c" && break
  done
fi
if [ -z "$CHROME" ]; then
  cat >&2 <<MSG

Everything rendered, but there is no Chromium here to print the PDF.
HTML (complete, openable in any browser): $OUT/report.html

This is a DEV-MACHINE command — the production box has no browser and does not
need one. Run it where you edit the copy, and commit the refreshed
docs/automated-email-audit.pdf. To print it here anyway, either:
  CHROME=/path/to/chrome make email-audit
  npx playwright install chromium && make email-audit
  sudo apt-get install -y chromium-browser && make email-audit
MSG
  exit 1
fi

echo "==> printing PDF via $(basename "$(dirname "$(dirname "$CHROME")")")"
"$CHROME" --headless --disable-gpu --no-sandbox --no-pdf-header-footer \
  --print-to-pdf="$OUT/automated-email-audit.pdf" "file://$OUT/report.html" 2>/dev/null

# The copy under docs/ is the one that ships in the repo, so refresh it on every
# run — a committed audit that lags the copy it documents is worse than none.
# NO_DOC_COPY=1 skips it (e.g. rendering a scratch build somewhere else).
DOC_PDF="$(cd "$FRONTEND/.." && pwd)/docs/automated-email-audit.pdf"
if [ -z "${NO_DOC_COPY:-}" ]; then
  cp "$OUT/automated-email-audit.pdf" "$DOC_PDF"
fi

echo
echo "PDF:  $OUT/automated-email-audit.pdf"
[ -z "${NO_DOC_COPY:-}" ] && echo "      $DOC_PDF (committed copy, refreshed)"
echo "HTML: $OUT/report.html"
