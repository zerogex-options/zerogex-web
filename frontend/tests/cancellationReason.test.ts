import test from 'node:test';
import assert from 'node:assert/strict';
import {
  cancellationFeedbackLabel,
  sanitizeCancellationComment,
  formatCancellationReasonSuffix,
  parseCancellationReasonFromMessage,
  hasCancellationSignal,
  validateCancelFeedback,
  CANCELLATION_FEEDBACK_VALUES,
  NO_FEEDBACK,
} from '../core/cancellationReason.ts';

// The format ⇄ parse round-trip is the load-bearing contract: the webhook writes
// the suffix onto an audit message, and both the churn-breakdown script and the
// admin dashboard read it back. Lock down that whatever goes in comes back out,
// and that a clean cancel keeps a clean message.

test('feedback labels: known enum, sentinel, unknown token', () => {
  assert.equal(cancellationFeedbackLabel('too_expensive'), 'Too expensive');
  assert.equal(cancellationFeedbackLabel('switched_service'), 'Switched service');
  assert.equal(cancellationFeedbackLabel(null), 'No reason given');
  assert.equal(cancellationFeedbackLabel(NO_FEEDBACK), 'No reason given');
  // Forward-compatible: an enum value Stripe adds later still renders.
  assert.equal(cancellationFeedbackLabel('too_new_to_map'), 'Too New To Map');
});

test('validateCancelFeedback: strict membership in the Stripe enum, else null', () => {
  // Every known enum value validates to itself.
  for (const v of CANCELLATION_FEEDBACK_VALUES) {
    assert.equal(validateCancelFeedback(v), v);
  }
  // The in-app picker sends exactly these — a spot check of the real ones.
  assert.equal(validateCancelFeedback('too_expensive'), 'too_expensive');
  assert.equal(validateCancelFeedback('missing_features'), 'missing_features');
  // Anything outside the enum (unlike the lenient parser) is dropped, so we never
  // forward an invalid value to Stripe and 400 the cancellation update.
  assert.equal(validateCancelFeedback('made_up_reason'), null);
  assert.equal(validateCancelFeedback(NO_FEEDBACK), null);
  assert.equal(validateCancelFeedback(''), null);
  assert.equal(validateCancelFeedback(null), null);
  assert.equal(validateCancelFeedback(undefined), null);
  assert.equal(validateCancelFeedback(42), null);
  assert.equal(validateCancelFeedback({ feedback: 'too_expensive' }), null);
});

test('comment sanitizer: single-lines, quote-safe, bounded, null-on-empty', () => {
  assert.equal(sanitizeCancellationComment(null), null);
  assert.equal(sanitizeCancellationComment('   '), null);
  assert.equal(
    sanitizeCancellationComment('line one\nline two\ttabbed'),
    'line one line two tabbed',
  );
  // Quotes and backslashes can't survive, or they'd break the "..." wrapper.
  const dirty = sanitizeCancellationComment('he said "too \\ pricey"');
  assert.ok(dirty !== null);
  assert.ok(!dirty.includes('"'));
  assert.ok(!dirty.includes('\\'));
  // Capped length.
  const long = 'x'.repeat(500);
  assert.equal(sanitizeCancellationComment(long)?.length, 200);
});

test('suffix is empty when there is nothing to record', () => {
  assert.equal(formatCancellationReasonSuffix(null), '');
  assert.equal(formatCancellationReasonSuffix(undefined), '');
  assert.equal(formatCancellationReasonSuffix({ feedback: null, comment: null }), '');
  assert.equal(formatCancellationReasonSuffix({ reason: 'cancellation_requested' }), '');
  // A whitespace-only comment and a malformed feedback contribute nothing.
  assert.equal(formatCancellationReasonSuffix({ feedback: 'Not-An-Enum!', comment: '   ' }), '');
});

test('round-trip: feedback only, comment only, both', () => {
  const cases: Array<{ feedback: string | null; comment: string | null }> = [
    { feedback: 'too_expensive', comment: null },
    { feedback: null, comment: "can't justify the cost right now" },
    { feedback: 'missing_features', comment: 'needed 0DTE alerts on NDX' },
  ];
  for (const input of cases) {
    const base = 'Cancellation requested for sub sub_ABC123';
    const message = base + formatCancellationReasonSuffix(input);
    const parsed = parseCancellationReasonFromMessage(message);
    assert.equal(parsed.feedback, input.feedback);
    assert.equal(parsed.comment, input.comment);
    assert.equal(hasCancellationSignal(parsed), true);
    // The sub id must still be extractable after the suffix is appended.
    assert.match(message, /sub_ABC123/);
  }
});

test('round-trip: a customer comment full of quotes stays parseable', () => {
  const message =
    'Subscription sub_XYZ ended; tier reset to public' +
    formatCancellationReasonSuffix({ feedback: 'other', comment: 'said "meh" then \\left\\' });
  const parsed = parseCancellationReasonFromMessage(message);
  assert.equal(parsed.feedback, 'other');
  assert.ok(parsed.comment && parsed.comment.length > 0);
  assert.match(message, /sub_XYZ/); // sub-id parsing (subscriptionFlow) unaffected
});

test('parsing a message with no reason tokens yields nulls / no signal', () => {
  const parsed = parseCancellationReasonFromMessage('Cancellation requested for sub sub_1');
  assert.equal(parsed.feedback, null);
  assert.equal(parsed.comment, null);
  assert.equal(hasCancellationSignal(parsed), false);
});
