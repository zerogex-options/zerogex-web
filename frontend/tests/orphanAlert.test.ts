import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildOrphanAlert,
  groupByBucket,
  orphanLatchMessage,
  ORPHAN_LATCH_AUDIT_TYPE,
  type OrphanFinding,
} from '../core/orphanAlert.ts';
import { buildOrphanPaymentAlertEmail } from '../core/mailer.ts';

// The alert that stops a paying member being silently left on a free tier. It
// runs daily against a standing problem, so the failure mode it must not have
// is crying wolf — and the one it must not have either is going quiet.

function finding(overrides: Partial<OrphanFinding> = {}): OrphanFinding {
  return {
    bucket: 'recoverable',
    email: 'member@example.com',
    invoiceId: 'in_1',
    amount: '$49.00',
    paidAt: '2026-09-01',
    coveredThrough: '2026-10-01',
    detail: null,
    command: 'make recover-orphan-payment EMAIL=member@example.com',
    ...overrides,
  };
}

test('nothing found means no email at all', () => {
  // A daily timer that sends a cheerful "no orphans today" is a daily timer
  // people filter, and then they filter the one that matters too.
  assert.equal(buildOrphanAlert([]), null);
});

test('one email covers every finding, not one per member', () => {
  const alert = buildOrphanAlert([
    finding({ invoiceId: 'in_1', email: 'a@example.com' }),
    finding({ invoiceId: 'in_2', email: 'b@example.com' }),
  ]);
  assert.ok(alert);
  assert.equal(alert.findings.length, 2);
  assert.match(alert.subject, /2 members/);
  assert.deepEqual(alert.invoiceIds, ['in_1', 'in_2']);
});

test('a single member is named in the subject', () => {
  const alert = buildOrphanAlert([finding({ email: 'solo@example.com' })]);
  assert.match(alert!.subject, /solo@example\.com/);
});

test('the buckets are ordered by what the reader can act on', () => {
  // Known fix first, judgement calls last — somebody reading top to bottom
  // should hit the copy-pasteable ones before the ones needing a decision.
  const alert = buildOrphanAlert([
    finding({ invoiceId: 'in_r', bucket: 'needs_review' }),
    finding({ invoiceId: 'in_l', bucket: 'lost_paid_time' }),
    finding({ invoiceId: 'in_h', bucket: 'recoverable' }),
  ]);
  assert.deepEqual(
    alert!.findings.map((f) => f.bucket),
    ['recoverable', 'lost_paid_time', 'needs_review'],
  );
  assert.deepEqual(groupByBucket(alert!.findings).map((g) => g.bucket), [
    'recoverable',
    'lost_paid_time',
    'needs_review',
  ]);
  // Empty buckets are dropped rather than rendered as empty headings.
  assert.equal(groupByBucket([finding()]).length, 1);
});

test('every command in the email is a dry run', () => {
  // The alert must never carry something that changes a tier if pasted without
  // reading. YES=1 is the deliberate second step and it is not in here.
  const alert = buildOrphanAlert([
    finding({ bucket: 'recoverable' }),
    finding({ invoiceId: 'in_2', bucket: 'lost_paid_time', detail: 'roughly 12 paid day(s) lost' }),
  ]);
  const mail = buildOrphanPaymentAlertEmail(alert!);
  assert.doesNotMatch(mail.text, /YES=1 *$/m);
  assert.match(mail.text, /dry run/i);
  assert.match(mail.text, /make recover-orphan-payment/);
  // And it must not imply the elapsed-period decision has been made for them.
  assert.match(mail.text, /pricing decision/i);
});

test('the email carries the facts needed to act without opening anything', () => {
  const mail = buildOrphanPaymentAlertEmail(
    buildOrphanAlert([finding({ detail: 'roughly 12 paid day(s) lost' })])!,
  );
  for (const fact of ['member@example.com', 'in_1', '$49.00', '2026-09-01', '12 paid day(s)']) {
    assert.ok(mail.text.includes(fact), `missing ${fact}`);
    assert.ok(mail.html.includes(fact), `missing ${fact} in html`);
  }
});

test('the latch message round-trips the invoice id the script greps for', () => {
  // The script re-reads these rows and extracts the id with /invoice (\\S+)/.
  // If the wording drifts, the latch silently stops working and the alert
  // repeats every morning — so the two are pinned together here.
  const message = orphanLatchMessage('in_1TnNf54AOiqteMYY');
  assert.equal(message.match(/invoice (\S+)/)?.[1], 'in_1TnNf54AOiqteMYY');
  assert.equal(ORPHAN_LATCH_AUDIT_TYPE, 'orphan_payment_alert_sent');
});
