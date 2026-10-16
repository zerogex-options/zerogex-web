#!/bin/bash
# Everyone with a failed payment in the last DAYS days (default 7), in one file,
# for a round of founder follow-ups (docs/outreach/*-payment-failure-followups.md).
# Run it through `make payment-failure-roundup`.
#
# WHY. A follow-up round used to start with `make diagnose-user` run by hand
# for each member, one at a time, and pasted back one at a time. This builds
# the whole picture in a single read-only pass:
#
#   1. whether the grace timers are running, and the grace settings, which
#      decide what a note may truthfully say about access;
#   2. every invoice with a failed attempt in the window, at its latest attempt:
#      kind, amount, attempts, the bank's reason, and whether it has been paid,
#      lost or is still open;
#   3. anyone past due right now whose failures are all older than the window;
#   4. each member's billing emails and access changes over the last 30 days,
#      founder notes included, so nobody gets a note on top of one they just had;
#   5. `make diagnose-user` for every member whose failed invoice is not paid.
#      Members who have paid appear in (2) only.
#
# READ-ONLY: sqlite3 opens the database with -readonly, and diagnose-user reads
# Stripe without changing anything.
#
#   DAYS=<n>             window in days (default 7)
#   OUT=<path>           where to write (default ~/payment-failures-<UTC time>.txt)
#   AUTH_DB_PATH=<path>  else AUTH_DB_PATH from frontend/.env.local, else
#                        frontend/data/auth.db

set -u
cd "$(dirname "${BASH_SOURCE[0]}")/../.." || exit 1

command -v sqlite3 >/dev/null 2>&1 || { echo "ERROR: sqlite3 CLI not found. Install it: sudo apt-get install -y sqlite3"; exit 1; }

db="${AUTH_DB_PATH:-}"
if [ -z "$db" ] && [ -f frontend/.env.local ]; then
  db=$(grep -E '^AUTH_DB_PATH=' frontend/.env.local | tail -1 | cut -d= -f2- | tr -d '"')
fi
[ -z "$db" ] && db="frontend/data/auth.db"
if [ ! -f "$db" ]; then echo "Auth DB not found at '$db' (set AUTH_DB_PATH)."; exit 1; fi
export AUTH_DB_PATH="$db"

DAYS="${DAYS:-7}"
case "$DAYS" in ''|*[!0-9]*) echo "DAYS must be a whole number of days, got '$DAYS'"; exit 1;; esac
OUT="${OUT:-$HOME/payment-failures-$(date -u +%Y%m%d-%H%M).txt}"
W="strftime('%Y-%m-%dT%H:%M:%fZ','now','-$DAYS days')"
q() { sqlite3 -readonly -header -separator ' | ' "$AUTH_DB_PATH" "$1"; }

echo "Collecting payment failures from the last $DAYS day(s) — $AUTH_DB_PATH (read-only)…"

{
echo "Payment-failure roundup, generated $(date -u +%Y-%m-%dT%H:%M:%SZ). Window: last $DAYS days."

echo; echo "=== Grace timers and settings ==="
systemctl list-timers --all --no-pager 2>/dev/null | grep -E 'payment-grace|grace-expiry' || echo "(no grace timers listed)"
grep -E '^(BILLING_PAYMENT_GRACE_DAYS|BILLING_GRACE_ENFORCEMENT_SKIP)=' frontend/.env.local 2>/dev/null || echo "(no grace settings in .env.local: defaults apply)"

echo; echo "=== Every invoice with a failed attempt in the window (latest attempt per invoice) ==="
q "SELECT lower(d.email) AS email, d.kind, d.tier, d.cadence,
          printf('%.2f %s', d.amount_due / 100.0, upper(COALESCE(d.currency, ''))) AS amount,
          (SELECT MIN(x.failed_at) FROM payment_declines x WHERE x.invoice_id = d.invoice_id) AS first_failed,
          d.failed_at AS last_failed, d.attempt_count AS att, d.category,
          COALESCE(d.decline_code, d.failure_code, '') AS code, d.outcome, COALESCE(d.lost_reason, '') AS lost_reason,
          COALESCE(d.method_type, '') AS method,
          trim(COALESCE(d.card_brand, '') || ' ' || COALESCE(d.card_last4, '') || ' ' || COALESCE(d.card_country, '')) AS card,
          COALESCE(d.network_status, '') AS network, COALESCE(d.outcome_type, '') AS outcome_type,
          COALESCE(d.next_attempt_at, '') AS next_attempt, COALESCE(d.grace_until, '') AS grace_until,
          d.invoice_id, COALESCE(d.subscription_id, '') AS subscription
     FROM payment_declines d
    WHERE d.invoice_id IN (SELECT invoice_id FROM payment_declines WHERE failed_at >= $W)
      AND d.attempt_count = (SELECT MAX(y.attempt_count) FROM payment_declines y WHERE y.invoice_id = d.invoice_id)
    ORDER BY d.outcome, d.failed_at DESC;"

echo; echo "=== Past due right now, but no failed attempt in the window (not diagnosed below) ==="
q "SELECT lower(email) AS email, tier, subscription_status, payment_grace_started_at
     FROM users
    WHERE subscription_status IN ('past_due', 'unpaid')
      AND lower(email) NOT IN (SELECT lower(email) FROM payment_declines WHERE failed_at >= $W AND email IS NOT NULL)
    ORDER BY payment_grace_started_at;"

echo; echo "=== Billing emails and events for these members, last 30 days ==="
q "SELECT lower(u.email) AS email, a.created_at, a.type,
          substr(replace(COALESCE(a.message, ''), char(10), ' '), 1, 160) AS message
     FROM audit_events a JOIN users u ON u.id = a.user_id
    WHERE a.created_at >= strftime('%Y-%m-%dT%H:%M:%fZ', 'now', '-30 days')
      AND lower(u.email) IN (SELECT lower(email) FROM payment_declines WHERE failed_at >= $W AND email IS NOT NULL)
      AND a.type <> 'stripe_payment_failed'
      AND (a.type LIKE 'stripe_%' OR a.type LIKE 'billing_%' OR a.type LIKE 'payment_%' OR a.type LIKE '%grace%'
           OR a.type LIKE '%email_sent%' OR a.type LIKE '%email_resent%' OR a.type LIKE 'cancel%'
           OR a.type LIKE 'refund%' OR a.type LIKE '%dispute%' OR a.type LIKE 'checkout%' OR a.type LIKE '%note%')
    ORDER BY 1, 2;"

echo; echo "=== diagnose-user for each member whose failed invoice is not paid ==="
sqlite3 -readonly "$AUTH_DB_PATH" \
  "SELECT DISTINCT lower(d.email) FROM payment_declines d
    WHERE d.failed_at >= $W AND d.email IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM payment_declines r WHERE r.invoice_id = d.invoice_id AND r.outcome = 'recovered')
    ORDER BY 1;" |
while read -r e; do
  echo; echo "################################ $e ################################"
  # The founding sections only matter for the July founding cohort, and the
  # hosted invoice URL is minted per fetch; the signed pay link is printed too.
  make --no-print-directory diagnose-user EMAIL="$e" </dev/null 2>&1 |
    awk '/^=== /{skip=($0 ~ /Founding state|Deferral analysis/)} !skip' | grep -v 'hosted_invoice_url:'
done
} > "$OUT" 2>&1

echo "Done: $(wc -l < "$OUT") lines in $OUT"
