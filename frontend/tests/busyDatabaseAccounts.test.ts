import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DAY,
  at,
  auditCount,
  blockWrites,
  column,
  createBusyDb,
  printedCommand,
  runPrinted,
  sentTo,
  sqlite3Missing,
  unblockWrites,
} from './support/busyDb.ts';

// Manual scripts that record a member without changing anything in Stripe,
// run against a busy database and against a record step that still fails.
// What each must do then: an email that went out is named, with the command
// that records it; a change that only touches this database lands whole or
// not at all. See tests/support/busyDb.ts for the harness.

const { fixture, member, run, runWhileLocked } = await createBusyDb('busy-db-accounts');

function trialer(f: Parameters<typeof member>[0], email: string): string {
  return member(f, email, {
    subscription_status: 'trialing',
    stripe_subscription_id: 'sub_trial',
    current_period_end: at(4 * DAY),
  });
}

test('send-trial-quickstart: a busy database waits, so the trialer gets the guide once', { skip: sqlite3Missing }, async (t) => {
  const f = fixture(t, 'quickstart');
  const id = trialer(f, 'mid-trial@example.com');

  const first = await runWhileLocked(f, 'send-trial-quickstart.mts', ['--yes']);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.match(first.stdout, /^Done\. 1 sent, 0 failed\.$/m);
  assert.equal(auditCount(f, 'trial_quickstart_email_sent', id), 1, 'recorded as sent');

  const second = run(f, 'send-trial-quickstart.mts', ['--yes']);
  assert.equal(second.status, 0, second.stderr + second.stdout);
  assert.match(second.stdout, /^Eligible users: +0 /m);
  assert.deepEqual(sentTo(f), ['mid-trial@example.com']);
});

test('send-trial-quickstart: an email that went out but could not be recorded is named, with the command that records it', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'quickstart-unrecorded');
  const id = trialer(f, 'mid-trial@example.com');
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'trial_quickstart_email_sent'");

  const result = run(f, 'send-trial-quickstart.mts', ['--yes']);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /DELIVERED but not recorded as sent, so a re-run would email them again/);
  assert.deepEqual(sentTo(f), ['mid-trial@example.com']);
  assert.equal(auditCount(f, 'trial_quickstart_email_sent', id), 0);

  const command = printedCommand(result.stderr);
  assert.ok(command, result.stderr);
  assert.notEqual(runPrinted(command).status, 0, 'run while the insert still fails, it fails');
  assert.equal(auditCount(f, 'trial_quickstart_email_sent', id), 0, 'and writes nothing');

  unblockWrites(f);
  const ran = runPrinted(command);
  assert.equal(ran.status, 0, ran.stderr);
  assert.equal(auditCount(f, 'trial_quickstart_email_sent', id), 1, 'the printed command records the send');
});

test('reset-user-for-testing: a reset whose audit row cannot be written changes nothing', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'reset-unrecorded');
  const id = member(f, 'tester@example.com', {
    tier: 'pro',
    subscription_status: 'active',
    stripe_subscription_id: 'sub_tester',
  });
  blockWrites(f, 'INSERT', 'audit_events', "NEW.type = 'billing_test_reset'");

  const result = run(f, 'reset-user-for-testing.mjs', ['--email', 'tester@example.com', '--apply']);
  assert.equal(result.status, 1, result.stderr + result.stdout);
  assert.match(result.stderr, /Nothing was changed: .*Re-run the same command\./);
  assert.equal(column(f, id, 'tier'), 'pro', 'the reset rolled back with its audit row');
  assert.equal(column(f, id, 'stripe_subscription_id'), 'sub_tester');
});
