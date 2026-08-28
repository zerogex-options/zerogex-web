import test from 'node:test';
import assert from 'node:assert/strict';

// Both Pro welcome emails must tell a new subscriber how to generate their own
// API key. The in-app Pro welcome modal says it once and is dismissed for good,
// so the email is the durable copy — if this drops out of the body, a member who
// closed the modal has no self-serve path left and support gets the ticket.
//
// Renders the real emails: fake Resend credentials plus a stubbed global fetch
// (the Resend SDK's transport) capture the exact payload that would have been
// sent, so this asserts the shipped body rather than a helper in isolation.

const APP_URL = 'https://zerogex.test';

process.env.NEXT_PUBLIC_APP_URL = APP_URL;
process.env.RESEND_API_KEY = 're_test_key';
process.env.RESEND_FROM_EMAIL = 'ZeroGEX <hello@zerogex.test>';

const { sendPaidWelcomeEmail, sendFoundingWelcomeEmail, sendWelcomeBackEmail } = await import(
  '../core/mailer.ts'
);

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

// A trial-end date in the future keeps the paid welcome on its trial copy — the
// branch a brand-new Pro subscriber actually receives out of checkout.
const trialEndIso = '2099-01-15T16:00:00.000Z';

// The two first-subscribe emails frame keys as a Pro benefit the member may not
// know they have. (The welcome-back email frames the same steps as a repair —
// see its own test.)
function assertNewSubscriberFraming({ text, html }: SentEmail, label: string) {
  for (const [format, body] of [
    ['text', text],
    ['html', html],
  ] as const) {
    assert.match(body, /self-service API keys/, `${label} (${format}): names the benefit`);
  }
}

// The mechanics every variant must carry, whatever the framing around them.
function assertApiKeyGuidance({ text, html }: SentEmail, label: string) {
  for (const [format, body] of [
    ['text', text],
    ['html', html],
  ] as const) {
    const where = `${label} (${format})`;
    assert.match(body, /API Access/, `${where}: names the account section to open`);
    assert.match(body, /Generate API Key/, `${where}: names the button to click`);
    assert.match(body, /shown only once/, `${where}: warns the secret is one-time`);
    assert.match(body, /Authorization: Bearer/, `${where}: shows how to send the key`);
    assert.ok(
      body.includes(`${APP_URL}/account#api-access`),
      `${where}: deep-links the API Access section`,
    );
  }
}

test('paid/trial Pro welcome email explains self-service API key generation', async () => {
  const sent = await capture(() =>
    sendPaidWelcomeEmail('member@example.com', { trialEndIso }),
  );
  assert.equal(sent.subject, 'Your ZeroGEX trial is active');
  assertApiKeyGuidance(sent, 'paid welcome (trial copy)');
  assertNewSubscriberFraming(sent, 'paid welcome (trial copy)');
});

test('immediate-paid Pro welcome email explains self-service API key generation', async () => {
  const sent = await capture(() => sendPaidWelcomeEmail('member@example.com'));
  assert.equal(sent.subject, 'Thank you for subscribing to ZeroGEX!');
  assertApiKeyGuidance(sent, 'paid welcome (no-trial copy)');
  assertNewSubscriberFraming(sent, 'paid welcome (no-trial copy)');
});

test('founding welcome email explains self-service API key generation', async () => {
  const sent = await capture(() =>
    sendFoundingWelcomeEmail('founder@example.com', { trialEndIso }),
  );
  assertApiKeyGuidance(sent, 'founding welcome');
  assertNewSubscriberFraming(sent, 'founding welcome');
});

test('welcome-back email tells a returning member their old key was revoked', async () => {
  const sent = await capture(() => sendWelcomeBackEmail('returning@example.com'));
  assert.equal(sent.subject, 'Welcome back to ZeroGEX!');
  assertApiKeyGuidance(sent, 'welcome back');
  // Dropping below Pro revokes every key the account held, so a resubscriber's
  // old integrations are authenticating with a dead key. The generic "if you
  // ever need one" framing would read as optional to someone already broken.
  for (const body of [sent.text, sent.html]) {
    assert.match(body, /old key was revoked/);
    assert.doesNotMatch(body, /If you ever need one/);
  }
});

test('the API-key steps are an ordered list in the HTML body, not a bare link', async () => {
  const sent = await capture(() => sendPaidWelcomeEmail('member@example.com', { trialEndIso }));
  assert.match(sent.html, /<ol[^>]*>[\s\S]*Generate API Key[\s\S]*<\/ol>/);
  // The dashboard stays the primary call to action; the key guidance follows it.
  assert.ok(
    sent.html.indexOf('Open the live dashboard') < sent.html.indexOf('API Access'),
    'the dashboard CTA should still come before the API-key guidance',
  );
});
