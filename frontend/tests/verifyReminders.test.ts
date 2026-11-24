import test from 'node:test';
import assert from 'node:assert/strict';

import { HOUR, at, column, createBusyDb, sentTo, sqlite3Missing } from './support/busyDb.ts';

// scripts/send-verify-reminders.mts, run for real against a copy of the auth
// schema with Resend replaced by the email-audit stub (tests/support/busyDb.ts).
// Its runs under a busy database are in tests/busyDatabase.test.ts.

const { fixture, member, run } = await createBusyDb('verify-reminders');

test('send-verify-reminders: an address no mail server takes is skipped, and the run still succeeds', { skip: sqlite3Missing }, (t) => {
  const f = fixture(t, 'undeliverable');
  // 2026-11-24: a signup with a dot right before the @. Resend refused it on
  // every run, and every refusal failed the unit and paged the operator.
  const bad = member(f, 'first.last.@gmail.com', { created_at: at(-4 * HOUR), email_verified_at: null });
  const good = member(f, 'first.last@example.com', { created_at: at(-4 * HOUR), email_verified_at: null });

  const result = run(f, 'send-verify-reminders.mts', ['--yes']);
  assert.equal(result.status, 0, result.stderr + result.stdout);
  assert.match(result.stdout, /^ {2}SKIP first\.last\.@gmail\.com: not a deliverable address$/m);
  assert.match(result.stdout, /^Done\. 1 sent, 0 failed, 1 skipped \(undeliverable\)\.$/m);
  assert.deepEqual(sentTo(f), ['first.last@example.com']);

  assert.equal(column(f, bad, 'verify_reminder_email_sent_at'), null, 'the skipped signup is not marked as sent');
  const tokens = f.db.prepare('SELECT COUNT(*) AS n FROM email_verifications WHERE user_id = ?').get(bad) as {
    n: number;
  };
  assert.equal(tokens.n, 0, 'no verification link is minted for it');
  assert.ok(column(f, good, 'verify_reminder_email_sent_at'), 'the real address is reminded and marked');
});
