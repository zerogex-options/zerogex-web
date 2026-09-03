import test from 'node:test';
import assert from 'node:assert/strict';

// The trial welcome must name the length of the trial the member ACTUALLY got,
// not the standard 7 days. A cold signup returning through the reactivation
// email's ?reactivate=1 link checks out with REACTIVATION_TRIAL_DAYS (default
// 30), so hard-coded "7-day" copy told that member their card would be charged
// three weeks before the date printed in the very next sentence of the same
// paragraph — the sort of contradiction that becomes a dispute.
//
// Renders the real email: fake Resend credentials plus a stubbed global fetch
// (the Resend SDK's transport) capture the exact payload that would have been
// sent, so this asserts the shipped body rather than a helper in isolation.

const APP_URL = 'https://zerogex.test';

process.env.NEXT_PUBLIC_APP_URL = APP_URL;
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'ZeroGEX <hello@zerogex.test>';

const { describeTrialLength, sendPaidWelcomeEmail } = await import('../core/mailer.ts');

type SentEmail = { subject: string; text: string; html: string };

const realFetch = globalThis.fetch;

// Capture the outbound Resend request instead of performing it, and hand back a
// minimal success payload so the mailer's error branch stays quiet.
async function capture(send: () => Promise<void>): Promise<SentEmail> {
  let captured: SentEmail | null = null;
  globalThis.fetch = (async (_input: unknown, init?: { body?: unknown }) => {
    captured = JSON.parse(String(init?.body ?? '{}')) as SentEmail;
    return new Response(JSON.stringify({ id: 'email_test' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  try {
    await send();
  } finally {
    globalThis.fetch = realFetch;
  }
  assert.ok(captured, 'expected the mailer to issue a send request');
  return captured;
}

// A trial-end date in the future keeps the paid welcome on its trial copy.
const trialEndIso = '2099-01-15T16:00:00.000Z';

function bodies(sent: SentEmail): ReadonlyArray<readonly [string, string]> {
  return [
    ['text', sent.text],
    ['html', sent.html],
  ] as const;
}

test('the standard trial still reads "7-day free trial"', async () => {
  const sent = await capture(() =>
    sendPaidWelcomeEmail('member@example.com', { trialEndIso, trialDays: 7 }),
  );
  for (const [format, body] of bodies(sent)) {
    assert.match(body, /Your 7-day free trial is now active/, `${format}: names the 7-day length`);
  }
});

test('an extended reactivation trial names its own length, never 7 days', async () => {
  const sent = await capture(() =>
    sendPaidWelcomeEmail('returning@example.com', { trialEndIso, trialDays: 30 }),
  );
  for (const [format, body] of bodies(sent)) {
    assert.match(body, /Your 30-day free trial is now active/, `${format}: names the real length`);
    assert.doesNotMatch(body, /7-day/, `${format}: never promises the standard 7 days`);
  }
});

test('a whole-day count survives a trial window that is seconds off', async () => {
  // Stripe reports the window in seconds, and a hand-restored trial_end can sit
  // a few seconds shy of a round day. Rounding keeps that from rendering as
  // "29-day" (or "29.999-day") on what the member was promised as 30.
  const sent = await capture(() =>
    sendPaidWelcomeEmail('member@example.com', { trialEndIso, trialDays: 29.9997 }),
  );
  for (const [format, body] of bodies(sent)) {
    assert.match(body, /Your 30-day free trial is now active/, `${format}: rounds to whole days`);
  }
});

test('an unknown trial length drops the number rather than guessing', async () => {
  // The trial-end date and the cancel path still have to land — losing the day
  // count must not cost the member the information that actually stops a
  // surprise charge.
  for (const trialDays of [undefined, null, 0, -3, 400, Number.NaN]) {
    const sent = await capture(() =>
      sendPaidWelcomeEmail('member@example.com', { trialEndIso, trialDays }),
    );
    const label = `trialDays=${String(trialDays)}`;
    for (const [format, body] of bodies(sent)) {
      const where = `${label} (${format})`;
      assert.match(body, /Your free trial is now active/, `${where}: still opens on the trial`);
      assert.doesNotMatch(body, /\d+-day free trial/, `${where}: names no day count`);
      assert.match(body, /January 15, 2099/, `${where}: keeps the trial-end date`);
      assert.match(body, /cancel before then/, `${where}: keeps the cancel path`);
    }
  }
});

test('the immediate-paid copy carries no trial line at all', async () => {
  const sent = await capture(() => sendPaidWelcomeEmail('member@example.com'));
  assert.equal(sent.subject, 'Thank you for subscribing to ZeroGEX!');
  for (const [format, body] of bodies(sent)) {
    assert.doesNotMatch(body, /free trial is now active/, `${format}: no trial line`);
  }
});

test('describeTrialLength only names a plausible day count', () => {
  assert.equal(describeTrialLength(7), '7-day free trial');
  assert.equal(describeTrialLength(30), '30-day free trial');
  assert.equal(describeTrialLength(1), '1-day free trial');
  assert.equal(describeTrialLength(365), '365-day free trial');
  for (const bad of [undefined, null, 0, 0.4, -1, 366, Number.NaN, Number.POSITIVE_INFINITY]) {
    assert.equal(describeTrialLength(bad), 'free trial', `rejects ${String(bad)}`);
  }
});
