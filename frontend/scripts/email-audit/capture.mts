// Renders every mailer.ts email by stubbing the Resend transport (the SDK's
// global fetch) and capturing the exact {subject, html, text, headers} payload
// that would have gone on the wire. Same technique as
// tests/welcomeEmailApiKey.test.ts, so this is shipped copy, not a re-creation.

import { writeFileSync } from 'node:fs';

const APP_URL = 'https://zerogex.io';
process.env.NEXT_PUBLIC_APP_URL = APP_URL;
process.env.RESEND_API_KEY = 're_audit_key';
process.env.RESEND_FROM_EMAIL = 'ZeroGEX <hello@zerogex.io>';

const M = await import('../../core/mailer.ts');

type Sent = {
  subject: string;
  html: string;
  text: string;
  headers?: Record<string, string>;
  from?: string;
};

const realFetch = globalThis.fetch;

async function capture(fn: () => Promise<unknown>): Promise<Sent> {
  let got: Sent | null = null;
  globalThis.fetch = (async (_i: unknown, init?: { body?: unknown }) => {
    got = JSON.parse(String(init?.body ?? '{}')) as Sent;
    return new Response(JSON.stringify({ id: 'email_audit' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  }) as typeof globalThis.fetch;
  try {
    await fn();
  } finally {
    globalThis.fetch = realFetch;
  }
  if (!got) throw new Error('no send was issued');
  return got;
}

const TO = 'member@example.com';
const OPS = 'michael@zerogex.io';
// Fixed instants so the render is reproducible run to run.
const TRIAL_END = '2026-09-18T23:01:00.000Z';
const PERIOD_END = '2026-10-14T16:00:00.000Z';
const NEXT_ATTEMPT = '2026-09-19T14:00:00.000Z';
const GRACE_UNTIL = '2026-09-19T16:00:00.000Z';
const MONEY_BACK_UNTIL = '2026-09-25T16:00:00.000Z';
const UNSUB = `${APP_URL}/unsubscribe?u=user_123&t=abc123`;
const SAVE_URL = `${APP_URL}/save?u=user_123&t=abc123`;
const VERIFY_URL = `${APP_URL}/verify?token=abc123def456`;

// The win-back's discount label comes from WINBACK_DISCOUNT_LABEL in production
// (send-winback.mts), so read the same var rather than hardcoding a percentage.
// Rendering "25% off" while the box is configured for 50% would put a number in
// the audit that nobody actually receives. Same default as the script.
const WINBACK_LABEL = (process.env.WINBACK_DISCOUNT_LABEL || '').trim() || '25% off your first year';

const HIGHLIGHTS = [
  { title: 'Trade Bias', body: 'One signed directional call that fuses the gamma and volatility regime with live flow, tape and momentum.' },
  { title: 'Session rewind', body: 'Replay any session on the gamma chart and watch how a level actually held.' },
  { title: 'TradeWorkz bots', body: 'Automated strategies with a fully public trade audit — every entry and exit on the record.' },
];

// The operator digests embed the REAL member draft they are reviewing, so build
// those the same way the crons do rather than stubbing a placeholder body.
const { buildChurnAlert } = await import('../../core/cancellationAlert.ts');
const CHURN_ALERT = buildChurnAlert(
  {
    churnEventId: 'audit_cancel_1',
    kind: 'pending',
    email: TO,
    userId: 'user_123',
    auditMessage:
      'Subscription sub_1ABC set to cancel at period end; feedback=too_expensive; comment=Great product, just cannot justify it this quarter.',
    churnedAtIso: '2026-09-15T18:20:00.000Z',
    accountCreatedAtIso: '2026-05-12T14:02:00.000Z',
    tier: 'pro',
    currentPeriodEndIso: PERIOD_END,
  },
  '2026-09-15T18:25:00.000Z',
);
const WINBACK_DRAFT = M.renderWinbackEmail({ winbackAutoApply: true, discountLabel: WINBACK_LABEL, highlights: HIGHLIGHTS });
const REACTIVATION_DRAFT = M.renderReactivationEmail({ trialDays: 30, unsubUrl: UNSUB });
const RETURN_INTENT_DRAFT = M.renderReturnIntentEmail({ angle: 'price', highlights: HIGHLIGHTS, freshCount: 3, foundingMember: false, unsubUrl: UNSUB });

// Each entry: the catalogue id, and a thunk that produces one rendered variant.
const JOBS: Array<{ id: string; variant: string; run: () => Promise<Sent> }> = [
  // --- auth / transactional -------------------------------------------------
  { id: 'email-verification', variant: 'default', run: () => capture(() => M.sendEmailVerification(TO, VERIFY_URL)) },
  { id: 'password-reset', variant: 'default', run: () => capture(() => M.sendPasswordResetEmail(TO, `${APP_URL}/reset?token=abc123`)) },
  { id: 'verify-reminder', variant: 'default', run: () => capture(() => M.sendVerifyReminderEmail(TO, VERIFY_URL)) },

  // --- welcome --------------------------------------------------------------
  { id: 'paid-welcome', variant: 'trial (7-day)', run: () => capture(() => M.sendPaidWelcomeEmail(TO, { trialEndIso: TRIAL_END, trialDays: 7 })) },
  { id: 'paid-welcome', variant: 'immediate paid (no trial)', run: () => capture(() => M.sendPaidWelcomeEmail(TO, {})) },
  { id: 'paid-welcome', variant: 'paid up front (7-day money-back guarantee)', run: () => capture(() => M.sendPaidWelcomeEmail(TO, { moneyBackUntilIso: MONEY_BACK_UNTIL })) },
  { id: 'founding-welcome', variant: 'default', run: () => capture(() => M.sendFoundingWelcomeEmail(TO, { trialEndIso: TRIAL_END })) },
  { id: 'trial-quickstart', variant: 'default', run: () => capture(() => M.sendTrialQuickstartEmail(TO, { trialEndIso: TRIAL_END })) },
  { id: 'welcome-back', variant: 'default', run: () => capture(() => M.sendWelcomeBackEmail(TO)) },

  // --- trial lifecycle ------------------------------------------------------
  { id: 'trial-value-nudge', variant: 'default', run: () => capture(() => M.sendTrialValueEmail(TO, { trialEndIso: TRIAL_END, unsubUrl: UNSUB })) },
  { id: 'trial-reminder', variant: 'engaged', run: () => capture(() => M.sendTrialReminderEmail(TO, { trialEndIso: TRIAL_END, billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' } })) },
  { id: 'trial-reminder', variant: 'on a promo intro rate', run: () => capture(() => M.sendTrialReminderEmail(TO, { trialEndIso: TRIAL_END, billing: { chargeLabel: '$29.00/month', cardBrand: 'Visa', cardLast4: '4242' }, promoIntroLabel: 'first 12 months' })) },
  { id: 'trial-reminder', variant: 'dormant (never returned)', run: () => capture(() => M.sendTrialReminderEmail(TO, { trialEndIso: TRIAL_END, billing: { chargeLabel: '$59.00/month', cardBrand: 'Visa', cardLast4: '4242' }, dormant: true })) },
  { id: 'trial-converted', variant: 'charged', run: () => capture(() => M.sendTrialConvertedEmail(TO, { amountFormatted: '$59.00', cardBrand: 'Visa', cardLast4: '4242', nextChargeIso: PERIOD_END })) },
  { id: 'trial-converted', variant: 'fully credited ($0 invoice)', run: () => capture(() => M.sendTrialConvertedEmail(TO, { amountFormatted: '$0.00', cardBrand: 'Visa', cardLast4: '4242', nextChargeIso: PERIOD_END, fullyCredited: true })) },
  { id: 'trial-conversion-failed', variant: 'default', run: () => capture(() => M.sendTrialConversionFailedEmail(TO, { amountFormatted: '$59.00', cardBrand: 'Visa', cardLast4: '4242', nextAttemptIso: NEXT_ATTEMPT, graceUntilIso: GRACE_UNTIL })) },

  // --- billing / dunning ----------------------------------------------------
  { id: 'payment-failed', variant: 'grace window open', run: () => capture(() => M.sendPaymentFailedEmail(TO, { amountFormatted: '$59.00', cardBrand: 'Visa', cardLast4: '4242', nextAttemptIso: NEXT_ATTEMPT, graceUntilIso: GRACE_UNTIL })) },
  { id: 'grace-expiry-warning', variant: 'renewal failure', run: () => capture(() => M.sendGraceExpiryWarningEmail(TO, { reason: 'renewal', graceUntilIso: GRACE_UNTIL, cardBrand: 'Visa', cardLast4: '4242', nextAttemptIso: NEXT_ATTEMPT })) },
  { id: 'grace-expiry-warning', variant: 'trial-conversion failure', run: () => capture(() => M.sendGraceExpiryWarningEmail(TO, { reason: 'trial', graceUntilIso: GRACE_UNTIL, cardBrand: 'Visa', cardLast4: '4242', nextAttemptIso: null })) },
  { id: 'payment-recovered', variant: 'default', run: () => capture(() => M.sendPaymentRecoveredEmail(TO)) },
  { id: 'renewal-reminder', variant: 'annual (30 days out)', run: () => capture(() => M.sendRenewalReminderEmail(TO, { planLabel: 'Pro (annual)', renewalIso: PERIOD_END, amountFormatted: '$299.00' })) },
  { id: 'renewal-reminder', variant: 'amount unavailable', run: () => capture(() => M.sendRenewalReminderEmail(TO, { planLabel: 'Basic (quarterly)', renewalIso: PERIOD_END, amountFormatted: null })) },
  { id: 'card-expiring', variant: 'default', run: () => capture(() => M.sendCardExpiringEmail(TO, { cardBrand: 'Visa', cardLast4: '4242', expiryLabel: '10/2026' })) },
  { id: 'referral-reward', variant: 'credited', run: () => capture(() => M.sendReferralRewardEmail(TO, { kind: 'credited', amountFormatted: '$59.00', accountUrl: `${APP_URL}/account` })) },
  { id: 'referral-reward', variant: 'banked', run: () => capture(() => M.sendReferralRewardEmail(TO, { kind: 'banked', accountUrl: `${APP_URL}/account` })) },

  // --- conversion nudges ----------------------------------------------------
  { id: 'verified-never-paid', variant: 'default', run: () => capture(() => M.sendVerifiedNeverPaidEmail(TO)) },
  { id: 'checkout-recovery', variant: 'plain', run: () => capture(() => M.sendCheckoutRecoveryEmail(TO, { foundingDeadlineLabel: null })) },
  { id: 'checkout-recovery', variant: 'founding deadline live', run: () => capture(() => M.sendCheckoutRecoveryEmail(TO, { foundingDeadlineLabel: 'October 1, 2026' })) },
  { id: 'checkout-recovery', variant: 'promo deadline live', run: () => capture(() => M.sendCheckoutRecoveryEmail(TO, { foundingDeadlineLabel: null, promoDeadlineLabel: 'October 1, 2026', promoPricing: { basicMonthly: '$29.00', proMonthly: '$49.00' } })) },
  { id: 'founding-final-call', variant: 'default', run: () => capture(() => M.sendFoundingFinalCallEmail(TO, { deadlineLabel: 'October 1, 2026', foundingHref: `${APP_URL}/founding`, billingStartLabel: 'October 8, 2026', pricing: { basicMonthlyIntro: '$12.00', proMonthlyIntro: '$19.00', basicMonthlyList: '$29.00', proMonthlyList: '$59.00', lifetimePercentOff: 25 } })) },
  { id: 'reactivation', variant: 'default (30-day)', run: () => capture(() => M.sendReactivationEmail(TO, { trialDays: 30, unsubUrl: UNSUB })) },

  // --- retention / churn ----------------------------------------------------
  { id: 'cancellation-ack', variant: 'with save link', run: () => capture(() => M.sendCancellationEmail(TO, { periodEndIso: PERIOD_END, saveUrl: SAVE_URL })) },
  { id: 'cancellation-ack', variant: 'conversion charge pending', run: () => capture(() => M.sendCancellationEmail(TO, { periodEndIso: PERIOD_END, saveUrl: SAVE_URL, conversionChargePending: true })) },
  { id: 'money-back-refund', variant: 'default', run: () => capture(() => M.sendMoneyBackRefundEmail(TO, { amountFormatted: '$115.00', planLabel: 'Pro (quarterly)', cardBrand: 'visa', cardLast4: '4242' })) },
  { id: 'winback', variant: 'auto (win-back coupon configured)', run: () => capture(() => M.sendWinbackEmail(TO, { winbackAutoApply: true, discountLabel: WINBACK_LABEL, highlights: HIGHLIGHTS })) },
  { id: 'winback', variant: 'promo (public promo live)', run: () => capture(() => M.sendWinbackEmail(TO, { promoDeadlineLabel: 'October 1, 2026', highlights: HIGHLIGHTS })) },
  { id: 'winback', variant: 'none (no coupon configured)', run: () => capture(() => M.sendWinbackEmail(TO, { highlights: HIGHLIGHTS })) },
  { id: 'return-intent', variant: 'price objection, 3 new', run: () => capture(() => M.sendReturnIntentEmail(TO, { angle: 'price', highlights: HIGHLIGHTS, freshCount: 3, foundingMember: false, unsubUrl: UNSUB })) },
  { id: 'return-intent', variant: 'neutral, nothing new', run: () => capture(() => M.sendReturnIntentEmail(TO, { angle: 'neutral', highlights: [], freshCount: 0, foundingMember: false, unsubUrl: UNSUB })) },

  // --- partner / product ----------------------------------------------------
  { id: 'tradeworkz-alert', variant: 'exit (win)', run: () => capture(() => M.sendTradeworkzNotification(TO, { botId: 'bot_1', botDisplayName: 'Gamma Scalper', eventType: 'exit', payload: { underlying: 'SPY', direction: 'bullish', strategy_type: 'long call', outcome: 'win', realized_pnl: 1203.44, pnl_percent: 8.3, reason: 'target hit', contracts: 5, entry_price: 4.2, exit_price: 6.61 } })) },
  { id: 'tradeworkz-alert', variant: 'entry', run: () => capture(() => M.sendTradeworkzNotification(TO, { botId: 'bot_1', botDisplayName: 'Gamma Scalper', eventType: 'entry', payload: { underlying: 'SPY', direction: 'bearish', strategy_type: 'long put', contracts: 5, entry_price: 4.2, target_price: 6.5, stop_price: 3.1, conviction: 0.72, rationale: 'Spot is above the gamma flip with a thick call wall at 660; dealers sell into strength here.' } })) },

  // --- operator-only (no member receives these) -----------------------------
  { id: 'cancellation-alert', variant: 'clicked Cancel (still has access)', run: () => capture(() => M.sendCancellationAlertEmail(OPS, CHURN_ALERT)) },
  { id: 'money-back-alert', variant: 'refund issued', run: () => capture(() => M.sendMoneyBackOperatorAlertEmail(OPS, { kind: 'issued', email: TO, planLabel: 'Pro (quarterly)', amountFormatted: '$115.00', source: 'self_serve', reason: 'too_expensive', comment: 'More than I need right now.', problems: [], subscriptionId: 'sub_123', refundIds: ['re_123'] })) },
  { id: 'money-back-alert', variant: 'action needed', run: () => capture(() => M.sendMoneyBackOperatorAlertEmail(OPS, { kind: 'attention', email: TO, planLabel: 'Pro (annual)', amountFormatted: '$299.00', source: 'self_serve', reason: null, comment: null, problems: ['The refund went through but Stripe did not cancel sub_456. Cancel it in the Dashboard, or the member is billed again at renewal.'], subscriptionId: 'sub_456', refundIds: ['re_456'] })) },
  { id: 'winback-digest', variant: 'default', run: () => capture(() => M.sendWinbackDigestEmail(OPS, { recipients: [TO, 'another@example.com'], mode: 'auto', sendCommand: 'make winback YES=1', draft: WINBACK_DRAFT })) },
  { id: 'reactivation-digest', variant: 'default', run: () => capture(() => M.sendReactivationDigestEmail(OPS, { recipients: [TO, 'another@example.com'], sendCommand: 'make reactivation YES=1', trialDays: 30, draft: REACTIVATION_DRAFT })) },
  { id: 'return-intent-digest', variant: 'default', run: () => capture(() => M.sendReturnIntentDigestEmail(OPS, { recipients: [{ email: TO, angle: 'price', lastLoginAt: '2026-09-15T09:12:00.000Z', churnedAt: '2026-08-14T12:00:00.000Z' }], sendCommand: 'make return-intent YES=1', draft: RETURN_INTENT_DRAFT })) },
];

const out: Array<{ id: string; variant: string; subject: string; html: string; text: string; headers: Record<string, string> | null; error?: string }> = [];

for (const job of JOBS) {
  try {
    const sent = await job.run();
    out.push({
      id: job.id,
      variant: job.variant,
      subject: sent.subject,
      html: sent.html,
      text: sent.text,
      headers: sent.headers ?? null,
    });
    console.error(`ok   ${job.id} [${job.variant}]`);
  } catch (err) {
    out.push({ id: job.id, variant: job.variant, subject: '', html: '', text: '', headers: null, error: String(err) });
    console.error(`FAIL ${job.id} [${job.variant}]: ${err}`);
  }
}

writeFileSync(process.argv[2] ?? 'captured.json', JSON.stringify(out, null, 2));
console.error(`\nwrote ${out.length} renders (${out.filter((o) => o.error).length} failed)`);
