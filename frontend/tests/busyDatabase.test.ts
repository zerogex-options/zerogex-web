import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  DAY,
  HOUR,
  NOW_MS,
  REPO,
  at,
  auditCount,
  column,
  createBusyDb,
  httpCalls,
  scriptsDir,
  sentTo,
  sqlite3Missing,
  type RunOptions,
  type Fixture,
} from './support/busyDb.ts';

// Every script that opens the auth database waits for a busy one: first read
// from the source for all of them, then the ones that write, each run for real
// (--yes, --alert, --apply) while another process holds the database's write
// lock.
//
// The live site writes to that database whenever a member is active (session
// refreshes, users.last_seen_at), and the sqlite3 CLI's busy timeout is zero
// unless the caller sets one. So a script's write that lands while the site
// holds the lock fails on the spot with "database is locked (5)". In an email
// job that write is the mark that says the member was emailed, and it comes
// after the email: the member stays unmarked, gets the same email again on the
// next tick, and the unit fails and mails an alert. Each script now waits for
// the lock, retries a lock error, and writes its mark and its audit row in one
// transaction. Each test here fails on a script that does not.
//
// send-product-update.mts and send-verified-never-paid.mts got this fix
// separately. tradeworkz-notify-deliver.mts and enforce-payment-grace.mts only
// read this database, and in WAL mode a reader never waits on a writer.
//
// Every test gets its own copy of the real schema, so one script never sees
// another's members. Resend is replaced by the email-audit stub, and Stripe and
// the ZeroGEX backend by tests/support/stub-http.mts; tests/support/busyDb.ts
// has the rest. The scripts shell out to the sqlite3 CLI, so the tests that run
// them skip where that isn't installed.

const { fixture, member, audit, run, runWhileLocked } = await createBusyDb('busy-db');

// ---------------------------------------------------------------------------
// Every script, scheduled or run by hand, read from its source: each way it
// opens the database waits for the lock. A script added later is checked the
// day it lands. tests/scheduledJobsBusyDb.test.ts checks the same for what
// the timers run, found through their unit files.
// ---------------------------------------------------------------------------

function scriptFiles(dirPath: string): string[] {
  return fs.readdirSync(dirPath, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dirPath, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : scriptFiles(full);
    return /\.(?:mts|mjs|ts|js|sh)$/.test(entry.name) ? [full] : [];
  });
}
const scriptSources = scriptFiles(scriptsDir).map((file) => ({
  name: path.relative(REPO, file),
  source: fs.readFileSync(file, 'utf8'),
}));

// An argument list that passes the wait itself, or spreads a helper defined in
// the same file that does (send-product-update.mts builds its arguments with
// sqliteArgs()).
function passesWait(source: string, args: string): boolean {
  const waits = (text: string) => /['"]-cmd['"]/.test(text) && /\.timeout /.test(text);
  if (waits(args)) return true;
  return [...args.matchAll(/\.\.\.(\w+)\(/g)].some(([, helper]) =>
    waits(new RegExp(`function ${helper}\\([\\s\\S]*?\\n\\}`).exec(source)?.[0] ?? ''),
  );
}

test('every sqlite3 CLI call in a script waits for a busy database', () => {
  const missing: string[] = [];
  let checked = 0;
  for (const { name, source } of scriptSources) {
    for (const m of source.matchAll(/\b(?:execFileSync|execFile|spawnSync|spawn)\(\s*['"]sqlite3['"]\s*,\s*\[([^\]]*)\]/g)) {
      // The probe that checks the CLI is installed opens no database.
      if (/['"]-version['"]/.test(m[1])) continue;
      checked += 1;
      if (!passesWait(source, m[1])) missing.push(`${name}: sqlite3 [${m[1].replace(/\s+/g, ' ').trim()}]`);
    }
  }
  assert.ok(checked >= 50, `found only ${checked} sqlite3 calls, so the search is missing some`);
  assert.deepEqual(missing, [], 'pass -cmd ".timeout N" before the database path');
});

test('every hand-fix command a script prints stops at its first failed statement', () => {
  // Read from a heredoc, sqlite3 carries on past a failed statement and a
  // closing COMMIT keeps what ran before it. -bail stops there instead, so the
  // printed command can't half-record a member either.
  const missing = scriptSources.flatMap(({ name, source }) =>
    source
      .split('\n')
      .filter((line) => line.includes("<<'SQL'") && !line.includes('sqlite3 -bail '))
      .map((line) => `${name}: ${line.trim()}`),
  );
  assert.deepEqual(missing, []);
});

test('every node:sqlite open in a script sets a busy timeout', () => {
  const missing: string[] = [];
  for (const { name, source } of scriptSources) {
    const opens = source.match(/new DatabaseSync\(/g)?.length ?? 0;
    const timeouts = source.match(/PRAGMA busy_timeout/g)?.length ?? 0;
    if (timeouts < opens) missing.push(`${name}: ${opens} opens, ${timeouts} busy timeouts`);
  }
  assert.deepEqual(missing, []);
});

test('every sqlite3 command in a shell script or a make recipe waits for a busy database', () => {
  const lines = [
    ...scriptSources
      .filter(({ name }) => name.endsWith('.sh'))
      .flatMap(({ name, source }) => source.split('\n').map((line) => ({ where: name, line }))),
    ...fs
      .readFileSync(path.join(REPO, 'Makefile'), 'utf8')
      .split('\n')
      .filter((line) => line.startsWith('\t'))
      .map((line) => ({ where: 'Makefile', line })),
  ];
  const missing: string[] = [];
  for (const { where, line: raw } of lines) {
    if (/^\s*#/.test(raw)) continue;
    // Not invocations: the install check and the messages that name the CLI.
    const line = raw.replace(/command -v sqlite3/g, '').replace(/echo\s+"[^"]*"/g, '').replace(/echo\s+'[^']*'/g, '');
    if (!/\bsqlite3\s/.test(line)) continue;
    // The backup's integrity check opens its own private snapshot.
    if (/\bsqlite3\s+"\$\$snap"/.test(line)) continue;
    if (!/-cmd\s+"\.timeout \d+"/.test(line)) missing.push(`${where}: ${raw.trim()}`);
  }
  assert.deepEqual(missing, []);
});

// ---------------------------------------------------------------------------
// The customer emails the timers send with YES=1.
// ---------------------------------------------------------------------------

test('send-verify-reminders: a busy database waits, so the signup is reminded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'verify-reminders');
  const id = member(f, 'unverified@example.com', { created_at: at(-4 * HOUR), email_verified_at: null });

  // Its first write is the link's token, minted before the send.
  const first = await runWhileLocked(f, 'send-verify-reminders.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed, 0 skipped \(undeliverable\)\.$/m);
  assert.ok(column(f, id, 'verify_reminder_email_sent_at'), 'marked as sent');
  assert.equal(auditCount(f, 'verify_reminder_email_sent', id), 1, 'one audit row, written with the mark');
  const tokens = f.db.prepare('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ?').get(id) as { n: number };
  assert.equal(tokens.n, 1, 'one verification token');

  const second = run(f, 'send-verify-reminders.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible users: +0$/m);
  assert.deepEqual(sentTo(f), ['unverified@example.com']);
});

test('send-checkout-recovery: a busy database waits, so nobody is nudged twice', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'checkout-recovery');
  const id = member(f, 'abandoned@example.com');
  audit(f, id, 'billing_checkout_started', at(-48 * HOUR), 'tier=pro cadence=monthly');

  const first = await runWhileLocked(f, 'send-checkout-recovery.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'checkout_recovery_email_sent_at'), 'marked as sent');
  assert.equal(auditCount(f, 'checkout_recovery_email_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-checkout-recovery.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible users: +0$/m);
  assert.deepEqual(sentTo(f), ['abandoned@example.com']);
});

test('send-trial-reminders: a busy database waits, so the trialer is reminded once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'trial-reminders');
  const id = member(f, 'trialing@example.com', {
    subscription_status: 'trialing',
    stripe_subscription_id: 'sub_trial',
    current_period_end: at(48 * HOUR),
    created_at: at(-5 * DAY),
  });

  // No STRIPE_SECRET_KEY: the reminder goes out without the charge line.
  const first = await runWhileLocked(f, 'send-trial-reminders.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'trial_reminder_email_sent_at'), 'marked as sent');
  assert.equal(auditCount(f, 'trial_reminder_email_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-trial-reminders.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible users: +0$/m);
  assert.deepEqual(sentTo(f), ['trialing@example.com']);
});

test('send-trial-value-nudge: a busy database waits, so the trialer is nudged once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'trial-value-nudge');
  const id = member(f, 'day-two@example.com', {
    subscription_status: 'trialing',
    stripe_subscription_id: 'sub_value',
    current_period_end: at(120 * HOUR),
    created_at: at(-2 * DAY),
  });

  // No ZEROGEX_API_TOKEN: the ordinary value email, no levels to fetch.
  const first = await runWhileLocked(f, 'send-trial-value-nudge.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'trial_midpoint_email_sent_at'), 'marked as sent');
  assert.equal(auditCount(f, 'trial_value_nudge_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-trial-value-nudge.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible users: +0$/m);
  assert.deepEqual(sentTo(f), ['day-two@example.com']);
});

test('send-reactivation: a busy database waits, so the signup is offered the trial once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'reactivation');
  const id = member(f, 'cold@example.com');

  const first = await runWhileLocked(f, 'send-reactivation.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'reactivation_email_sent_at'), 'marked as sent');
  assert.equal(auditCount(f, 'reactivation_email_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-reactivation.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible this run: +0$/m);
  assert.deepEqual(sentTo(f), ['cold@example.com']);
});

test('send-card-expiry-reminders: a busy database waits, so the member is warned once per card', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'card-expiry');
  const id = member(f, 'expiring@example.com', {
    subscription_status: 'active',
    stripe_subscription_id: 'sub_card',
    stripe_customer_id: 'cus_card',
    current_period_end: at(20 * DAY),
  });
  // A card that runs out at the end of the month ten days from now: always
  // inside the 45-day window, never already past.
  const soon = new Date(NOW_MS + 10 * DAY);
  const expYear = soon.getUTCFullYear();
  const expMonth = soon.getUTCMonth() + 1;
  const opts: RunOptions = {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_card': {
        id: 'sub_card',
        object: 'subscription',
        status: 'active',
        customer: 'cus_card',
        default_payment_method: {
          id: 'pm_card',
          object: 'payment_method',
          card: { brand: 'visa', last4: '4242', exp_month: expMonth, exp_year: expYear },
        },
      },
    },
  };

  const first = await runWhileLocked(f, 'send-card-expiry-reminders.mts', ['--yes'], opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 skipped, 0 failed\.$/m);
  assert.equal(column(f, id, 'card_expiry_notified_ym'), `${expYear}-${String(expMonth).padStart(2, '0')}`, 'marked for this card');
  assert.equal(auditCount(f, 'card_expiry_reminder_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-card-expiry-reminders.mts', ['--yes'], opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Done\. 0 sent, 1 skipped, 0 failed\.$/m);
  assert.deepEqual(sentTo(f), ['expiring@example.com']);
});

test('send-grace-expiry-warnings: a busy database waits, so the member is warned once per window', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'grace-expiry');
  // Three-day window opened 60 hours ago: 12 hours left.
  const anchor = at(-60 * HOUR);
  const id = member(f, 'past-due@example.com', {
    subscription_status: 'past_due',
    stripe_subscription_id: 'sub_past_due',
    payment_grace_started_at: anchor,
    payment_grace_reason: 'renewal',
  });

  // No STRIPE_SECRET_KEY: the warning goes out without the card details.
  const first = await runWhileLocked(f, 'send-grace-expiry-warnings.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.equal(column(f, id, 'payment_grace_warning_sent_for'), anchor, 'marked for this window');
  assert.equal(auditCount(f, 'grace_expiry_warning_email_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-grace-expiry-warnings.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Due to warn: +0$/m);
  assert.deepEqual(sentTo(f), ['past-due@example.com']);
});

// ---------------------------------------------------------------------------
// The lapsed-member emails. Their timers run DIGEST=1, which writes nothing;
// the send is a --yes run after the digest is approved.
// ---------------------------------------------------------------------------

// Paid, left 40 days ago, and logged back in three days ago: inside both the
// win-back and the return-intent windows.
function churnedMember(f: Fixture, email: string): string {
  const id = member(f, email, {
    created_at: at(-200 * DAY),
    subscription_lapsed: 1,
    first_payment_at: at(-190 * DAY),
  });
  audit(f, id, 'stripe_cancellation_requested', at(-41 * DAY), 'Cancellation requested for sub_old cancel_feedback=too_expensive');
  audit(f, id, 'stripe_subscription_deleted', at(-40 * DAY), 'Subscription sub_old deleted');
  audit(f, id, 'login_success', at(-3 * DAY), 'Login');
  return id;
}

test('send-winback: a busy database waits, so the member is offered the win-back once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'winback');
  const id = churnedMember(f, 'churned@example.com');

  const first = await runWhileLocked(f, 'send-winback.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'winback_email_sent_at'), 'marked as sent');
  assert.equal(auditCount(f, 'winback_email_sent', id), 1, 'one audit row, written with the mark');

  const second = run(f, 'send-winback.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible users: +0$/m);
  assert.deepEqual(sentTo(f), ['churned@example.com']);
});

test('send-return-intent: a busy database waits, so the returning member is answered once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'return-intent');
  const id = churnedMember(f, 'came-back@example.com');

  const first = await runWhileLocked(f, 'send-return-intent.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'return_intent_email_sent_at'), 'cooldown stamped');
  assert.equal(auditCount(f, 'return_intent_email_sent', id), 1, 'one audit row, written with the stamp');

  const second = run(f, 'send-return-intent.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible: +0$/m);
  assert.deepEqual(sentTo(f), ['came-back@example.com']);
});

// ---------------------------------------------------------------------------
// The jobs that change an account, or alert the operator.
// ---------------------------------------------------------------------------

test('expire-partner-grants: a busy database waits, so the downgrade, its audit row and the key revocation all happen once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'partner-grants');
  const id = member(f, 'partner@example.com', {
    tier: 'pro',
    partner_tier: 'creator',
    partner_pro_grant_expires_at: at(-10 * DAY),
  });
  const opts: RunOptions = {
    env: {
      ZEROGEX_API_BASE_URL: 'https://keys.zerogex.test',
      ZEROGEX_API_TOKEN: 'test-bearer',
      ZEROGEX_ADMIN_TOKEN: 'test-admin',
    },
    routes: { 'POST keys.zerogex.test/api/admin/api-keys/revoke-all': { revoked: 1 } },
  };

  const first = await runWhileLocked(f, 'expire-partner-grants.mjs', ['--yes'], opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Downgraded 1 partner\(s\) to tier='public'\.$/m);
  assert.equal(column(f, id, 'tier'), 'public', 'downgraded');
  // The audit row is what --backfill-revocations finds a downgraded partner
  // by, so it must never be missing for a downgrade that happened.
  assert.equal(auditCount(f, 'partner_grant_expired', id), 1, 'one audit row, written with the downgrade');

  const second = run(f, 'expire-partner-grants.mjs', ['--yes'], opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Candidates: 0$/m);
  assert.deepEqual(
    httpCalls(f).map((c) => [c.method, new URL(c.url).pathname, c.body]),
    [['POST', '/api/admin/api-keys/revoke-all', JSON.stringify({ user_id: 'partner@example.com' })]],
    'keys revoked once',
  );
});

test('apply-founding-lifetime: a busy database waits, so the coupon is applied and stamped once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'founding-lifetime');
  const id = member(f, 'founder@example.com', {
    tier: 'basic',
    subscription_status: 'active',
    stripe_subscription_id: 'sub_founder',
    founding_member_started_at: at(-365 * DAY),
  });
  const subscription = { id: 'sub_founder', object: 'subscription', status: 'active' };
  const opts: RunOptions = {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_COUPON_FOUNDING_LIFETIME: 'coupon_lifetime' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_founder': subscription,
      'POST api.stripe.com/v1/subscriptions/sub_founder': subscription,
    },
  };

  const first = await runWhileLocked(f, 'apply-founding-lifetime.mts', ['--yes'], opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. Applied 1, skipped 0 \(inactive sub\), failed 0, of 1 due\.$/m);
  assert.ok(column(f, id, 'founding_lifetime_applied_at'), 'stamped');
  assert.equal(auditCount(f, 'billing_founding_lifetime_applied_batch', id), 1, 'one audit row, written with the stamp');

  const second = run(f, 'apply-founding-lifetime.mts', ['--yes'], opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Candidates: +0 founder/m);
  const updates = httpCalls(f).filter((c) => c.method === 'POST');
  assert.deepEqual(
    updates.map((c) => decodeURIComponent(c.body ?? '')),
    ['discounts[0][coupon]=coupon_lifetime'],
    'the coupon is applied once',
  );
});

test('scan-orphan-payments --alert: a busy database waits, so the operator is alerted once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'orphan-payments');
  member(f, 'stranded@example.com', { stripe_customer_id: 'cus_stranded' });
  // Paid yesterday and kept, with nothing to show for it locally. No
  // subscription behind it, so it is reported for a human to look at.
  const paidAt = Math.floor((NOW_MS - DAY) / 1000);
  const opts: RunOptions = {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly' },
    routes: {
      'GET api.stripe.com/v1/invoices': {
        object: 'list',
        url: '/v1/invoices',
        has_more: false,
        data: [
          {
            id: 'in_stranded',
            object: 'invoice',
            customer: 'cus_stranded',
            status: 'paid',
            amount_paid: 4900,
            currency: 'usd',
            billing_reason: 'manual',
            created: paidAt,
            status_transitions: { paid_at: paidAt },
          },
        ],
      },
    },
  };
  const args = ['--alert', '--to', 'ops@zerogex.test'];

  const first = await runWhileLocked(f, 'scan-orphan-payments.mts', args, opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Alerting: sent 1 finding\(s\) to ops@zerogex\.test\.$/m);
  const latch = f.db
    .prepare("SELECT COUNT(*) AS n FROM audit_events WHERE type = 'orphan_payment_alert_sent' AND message = ?")
    .get('Orphan-payment alert sent for invoice in_stranded') as { n: number };
  assert.equal(latch.n, 1, 'the invoice is latched');

  const second = run(f, 'scan-orphan-payments.mts', args, opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Alerting: all 1 finding\(s\) were alerted previously — nothing new\.$/m);
  assert.deepEqual(sentTo(f), ['ops@zerogex.test']);
});

// ---------------------------------------------------------------------------
// The manual admin scripts. Run by hand, so a lock error shows on screen
// rather than in an alert, but one that lands after an email or a Stripe
// credit leaves the member half-recorded all the same. These are the ones
// whose write path changed, plus a runtime check of each other kind of fix:
// the plain-JS (.mjs) helpers, which tsc does not check, and node:sqlite.
// ---------------------------------------------------------------------------

test('send-cancel-reason-followup: a busy database waits, so the member is followed up once and their win-back armed', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'cancel-reason');
  // Asked to cancel three days ago as too expensive; access has since ended.
  const id = member(f, 'too-pricey@example.com', { subscription_lapsed: 1 });
  audit(f, id, 'stripe_cancellation_requested', at(-3 * DAY), 'Cancellation requested for sub_old cancel_feedback=too_expensive');

  const first = await runWhileLocked(f, 'send-cancel-reason-followup.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.ok(column(f, id, 'winback_email_sent_at'), 'the win-back the email offered is armed');
  assert.equal(auditCount(f, 'cancel_reason_followup_sent', id), 1, 'marked as sent, with the win-back');

  const second = run(f, 'send-cancel-reason-followup.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible: +0$/m);
  assert.deepEqual(sentTo(f), ['too-pricey@example.com']);
});

test('send-welcome-email: a busy database waits, so the welcome is stamped and the webhook will not send it again', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'welcome');
  const id = member(f, 'new-member@example.com', { tier: 'basic', subscription_lapsed: 1 });
  const args = ['--email', 'new-member@example.com', '--variant', 'paid'];

  const first = await runWhileLocked(f, 'send-welcome-email.mts', args);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.ok(column(f, id, 'paid_welcome_email_sent_at'), 'stamped');
  assert.equal(column(f, id, 'subscription_lapsed'), 0);
  assert.equal(auditCount(f, 'paid_welcome_email_sent', id), 1, 'one audit row, written with the stamp');

  // The stamp is what makes a second run (and the webhook) hold off.
  const second = run(f, 'send-welcome-email.mts', args);
  assert.equal(second.status, 3, second.stderr + second.stdout);
  assert.deepEqual(sentTo(f), ['new-member@example.com']);
});

test('back-credit-trial: a busy database waits, so each member is credited, and recorded as credited, once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'back-credit');
  const id = member(f, 'monthly@example.com', {
    tier: 'basic',
    subscription_status: 'active',
    stripe_customer_id: 'cus_monthly',
    stripe_subscription_id: 'sub_monthly',
  });
  const opts: RunOptions = {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db' },
    routes: {
      'GET api.stripe.com/v1/subscriptions/sub_monthly': {
        id: 'sub_monthly',
        object: 'subscription',
        items: { object: 'list', data: [{ id: 'si_1', object: 'subscription_item', price: { id: 'price_m', object: 'price', recurring: { interval: 'month' } } }] },
      },
      'GET api.stripe.com/v1/invoices': {
        object: 'list',
        url: '/v1/invoices',
        has_more: false,
        data: [{ id: 'in_paid', object: 'invoice', amount_paid: 3100, currency: 'usd' }],
      },
      'POST api.stripe.com/v1/customers/cus_monthly/balance_transactions': { id: 'cbtxn_1', object: 'customer_balance_transaction', amount: -700, currency: 'usd' },
    },
  };

  const first = await runWhileLocked(f, 'back-credit-trial.mts', ['--yes'], opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 credited, 0 failed\.$/m);
  // The audit row is the only thing that stops a re-run crediting them again.
  assert.equal(auditCount(f, 'billing_trial_back_credit', id), 1, 'recorded as credited');

  const second = run(f, 'back-credit-trial.mts', ['--yes'], opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Already credited: +1$/m);
  assert.equal(httpCalls(f).filter((c) => c.method === 'POST').length, 1, 'credited once');
  assert.deepEqual(sentTo(f), ['monthly@example.com']);
});

test('credit-founders-july1-delay: a busy database waits, so each founder is credited, and recorded as credited, once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'founders-credit');
  const id = member(f, 'founder@example.com', {
    tier: 'basic',
    stripe_customer_id: 'cus_founder',
    stripe_price_id: 'price_basic_monthly',
    founding_member_started_at: at(-150 * DAY),
  });
  const opts: RunOptions = {
    env: { STRIPE_SECRET_KEY: 'sk_test_busy_db', STRIPE_PRICE_BASIC_MONTHLY: 'price_basic_monthly' },
    routes: {
      'POST api.stripe.com/v1/customers/cus_founder/balance_transactions': { id: 'cbtxn_2', object: 'customer_balance_transaction', amount: -1200, currency: 'usd' },
    },
  };

  const first = await runWhileLocked(f, 'credit-founders-july1-delay.mts', ['--yes'], opts);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 credited, 0 failed\.$/m);
  assert.equal(auditCount(f, 'billing_founding_july1_credit', id), 1, 'recorded as credited');

  const second = run(f, 'credit-founders-july1-delay.mts', ['--yes'], opts);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Already credited: 1$/m);
  assert.equal(httpCalls(f).filter((c) => c.method === 'POST').length, 1, 'credited once');
  assert.deepEqual(sentTo(f), ['founder@example.com']);
});

test('delete-user (.mjs): a busy database waits, so the account and everything on it go together', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'delete-user');
  const id = member(f, 'leaving@example.com');
  audit(f, id, 'login_success', at(-DAY), 'Login');

  const result = await runWhileLocked(f, 'delete-user.mjs', ['--email', 'leaving@example.com', '--yes']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Deleted leaving@example\.com /m);
  const left = f.db
    .prepare('SELECT (SELECT COUNT(*) FROM users WHERE id = ?) + (SELECT COUNT(*) FROM audit_events WHERE user_id = ?) AS n')
    .get(id, id) as { n: number };
  assert.equal(left.n, 0, 'nothing left behind');
});

test('update-user-tier (.mjs): a busy database waits, so the comp lands', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'update-tier');
  const id = member(f, 'comped@example.com');

  const result = await runWhileLocked(f, 'update-user-tier.mjs', ['--email', 'comped@example.com', '--tier', 'pro', '--founding-eligible']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(column(f, id, 'tier'), 'pro');
  assert.equal(column(f, id, 'founding_eligible'), 1);
});

test('seed-founders (.mjs): a busy database waits, so every earlier signup is flagged', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'seed-founders');
  const id = member(f, 'early@example.com');

  const result = await runWhileLocked(f, 'seed-founders.mjs', ['--yes']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^Flagged 1 user\(s\) as founding_eligible=1\.$/m);
  assert.equal(column(f, id, 'founding_eligible'), 1);
});

test('reset-user-for-testing (node:sqlite): a busy database waits, so the reset and its audit row land', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'reset-user');
  const id = member(f, 'tester@example.com', {
    tier: 'pro',
    subscription_status: 'active',
    stripe_subscription_id: 'sub_tester',
  });

  const result = await runWhileLocked(f, 'reset-user-for-testing.mjs', ['--email', 'tester@example.com', '--apply']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.equal(column(f, id, 'tier'), 'public');
  assert.equal(column(f, id, 'stripe_subscription_id'), null);
  assert.equal(auditCount(f, 'billing_test_reset', id), 1);
});
