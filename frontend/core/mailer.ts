import { Resend } from 'resend';
import type { ChurnAlert } from './cancellationAlert.ts';

// Inlined rather than imported from core/stripe so this module stays
// importable from standalone `node --experimental-strip-types` scripts —
// the TS '@/' path alias is a Next.js compile-time thing, not a Node
// runtime resolver, and core/stripe transitively re-exports through it.
function getAppUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

let cachedClient: Resend | null = null;

function getClient() {
  if (cachedClient) return cachedClient;
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error('Missing required env var: RESEND_API_KEY');
  }
  cachedClient = new Resend(apiKey);
  return cachedClient;
}

function getFromAddress() {
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!from) {
    throw new Error('Missing required env var: RESEND_FROM_EMAIL');
  }
  return from;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Folds of Honor Proud Supporter footer block — appended to subscriber-facing
// emails (paid welcome, founding welcome, welcome back, payment recovered,
// referral reward) so every recipient sees the pledge in every touchpoint.
// Deliberately compact so it never dominates the message. The badge sits inside
// a white circular pad so its red/white/navy palette doesn't clash with any
// parent background.
//
// Deliberately NOT included on transactional/auth emails (verify, password
// reset, payment failed, checkout recovery) — those need to read urgent, not
// decorated.
function renderFohFooterHtml(): string {
  const givingUrl = escapeHtml(`${getAppUrl()}/giving`);
  const badgeUrl = escapeHtml(`${getAppUrl()}/folds-of-honor-proud-supporter.png`);
  return `
    <div style="margin: 32px 0 0; padding: 20px 0 0; border-top: 1px solid #e8e8e8; display: flex; align-items: center; gap: 18px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
      <a href="${givingUrl}" style="flex-shrink: 0; display: inline-block; line-height: 0; text-decoration: none;">
        <img src="${badgeUrl}" alt="Folds of Honor Proud Supporter" width="52" height="52" style="width: 52px; height: 52px; border-radius: 50%; background: #ffffff; padding: 3px; box-sizing: border-box; display: block;" />
      </a>
      <div style="flex: 1; min-width: 0; font-size: 12px; line-height: 1.55; color: #555;">
        <div style="font-weight: 700; color: #1a1a1a; margin-bottom: 2px;">ZeroGEX is a Folds of Honor Proud Supporter.</div>
        3% of every subscription funds educational scholarships for the families of fallen and disabled U.S. service members. <a href="${givingUrl}" style="color: #f5b400; font-weight: 600; text-decoration: none;">See /giving</a> for the running total.
      </div>
    </div>
  `.trim();
}

function renderFohFooterTextLines(): string[] {
  return [
    '---',
    'ZeroGEX is a Folds of Honor Proud Supporter. 3% of every subscription',
    'funds educational scholarships for the families of fallen and disabled',
    `U.S. service members. Full mechanics at ${getAppUrl()}/giving`,
  ];
}

// ET-bound so the displayed day matches how we describe deadlines elsewhere
// (founding lockin uses 09:30 ET). Formatting in the user's local zone or
// UTC would produce a confusing off-by-one near midnight on the trial end.
function formatTrialEndDate(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso));
}

// How a welcome email names the length of the trial that just started. The
// trial is NOT always the standard 7 days: a cold signup returning through the
// ?reactivate=1 link in the second-touch reactivation email is granted the
// extended REACTIVATION_TRIAL_DAYS (default 30 — see
// app/api/billing/checkout/route.ts), and an operator can restore a hand-picked
// window with scripts/restore-trial-after-switch.mts. Callers pass the real
// count read off the subscription's own trial window, so the copy tracks what
// Stripe will actually do instead of repeating an assumption.
//
// A missing or implausible count drops the number instead of guessing: "your
// free trial is now active" is true for every trial length, whereas a wrong day
// count is a billing promise the trial-end date in the very next sentence would
// immediately contradict.
export function describeTrialLength(trialDays?: number | null): string {
  if (typeof trialDays !== 'number' || !Number.isFinite(trialDays)) return 'free trial';
  const days = Math.round(trialDays);
  if (days < 1 || days > 365) return 'free trial';
  return `${days}-day free trial`;
}

// The "start here" focus list — the most relevant pieces of ZeroGEX for a
// first session, named to match the live dashboard's actual card/section
// titles so a new user can find each one. Today's Read leads because it's the
// plain-English regime summary that sits at the very top of the board. Shared
// by the automated trial welcome (sendPaidWelcomeEmail) and the one-time
// trial-quickstart bridge (sendTrialQuickstartEmail) so the guidance stays in
// lockstep between them. Keep this in sync if the dashboard's headline
// cards/labels change.
const TRIAL_START_HERE: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Today's Read",
    body: 'the plain-English summary at the top of the dashboard telling you whether conditions currently favor stability or bigger moves.',
  },
  {
    title: 'GEX Strike Profile',
    body: 'the at-a-glance chart of how much dealer gamma sits at each strike, with the key walls and flip marked right on price, so the levels that matter jump out and are easy to act on.',
  },
  {
    title: 'Gamma Flip',
    body: 'the line between more stabilizing and more volatile dealer positioning.',
  },
  {
    title: 'Call Wall / Put Wall',
    body: 'the key upside and downside options levels where price may pin, reject, or react.',
  },
  {
    title: 'Net GEX',
    body: 'whether the broader options structure is more stabilizing or more unstable right now.',
  },
  {
    title: 'SPY / SPX / QQQ / NDX',
    body: 'the same read across all four, for intraday index context.',
  },
];

// Careful risk framing carried by every trial-facing email that points users
// at live levels, so the framing is set the first time they open the product.
// Deliberately does NOT claim "not a trade-alert service" — TradeWorkz does
// surface trade alerts — but still makes the honest, blanket no-guaranteed-
// outcome / not-financial-advice point, which applies platform-wide including
// the alerts. Kept verbatim across emails on purpose.
const TRIAL_DISCLAIMER_LINE =
  "ZeroGEX is built to give you better market-structure context before price gets there. It isn't financial advice, and no tool can promise a guaranteed outcome — how you trade the levels is always your call.";

function startHereTextLines(): string[] {
  return TRIAL_START_HERE.map((s) => `  • ${s.title} — ${s.body}`);
}

function startHereHtmlList(): string {
  const items = TRIAL_START_HERE.map(
    (s) =>
      `<li style="margin: 0 0 8px;"><strong>${escapeHtml(s.title)}</strong> &mdash; ${escapeHtml(s.body)}</li>`,
  ).join('');
  return `<ul style="padding-left: 20px; margin: 12px 0;">${items}</ul>`;
}

// Self-service API-key instructions carried by both Pro welcome emails (paid /
// trial and founding). Key generation is a Pro benefit (isApiKeyEligibleTier),
// so every recipient of these two emails can act on it the moment they read it.
// The in-app one-time Pro welcome modal (components/ProWelcomeModal) announces
// the same thing, but it only fires on the first landing back from checkout and
// is dismissed for good — a member who closes it, checks out on a phone, or
// simply doesn't need the API until later has nothing to go back to. The email
// is the durable copy they can search their inbox for, so the steps are spelled
// out here rather than reduced to a link. Keep these three steps in sync with
// the modal and the account page's API Access section (components/AccountApiKeys).
const API_KEY_STEPS: ReadonlyArray<string> = [
  'Open Account → API Access.',
  'Click "Generate API Key" and copy the secret — it\'s shown only once.',
  'Send it on your requests as the header: Authorization: Bearer <your key>',
];

const API_KEY_INTRO =
  'One more thing worth knowing about: your Pro plan includes self-service API keys, so you can call the ZeroGEX data API straight from your own scripts, spreadsheets, and integrations — no waiting on support. If you ever need one:';

// Returning members need the same steps for a different reason: dropping below
// Pro revokes every key the account held (revokeApiKeysIfTierDropped), so any
// integration they left running — a NinjaTrader indicator, a sheet, a bot — is
// authenticating with a dead key until they mint a new one. Say that plainly
// rather than reusing the "if you ever need one" framing, which reads as
// optional to someone whose setup is already broken.
const API_KEY_INTRO_RETURNING =
  'One thing to know if you were using the API before: your old key was revoked when the subscription lapsed, so any script, spreadsheet, or NinjaTrader chart still pointed at it needs a fresh one. Generating a replacement takes a few seconds:';

function apiKeyTextLines(intro: string = API_KEY_INTRO): string[] {
  const apiKeyUrl = `${getAppUrl()}/account#api-access`;
  return [
    intro,
    '',
    ...API_KEY_STEPS.map((step, i) => `  ${i + 1}. ${step}`),
    '',
    `Generate a key here: ${apiKeyUrl}`,
    "You can generate or regenerate a key anytime from your account page — regenerating immediately deactivates the previous key.",
  ];
}

function apiKeyHtmlBlock(intro: string = API_KEY_INTRO): string {
  const apiKeyUrl = `${getAppUrl()}/account#api-access`;
  const safeApiKeyUrl = escapeHtml(apiKeyUrl);
  const items = API_KEY_STEPS.map(
    (step) => `<li style="margin: 0 0 8px;">${escapeHtml(step)}</li>`,
  ).join('');
  return `
      <p>${escapeHtml(intro)}</p>
      <ol style="padding-left: 20px; margin: 12px 0;">${items}</ol>
      <p style="margin: 0 0 8px;"><a href="${safeApiKeyUrl}" style="color: #f5b400; font-weight: 600;">Generate an API key</a></p>
      <p style="font-size: 13px; color: #555; margin: 0 0 16px;">You can generate or regenerate a key anytime from your account page &mdash; regenerating immediately deactivates the previous key.</p>`;
}

export async function sendEmailVerification(to: string, verifyUrl: string) {
  const safeLink = escapeHtml(verifyUrl);
  const subject = 'Verify your ZeroGEX email';
  const text = [
    'Welcome to ZeroGEX!',
    '',
    'Please confirm this email address by opening the link below. Verification is required before you can subscribe to a paid plan.',
    verifyUrl,
    '',
    'This link expires in 24 hours.',
    '',
    "If you didn't create a ZeroGEX account, you can safely ignore this email.",
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Verify your ZeroGEX email</h1>
      <p>Welcome to ZeroGEX! Please confirm this email address to finish setting up your account. Verification is required before you can subscribe to a paid plan.</p>
      <p style="margin: 24px 0;">
        <a href="${safeLink}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Verify email</a>
      </p>
      <p style="font-size: 13px; color: #555;">Or copy this URL into your browser:<br><span style="word-break: break-all;">${safeLink}</span></p>
      <p style="font-size: 13px; color: #555;">This link expires in 24 hours.</p>
      <p style="font-size: 13px; color: #555;">If you didn't create a ZeroGEX account, you can safely ignore this email.</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Sent to a referrer when one of their referrals subscribes and they earn a
// free month. `kind` distinguishes an immediate Stripe balance credit (they
// have an active subscription) from a banked month (they don't yet).
export async function sendReferralRewardEmail(
  to: string,
  opts: { kind: 'credited' | 'banked'; amountFormatted?: string; accountUrl: string },
) {
  const safeLink = escapeHtml(opts.accountUrl);
  const subject = '🎉 You earned a free month on ZeroGEX';

  const rewardSentence =
    opts.kind === 'credited'
      ? `We've added ${opts.amountFormatted ?? 'a free month'} of account credit, which will be applied automatically to your next invoice.`
      : "You've earned a free month — we'll apply it as account credit automatically the next time you subscribe.";

  const text = [
    'Great news!',
    '',
    `Someone you referred just subscribed to ZeroGEX. ${rewardSentence}`,
    '',
    'See your referrals and rewards here:',
    opts.accountUrl,
    '',
    'Thanks for spreading the word.',
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">🎉 You earned a free month</h1>
      <p>Someone you referred just subscribed to ZeroGEX. ${escapeHtml(rewardSentence)}</p>
      <p style="margin: 24px 0;">
        <a href="${safeLink}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">View your referrals</a>
      </p>
      <p style="font-size: 13px; color: #555;">Thanks for spreading the word.</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

export async function sendPaidWelcomeEmail(
  to: string,
  opts?: {
    trialEndIso?: string | null;
    // Real length of the trial in days, derived by the caller from the
    // subscription's own trial window (trial_start -> trial_end) rather than
    // assumed to be the standard 7: a reactivation signup gets
    // REACTIVATION_TRIAL_DAYS (default 30). Omitted or unusable and the copy
    // names no day count at all (see describeTrialLength).
    trialDays?: number | null;
    // When the subscription was checked out under the limited-time public
    // promo, the webhook passes a short descriptor like "first 6 months" or
    // "first year" so the welcome email mentions the intro window and what
    // the renewal rate will look like. Detection happens in the webhook by
    // checking subscription.discounts against getActivePromoCouponIds().
    promoIntroLabel?: string | null;
  },
) {
  const trialEndDate = opts?.trialEndIso ? formatTrialEndDate(opts.trialEndIso) : null;
  const promoLabel = opts?.promoIntroLabel ?? null;
  // A set trial-end date means the subscription is still trialing (the standard
  // checkout path), whatever that trial's length turned out to be. Trial copy
  // deliberately avoids "thank you for subscribing" — a trialer hasn't paid, and
  // that phrasing reads as if they were charged. The no-trial branch is a
  // genuine immediate paid subscriber, so it keeps the "subscribing" thank-you.
  const isTrial = Boolean(trialEndDate);
  const subject = isTrial
    ? 'Your ZeroGEX trial is active'
    : 'Thank you for subscribing to ZeroGEX!';

  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const trialLength = describeTrialLength(opts?.trialDays);
  const trialLineText = trialEndDate
    ? `Your ${trialLength} is now active, so you have full access right away — dive in and make the most of it. You won't be charged until ${trialEndDate}, and if ZeroGEX turns out not to be the right fit, you're free to cancel before then from the billing portal on your account page (${accountUrl}) and you won't be billed.`
    : null;
  const trialLineHtml = trialEndDate
    ? `Your ${escapeHtml(trialLength)} is now active, so you have full access right away &mdash; dive in and make the most of it. You won't be charged until ${escapeHtml(trialEndDate)}, and if ZeroGEX turns out not to be the right fit, you're free to cancel before then from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a> and you won't be billed.`
    : null;
  const promoLineText = promoLabel
    ? `You're on our limited-time introductory rate for the ${promoLabel} — it's already attached to your subscription. After that period your plan renews automatically at our standard rate.`
    : null;
  const promoLineHtml = promoLabel
    ? `You're on our <strong>limited-time introductory rate</strong> for the ${escapeHtml(promoLabel)} &mdash; it's already attached to your subscription. After that period your plan renews automatically at our standard rate.`
    : null;

  const thankYouLine = isTrial
    ? 'I just wanted to personally thank you for trying ZeroGEX.'
    : 'I just wanted to personally thank you for subscribing to ZeroGEX.';
  const growthLine = isTrial
    ? 'ZeroGEX is still growing quickly, and early users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders.'
    : 'It genuinely means a lot to have your support this early. ZeroGEX is still growing quickly, and early paid users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders.';

  const text = [
    'Hello,',
    '',
    ...(trialLineText ? [trialLineText, ''] : []),
    ...(promoLineText ? [promoLineText, ''] : []),
    thankYouLine,
    '',
    "The best place to start is the live dashboard. For your first session, here's where I'd look first:",
    '',
    ...startHereTextLines(),
    '',
    `Start here: ${dashboardUrl}`,
    '',
    TRIAL_DISCLAIMER_LINE,
    '',
    ...apiKeyTextLines(),
    '',
    growthLine,
    '',
    "Please feel free to reply directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.",
    '',
    'Thanks again — I really appreciate your support.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    `P.S. Curious what we've shipped lately? See the latest product updates at ${getAppUrl()}/updates`,
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      ${trialLineHtml ? `<p>${trialLineHtml}</p>` : ''}
      ${promoLineHtml ? `<p>${promoLineHtml}</p>` : ''}
      <p>${thankYouLine}</p>
      <p>The best place to start is the live dashboard. For your first session, here's where I'd look first:</p>
      ${startHereHtmlList()}
      <p style="margin: 24px 0;">
        <a href="${safeDashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Open the live dashboard</a>
      </p>
      <p style="font-size: 13px; color: #555;">${TRIAL_DISCLAIMER_LINE}</p>
      ${apiKeyHtmlBlock()}
      <p>${growthLine}</p>
      <p>Please feel free to reply directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.</p>
      <p>Thanks again &mdash; I really appreciate your support.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      <p style="font-size: 13px; color: #555;">P.S. Curious what we've shipped lately? See the latest product updates at <a href="${escapeHtml(`${getAppUrl()}/updates`)}" style="color: #f5b400; font-weight: 600;">${escapeHtml(`${getAppUrl()}/updates`)}</a>.</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// One-time "bridge" email for users who were ALREADY mid-trial when the
// activation-focused welcome email (sendPaidWelcomeEmail's trial copy) shipped.
// They received the older welcome that was purely a thank-you note, so they
// never got the "start here" onboarding the new welcome now includes. This
// closes that gap: it delivers the same start-here guidance + dashboard link +
// disclaimer as a standalone founder note, deliberately WITHOUT repeating the
// old email's thank-you or the full billing/cancel walkthrough (which they
// already have, and which the ~48h trial-end reminder covers again). Sent
// manually via scripts/send-trial-quickstart.mts as a one-shot to the current
// 'trialing' cohort; not wired into any webhook.
export async function sendTrialQuickstartEmail(
  to: string,
  opts?: { trialEndIso?: string | null },
) {
  const trialEndDate = opts?.trialEndIso ? formatTrialEndDate(opts.trialEndIso) : null;
  const subject = 'Getting the most out of your ZeroGEX trial';

  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  // Light, single-line trial context — references the dynamic end date without
  // re-litigating the cancel/billing mechanics the welcome + reminder already
  // cover. Falls back to a date-free line if we somehow lack a trial_end.
  const trialContextText = trialEndDate
    ? `You're currently on your ZeroGEX free trial, with full access through ${trialEndDate}.`
    : "You're currently on your ZeroGEX free trial, with full access to everything.";
  const trialContextHtml = trialEndDate
    ? `You're currently on your ZeroGEX free trial, with full access through <strong>${escapeHtml(trialEndDate)}</strong>.`
    : "You're currently on your ZeroGEX free trial, with full access to everything.";

  const text = [
    'Hello,',
    '',
    "I'm Michael, the founder of ZeroGEX. " +
      trialContextText +
      " I recently put together a short guide on where to focus first, and since you started your trial before it existed, I wanted to make sure you had it too rather than leaving you to dig for the important parts.",
    '',
    "The best place to start is the live dashboard. Here's where I'd look first:",
    '',
    ...startHereTextLines(),
    '',
    `Start here: ${dashboardUrl}`,
    '',
    TRIAL_DISCLAIMER_LINE,
    '',
    "If anything's unclear or you have a question, just reply to this email. I read every message myself, and it genuinely shapes what I build next.",
    '',
    'Thanks for giving ZeroGEX a try.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>I'm Michael, the founder of ZeroGEX. ${trialContextHtml} I recently put together a short guide on where to focus first, and since you started your trial before it existed, I wanted to make sure you had it too rather than leaving you to dig for the important parts.</p>
      <p>The best place to start is the live dashboard. Here's where I'd look first:</p>
      ${startHereHtmlList()}
      <p style="margin: 24px 0;">
        <a href="${safeDashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Open the live dashboard</a>
      </p>
      <p style="font-size: 13px; color: #555;">${TRIAL_DISCLAIMER_LINE}</p>
      <p>If anything's unclear or you have a question, just reply to this email. I read every message myself, and it genuinely shapes what I build next.</p>
      <p>Thanks for giving ZeroGEX a try.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

export async function sendFoundingWelcomeEmail(
  to: string,
  opts?: { trialEndIso?: string | null },
) {
  const trialEndDate = opts?.trialEndIso ? formatTrialEndDate(opts.trialEndIso) : null;
  const subject = 'Thank you for subscribing to ZeroGEX!';

  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);
  const trialLineText = trialEndDate
    ? `Your founding rate is locked in — but you won't be charged until ${trialEndDate}. Your first payment, at your founding rate, happens then. Cancel before that from the billing portal on your account page (${accountUrl}) and you won't be billed.`
    : null;
  const trialLineHtml = trialEndDate
    ? `Your founding rate is locked in &mdash; but you won't be charged until ${escapeHtml(trialEndDate)}. Your first payment, at your founding rate, happens then. Cancel before that from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a> and you won't be billed.`
    : null;

  const text = [
    'Hello,',
    '',
    ...(trialLineText ? [trialLineText, ''] : []),
    'I just wanted to personally thank you for subscribing to ZeroGEX.',
    '',
    "It genuinely means a lot to have your support this early. ZeroGEX is still growing quickly, and early paid users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders. As a Founding Member your rate is locked in for the first year, and the 25% lifetime discount applies automatically after that.",
    '',
    ...apiKeyTextLines(),
    '',
    "Please feel free to reach out to me directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.",
    '',
    'Thanks again — I really appreciate your support.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      ${trialLineHtml ? `<p>${trialLineHtml}</p>` : ''}
      <p>I just wanted to personally thank you for subscribing to ZeroGEX.</p>
      <p>It genuinely means a lot to have your support this early. ZeroGEX is still growing quickly, and early paid users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders. As a Founding Member your rate is locked in for the first year, and the 25% lifetime discount applies automatically after that.</p>
      ${apiKeyHtmlBlock()}
      <p>Please feel free to reach out to me directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.</p>
      <p>Thanks again &mdash; I really appreciate your support.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Nudge sent ~48h before a free trial converts to a paid charge. The intent
// is courteous, not promotional — give the user a heads-up so they have time
// to cancel cleanly if the service isn't a fit, which cuts the refund-request
// load and the chargeback risk that follow surprise auto-conversions. Sent
// at most once per trial window (latched by users.trial_reminder_email_sent_at,
// which the webhook clears whenever a new 'trialing' state begins).
export type TrialReminderEmailOptions = {
  trialEndIso: string;
  // When the underlying subscription is on the limited-time public promo,
  // the cron job passes a short label like "first 6 months" so the reminder
  // mentions the introductory rate that will kick in after the trial ends.
  promoIntroLabel?: string | null;
  // Post-trial billing specifics, resolved from Stripe by the caller (the
  // send-trial-reminders cron) so this presenter stays free of Stripe/DB I/O.
  // When present, the reminder spells out the exact amount and the card that
  // will be charged when the trial converts, so a member whose card is stale
  // or expiring can fix it before the attempt fails into past_due. Left off
  // (or passed null when the Stripe lookup fails) so the email still sends
  // cleanly without the line.
  billing?: {
    // Formatted post-trial charge, e.g. "$29.00/month". Built by the caller
    // from Stripe's upcoming-invoice preview, so it reflects any discount on
    // the subscription (the real amount that will be billed), paired with the
    // plan's own billing cadence.
    chargeLabel: string;
    // Display-ready card brand, e.g. "Visa" — already normalized by the
    // caller (Stripe reports brands lowercased). Optional/null for wallet or
    // unrecognized methods, in which case a neutral phrasing is used.
    cardBrand?: string | null;
    // Last four digits of the card on file, e.g. "4242". Null/omitted when the
    // member has no nameable card (a Link/wallet method): the reminder then
    // still quotes the price but refers to "the payment method on file" instead
    // of naming a card, so the price is never dropped just because the method
    // isn't a card.
    cardLast4?: string | null;
  } | null;
  // A signed one-click "lock in <pct>% off and keep going" link (buildConvertUrl),
  // when the cron could mint one (ZEROGEX_END_USER_TOKEN_SECRET set). Present it
  // and the reminder becomes a conversion push with the incentive CTA; omit/null
  // and it's the plain courtesy reminder, unchanged.
  convertOfferUrl?: string | null;
  // True when this member never came back after signing up, so the trial is
  // about to convert on someone who has not used the product. Swaps in copy
  // that leads with the charge and states the cancel option outright, and
  // suppresses the annual lock-in offer.
  //
  // A resolved boolean rather than the engagement enum, so this presenter
  // stays free of any dependency on core/trialEngagement — the same reason
  // CONVERT_OFFER_PERCENT is duplicated below rather than imported. Callers
  // resolve it with shouldSendDormantTrialCopy(classifyTrialEngagement(...)),
  // which is also what keeps the cron's --experimental-strip-types run (which
  // does not resolve the @/ alias) able to import this module.
  //
  // Omitted or false gives the ordinary reminder, so an unclassifiable member
  // never receives dormant copy by accident.
  dormant?: boolean;
};

// Pure builder for the ~48h trial-end reminder: assembles subject + HTML + text
// from already-resolved inputs, with no Resend/Stripe/DB I/O. Split out from the
// sender so a caller can render the EXACT wire copy for preview/dry-run without
// sending it (the cron's --render mode uses this), keeping preview and
// production from ever drifting.
export function buildTrialReminderEmail(opts: TrialReminderEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const trialEndDate = formatTrialEndDate(opts.trialEndIso);
  const promoLabel = opts.promoIntroLabel ?? null;
  const dormant = opts.dormant === true;
  // The dormant subject names the charge instead of the trial ending. A member
  // who never came back has no mental model of "my trial" to attach a reminder
  // to; what they will recognise later is the line on their statement, so the
  // subject is written to be recognised now rather than then.
  const subject = dormant
    ? 'Before your ZeroGEX trial converts — a quick check'
    : 'Your ZeroGEX free trial ends in 2 days';

  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);

  const promoLineText = promoLabel
    ? `Good news on the price: you locked in our limited-time introductory rate for the ${promoLabel}, so that's what your card will be charged after the trial — not the standard rate.`
    : null;
  const promoLineHtml = promoLabel
    ? `Good news on the price: you locked in our <strong>limited-time introductory rate</strong> for the ${escapeHtml(promoLabel)}, so that's what your card will be charged after the trial &mdash; not the standard rate.`
    : null;

  // "Your subscription will begin at $X/month using your Visa card ending in
  // 1234" — the exact charge, brand, and last-4 come from Stripe (see
  // resolveBillingDetails in the cron); we only format them here. The method
  // phrase has three tiers, most specific first:
  //   brand + last4 → "your Visa card ending in 1234"
  //   last4 only    → "the payment method ending in 1234"  (brand unmapped)
  //   neither       → "the payment method on file"         (Link/wallet: no card)
  // The last tier keeps the price line for members who checked out with Link or
  // a wallet, who have a chargeable method but no card brand/last4 to name.
  const billing = opts.billing ?? null;
  const cardTextPhrase = billing
    ? billing.cardLast4
      ? billing.cardBrand
        ? `your ${billing.cardBrand} card ending in ${billing.cardLast4}`
        : `the payment method ending in ${billing.cardLast4}`
      : 'the payment method on file'
    : null;
  const cardHtmlPhrase = billing
    ? billing.cardLast4
      ? billing.cardBrand
        ? `your ${escapeHtml(billing.cardBrand)} card ending in <strong>${escapeHtml(billing.cardLast4)}</strong>`
        : `the payment method ending in <strong>${escapeHtml(billing.cardLast4)}</strong>`
      : 'the payment method on file'
    : null;
  const billingLineText = billing
    ? `Your subscription will begin at ${billing.chargeLabel} using ${cardTextPhrase}.${
        // "Make sure your card is ready" is a nudge toward a successful charge,
        // which reads as pressure next to the dormant copy's offer of an exit.
        // The amount and the card still appear either way — that is the part
        // that stops the charge being unrecognised on a statement.
        dormant ? '' : ` Please make sure your payment method is ready, or update it from your account page (${accountUrl}).`
      }`
    : null;
  const billingLineHtml = billing
    ? `Your subscription will begin at <strong>${escapeHtml(billing.chargeLabel)}</strong> using ${cardHtmlPhrase}.${
        dormant ? '' : ` Please make sure your payment method is ready, or <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">update it here</a>.`
      }`
    : null;

  // Pre-trial-end CONVERSION incentive — present only when the cron minted a
  // signed /convert link. Mirrors SAVE_PERCENT in core/retentionOffer.ts (kept
  // local so this presenter stays free of the Stripe-importing module).
  const CONVERT_OFFER_PERCENT = 25;
  // Never offered to a dormant member. The pitch reads "by now you've had the
  // full board", which is false for someone who never came back, and locking
  // an unused account into a discounted year is how a chargeback becomes a
  // twelve-month chargeback. They get the plain reminder and a clear exit.
  const showConvertOffer = !!opts.convertOfferUrl && !dormant;
  const convertOfferText = showConvertOffer
    ? [
        `By now you've had the full board — Today's Read, the GEX strike profile, the gamma flip, and the call/put walls across SPY, SPX, QQQ and NDX. If it's earned a spot in your routine, you can lock in ${CONVERT_OFFER_PERCENT}% off for a full year before your trial ends:`,
        opts.convertOfferUrl,
        '',
      ]
    : [];
  // Re-tests opts.convertOfferUrl rather than relying on showConvertOffer alone
  // so the url stays narrowed to a string for escapeHtml below.
  const convertOfferHtml = showConvertOffer && opts.convertOfferUrl
    ? `<p>By now you've had the full board &mdash; Today's Read, the GEX strike profile, the gamma flip, and the call/put walls across SPY, SPX, QQQ and NDX. If it's earned a spot in your routine, you can <strong>lock in ${CONVERT_OFFER_PERCENT}% off for a full year</strong> before your trial ends.</p>
      <p style="margin: 20px 0;">
        <a href="${escapeHtml(opts.convertOfferUrl)}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 700; text-decoration: none; border-radius: 8px;">Lock in ${CONVERT_OFFER_PERCENT}% off &amp; keep my access</a>
      </p>`
    : '';

  // Openers. The ordinary one assumes the member knows what their trial is.
  // The dormant one cannot: it names the date, the charge and the exit in the
  // first two sentences, on the assumption this email is the only thing
  // standing between them and an unrecognised line on a statement.
  const openerText = dormant
    ? `I noticed you haven't been back to ZeroGEX since you signed up, so I wanted to flag this rather than let it surprise you: your free trial ends on ${trialEndDate}, and your first payment goes through then.`
    : `A quick heads-up: your ZeroGEX free trial ends on ${trialEndDate}, and your first payment will be charged then unless you cancel before that.`;
  const openerHtml = dormant
    ? `I noticed you haven't been back to ZeroGEX since you signed up, so I wanted to flag this rather than let it surprise you: your free trial ends on <strong>${escapeHtml(trialEndDate)}</strong>, and your first payment goes through then.`
    : `A quick heads-up: your ZeroGEX free trial ends on <strong>${escapeHtml(trialEndDate)}</strong>, and your first payment will be charged then unless you cancel before that.`;

  // Closing pair. For a dormant member the exit comes first and unhedged —
  // burying it under a pitch is what turns an unwanted charge into a dispute.
  // The offer of help is second and genuine: most of this cohort signed up
  // meaning to use it and never found their way in.
  const closingText = dormant
    ? [
        `If you'd rather not be charged, cancel from the billing portal on your account page (${accountUrl}) before ${trialEndDate} and you won't pay anything. One click, no email or support request needed.`,
        '',
        "And if you did mean to give it a proper look, reply to this email and tell me what you trade — I'll point you at the two or three levels on the board that actually matter for it. That's usually the whole gap between signing up and it being useful.",
      ]
    : [
        "If ZeroGEX is working for you, there's nothing you need to do — you'll keep full access and the renewal will go through automatically.",
        '',
        `If it isn't the right fit, you can cancel anytime from the billing portal on your account page (${accountUrl}) and you won't be charged a cent.`,
      ];
  const closingHtml = dormant
    ? `<p>If you'd rather not be charged, <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">cancel from the billing portal</a> before ${escapeHtml(trialEndDate)} and you won't pay anything. One click, no email or support request needed.</p>
      <p>And if you did mean to give it a proper look, reply to this email and tell me what you trade &mdash; I'll point you at the two or three levels on the board that actually matter for it. That's usually the whole gap between signing up and it being useful.</p>`
    : `<p>If ZeroGEX is working for you, there's nothing you need to do &mdash; you'll keep full access and the renewal will go through automatically.</p>
      <p>If it isn't the right fit, you can cancel anytime from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a> and you won't be charged a cent.</p>`;

  const text = [
    'Hello,',
    '',
    openerText,
    '',
    ...(billingLineText ? [billingLineText, ''] : []),
    ...(promoLineText ? [promoLineText, ''] : []),
    ...convertOfferText,
    ...closingText,
    '',
    "Either way, thanks for giving ZeroGEX a try — if there's anything I can do to make it more useful for you, just reply to this email. I read every message.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${openerHtml}</p>
      ${billingLineHtml ? `<p>${billingLineHtml}</p>` : ''}
      ${promoLineHtml ? `<p>${promoLineHtml}</p>` : ''}
      ${convertOfferHtml}
      ${closingHtml}
      <p style="margin: 24px 0;">
        <a href="${safeAccountUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Manage subscription</a>
      </p>
      <p>Either way, thanks for giving ZeroGEX a try &mdash; if there's anything I can do to make it more useful for you, just reply to this email. I read every message.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  return { subject, html, text };
}

// Sends the ~48h trial-end reminder. Thin wrapper over buildTrialReminderEmail
// so the wire copy and any --render preview never drift.
export async function sendTrialReminderEmail(to: string, opts: TrialReminderEmailOptions) {
  const { subject, html, text } = buildTrialReminderEmail(opts);

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

export type TrialValueEmailOptions = {
  // ISO trial-end instant, used only to name the date the member has until —
  // this email is about getting value NOW, never about the charge.
  trialEndIso: string;
  // Footer unsubscribe URL (this is an engagement email, so it honors opt-out
  // and must carry a one-click unsubscribe link, unlike the transactional
  // 48h billing reminder).
  unsubUrl: string;
};

// Pure builder for the mid-trial VALUE nudge (~day 2 of a 7-day trial): a
// founder-voice activation email that steers a new trialer to the two or three
// actions that make ZeroGEX "click", sent EARLY — before the day 3–7 cancel
// wave and well before the 48h billing reminder. Deliberately carries NO charge
// or cancel language: its whole job is time-to-value, not billing. Split from
// the sender (no Resend/DB I/O) so a preview renders the exact wire copy.
export function buildTrialValueEmail(opts: TrialValueEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const trialEndDate = formatTrialEndDate(opts.trialEndIso);
  const subject = 'Getting a real read out of your ZeroGEX trial';
  const appUrl = getAppUrl();
  const dashboardUrl = `${appUrl}/dashboard`;
  const chartUrl = `${appUrl}/chart`;
  const biasUrl = `${appUrl}/trade-bias`;
  const gexUrl = `${appUrl}/education/gamma-exposure-explained`;
  const safeDashboardUrl = escapeHtml(dashboardUrl);
  const safeChartUrl = escapeHtml(chartUrl);
  const safeBiasUrl = escapeHtml(biasUrl);
  const safeGexUrl = escapeHtml(gexUrl);
  const safeUnsubUrl = escapeHtml(opts.unsubUrl);
  const linkStyle = 'color: #f5b400; font-weight: 600;';

  const text = [
    'Hello,',
    '',
    "You're a couple of days into your ZeroGEX trial, and I wanted to reach out while you've still got runway (your trial runs through " +
      `${trialEndDate}). Almost everyone who sticks around got one clear read early — so here's the fastest path to it:`,
    '',
    "  1. Start on the Main Dashboard — it's the page to open every morning: your at-a-glance read of the regime, the key levels, and where price sits inside them.",
    '  2. Pull up the Gamma Chart — SPY/QQQ/SPX/NDX price with the Gamma Flip, Call/Put Walls, and Max Pain drawn right on it: the support/resistance map dealers actually defend. Use session rewind to replay how a level held.',
    '  3. Check Trade Bias for a single, signed directional call — it fuses the gamma and volatility regime with live flow, tape, and momentum into one read, for a multi-day swing or a same-day 0DTE.',
    '',
    `Open your dashboard: ${dashboardUrl}`,
    '',
    `Want the model behind it? The 5-minute read is Gamma Exposure Explained: ${gexUrl}`,
    '',
    "If anything's confusing, not what you expected, or just not clicking yet — reply to this email and tell me. I read every message and I'll personally help you get a useful read before your trial is up.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    `Prefer fewer emails like this? Unsubscribe: ${opts.unsubUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>You're a couple of days into your ZeroGEX trial, and I wanted to reach out while you've still got runway (your trial runs through <strong>${escapeHtml(trialEndDate)}</strong>). Almost everyone who sticks around got one clear read early &mdash; so here's the fastest path to it:</p>
      <ol style="padding-left: 20px; margin: 12px 0;">
        <li style="margin: 0 0 10px;">Start on the <a href="${safeDashboardUrl}" style="${linkStyle}">Main Dashboard</a> &mdash; the page to open every morning: your at-a-glance read of the regime, the key levels, and where price sits inside them.</li>
        <li style="margin: 0 0 10px;">Pull up the <a href="${safeChartUrl}" style="${linkStyle}">Gamma Chart</a> &mdash; SPY/QQQ/SPX/NDX price with the <strong>Gamma Flip</strong>, <strong>Call/Put Walls</strong>, and <strong>Max Pain</strong> drawn right on it: the support/resistance map dealers actually defend. Session rewind lets you replay how a level held.</li>
        <li style="margin: 0 0 10px;">Check <a href="${safeBiasUrl}" style="${linkStyle}">Trade Bias</a> for a single, signed directional call &mdash; it fuses the gamma and volatility regime with live flow, tape, and momentum into one read, for a multi-day swing or a same-day 0DTE.</li>
      </ol>
      <p style="margin: 24px 0;">
        <a href="${safeDashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Open your dashboard</a>
      </p>
      <p style="font-size: 14px; color: #3a4650;">Want the model behind it? The 5-minute read is <a href="${safeGexUrl}" style="${linkStyle}">Gamma Exposure Explained</a>.</p>
      <p>If anything's confusing, not what you expected, or just not clicking yet &mdash; reply to this email and tell me. I read every message and I'll personally help you get a useful read before your trial is up.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      <p style="margin-top: 24px; font-size: 12px; color: #888;">Prefer fewer emails like this? <a href="${safeUnsubUrl}" style="color: #888;">Unsubscribe</a>.</p>
    </div>
  `.trim();

  return { subject, html, text };
}

// Sends the mid-trial value nudge. Thin wrapper over buildTrialValueEmail so the
// wire copy and any preview never drift.
export async function sendTrialValueEmail(to: string, opts: TrialValueEmailOptions) {
  const { subject, html, text } = buildTrialValueEmail(opts);

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Final-call email to a founding-eligible user who has not yet converted,
// fired by scripts/send-founding-final-call.mts in the last ~36 hours before
// FOUNDING_LOCKIN_DEADLINE_ISO. One-shot per account (idempotency latch on
// users.founding_final_call_email_sent_at). Deliberately punchier and
// shorter than sendCheckoutRecoveryEmail — by the time this fires the user
// has already had the modal, a checkout-abandonment nudge, and weeks of
// in-product reminders, so this is the urgency closer, not a soft pitch.
export async function sendFoundingFinalCallEmail(
  to: string,
  opts: {
    deadlineLabel: string;
    foundingHref: string;
    // First-charge date for the deferred founding trial, e.g. "July 1, 2026".
    // Passed from FOUNDING_BILLING_START_LABEL so the "billed on" line tracks
    // the single source of truth instead of a date hardcoded in the copy.
    billingStartLabel: string;
    // Live founding prices (first-year intro rate, standard rate it's discounted
    // from, and the post-year-one lifetime percent), resolved from Stripe by the
    // caller (see core/offerPricing.ts). Null or absent → the offer copy keeps
    // its structure but drops the specific figures so it can never quote a stale
    // price.
    pricing?: {
      basicMonthlyIntro: string;
      proMonthlyIntro: string;
      basicMonthlyList: string;
      proMonthlyList: string;
      lifetimePercentOff: number | null;
    } | null;
  },
) {
  const subject = `Final reminder: ZeroGEX founding rate closes tomorrow, ${opts.deadlineLabel}`;
  const safeFoundingUrl = escapeHtml(opts.foundingHref);
  const safeDeadline = escapeHtml(opts.deadlineLabel);

  // Offer bullets. With live pricing we quote the exact first-year / standard
  // rates and lifetime discount straight from Stripe; without it (Stripe
  // unavailable) we keep the same structure but drop the specific figures so
  // the email can never advertise a stale price. The first-charge date always
  // comes from billingStartLabel, never a date hardcoded here.
  const pricing = opts.pricing ?? null;
  const basicOfferText = pricing
    ? `Basic: ${pricing.basicMonthlyIntro}/mo for the first year, normally ${pricing.basicMonthlyList}/mo`
    : 'Basic: a locked founding rate for the first year, well below standard pricing';
  const proOfferText = pricing
    ? `Pro: ${pricing.proMonthlyIntro}/mo for the first year, normally ${pricing.proMonthlyList}/mo`
    : 'Pro: a locked founding rate for the first year, well below standard pricing';
  const lifetimeOfferText =
    pricing?.lifetimePercentOff != null
      ? `After the first year, you keep ${pricing.lifetimePercentOff}% off standard pricing for as long as your subscription stays active`
      : 'After the first year, you keep a standing lifetime discount off standard pricing for as long as your subscription stays active';
  const billedLineText = `No charge today. Your card will not be billed until ${opts.billingStartLabel}.`;

  const basicOfferHtml = pricing
    ? `<strong>Basic:</strong> ${escapeHtml(pricing.basicMonthlyIntro)}/mo for the first year, normally ${escapeHtml(pricing.basicMonthlyList)}/mo`
    : `<strong>Basic:</strong> a locked founding rate for the first year, well below standard pricing`;
  const proOfferHtml = pricing
    ? `<strong>Pro:</strong> ${escapeHtml(pricing.proMonthlyIntro)}/mo for the first year, normally ${escapeHtml(pricing.proMonthlyList)}/mo`
    : `<strong>Pro:</strong> a locked founding rate for the first year, well below standard pricing`;
  const lifetimeOfferHtml =
    pricing?.lifetimePercentOff != null
      ? `After the first year, you keep <strong>${pricing.lifetimePercentOff}% off standard pricing</strong> for as long as your subscription stays active`
      : `After the first year, you keep a <strong>standing lifetime discount</strong> off standard pricing for as long as your subscription stays active`;
  const billedLineHtml = `<strong>No charge today.</strong> Your card will not be billed until ${escapeHtml(opts.billingStartLabel)}.`;

  const text = [
    'Hello,',
    '',
    `Just a final reminder that the ZeroGEX founding rate closes tomorrow, ${opts.deadlineLabel}.`,
    '',
    'I wanted to send one last note because you were part of the early ZeroGEX cohort, and I do not want anyone who intended to lock in the founding rate to miss the deadline.',
    '',
    "Here's the offer:",
    '',
    `  • ${basicOfferText}`,
    `  • ${proOfferText}`,
    `  • ${lifetimeOfferText}`,
    `  • ${billedLineText}`,
    '',
    `After ${opts.deadlineLabel}, founding access ends and future access will be at standard pricing.`,
    '',
    'If ZeroGEX has been useful to you, this is the best pricing I expect to offer, and it is my way of saying thank you to the people who were here early.',
    '',
    'You can lock it in here:',
    '',
    opts.foundingHref,
    '',
    "If ZeroGEX is not for you right now, no worries at all. You can ignore this email and you won't hear from me again about the founding offer.",
    '',
    'Thanks again for being part of the early ZeroGEX group. I genuinely appreciate the support, feedback, and encouragement many of you have shared.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.55;">
      <p>Hello,</p>
      <p>Just a final reminder that the ZeroGEX founding rate closes tomorrow, <strong>${safeDeadline}</strong>.</p>

      <p>I wanted to send one last note because you were part of the early ZeroGEX cohort, and I do not want anyone who intended to lock in the founding rate to miss the deadline.</p>

      <p style="margin: 20px 0 8px;">Here&rsquo;s the offer:</p>
      <ul style="padding-left: 22px; margin: 0 0 18px;">
        <li>${basicOfferHtml}</li>
        <li>${proOfferHtml}</li>
        <li>${lifetimeOfferHtml}</li>
        <li>${billedLineHtml}</li>
      </ul>

      <p>After <strong>${safeDeadline}</strong>, founding access ends and future access will be at standard pricing.</p>

      <p>If ZeroGEX has been useful to you, this is the best pricing I expect to offer, and it is my way of saying thank you to the people who were here early.</p>

      <p>You can lock it in here:</p>

      <p style="margin: 24px 0;">
        <a href="${safeFoundingUrl}" style="display: inline-block; padding: 14px 24px; background: #f5b400; color: #000; font-weight: 700; text-decoration: none; border-radius: 8px; font-size: 15px;">Lock in my founding rate</a>
      </p>

      <p>If ZeroGEX is not for you right now, no worries at all. You can ignore this email and you won&rsquo;t hear from me again about the founding offer.</p>

      <p>Thanks again for being part of the early ZeroGEX group. I genuinely appreciate the support, feedback, and encouragement many of you have shared.</p>

      <p style="margin-top: 22px;">Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// One-shot nudge sent ~24h after a user starts checkout but doesn't finish
// (no stripe_subscription_id stamped). foundingDeadlineLabel is set when the
// user is founding_eligible AND the lock-in deadline is still in the future
// — both branches link to /pricing so the user re-enters the existing
// checkout flow (which will reuse their cached stripe_customer_id rather
// than minting another orphan). Latched per-account by
// users.checkout_recovery_email_sent_at; deliberately never re-fires.
export async function sendCheckoutRecoveryEmail(
  to: string,
  opts: {
    foundingDeadlineLabel: string | null;
    // When the public limited-time promo is still open and the user isn't
    // already on the (richer) founding offer, the cron job passes this so the
    // nudge mentions the promo deadline rather than the generic copy. Founding
    // always wins precedence — eligible users get the founding-deadline
    // variant even if the promo is also live.
    promoDeadlineLabel?: string | null;
    // Live discounted monthly rates for the promo pitch, resolved from Stripe
    // by the caller (see core/offerPricing.ts) so the copy quotes the real
    // current rate, never a hardcoded number that can drift. Null or absent →
    // the promo copy drops the specific figures and just says the discounted
    // intro rate applies at checkout.
    promoPricing?: { basicMonthly: string; proMonthly: string } | null;
  },
) {
  const founding = opts.foundingDeadlineLabel;
  // Promo only surfaces when founding isn't already in play for this user;
  // the two offers are mutually exclusive at checkout (founding wins) so the
  // email should match what they'd actually get back to.
  const promo = !founding ? opts.promoDeadlineLabel ?? null : null;

  // Promo pitch: quote the live Basic/Pro monthly rates when the caller
  // resolved them from Stripe; otherwise stay specific-number-free so the copy
  // can never advertise a stale price. Leading space so it appends cleanly
  // after the "…closes {promo}." sentence.
  const promoPricing = opts.promoPricing ?? null;
  const promoRatesText = promoPricing
    ? ` Basic starts at ${promoPricing.basicMonthly}/mo and Pro at ${promoPricing.proMonthly}/mo, with discounted annual plans too.`
    : ' The discounted intro rate applies automatically at checkout, with discounted annual plans too.';
  const promoRatesHtml = promoPricing
    ? ` Basic starts at <strong>${escapeHtml(promoPricing.basicMonthly)}/mo</strong> and Pro at <strong>${escapeHtml(promoPricing.proMonthly)}/mo</strong>, with discounted annual plans too.`
    : ' The discounted intro rate applies automatically at checkout, with discounted annual plans too.';

  const subject = founding
    ? `Your ZeroGEX founding rate is still available — only until ${founding}`
    : promo
      ? `Your ZeroGEX limited-time offer is still open — only until ${promo}`
      : 'Pick up where you left off at ZeroGEX';

  const pricingUrl = `${getAppUrl()}/pricing`;
  const safePricingUrl = escapeHtml(pricingUrl);

  const text = founding
    ? [
        'Hello,',
        '',
        `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way — but as a founding member you're still eligible for the locked-in founding rate, and that offer closes ${founding}.`,
        '',
        `If you'd like to pick it back up, the same plan is one click away here: ${pricingUrl}`,
        '',
        `After the deadline the founding rate is gone for good, so I wanted to give you a heads-up rather than let it lapse quietly. If ZeroGEX isn't the right fit, just ignore this — you won't hear from me again about it.`,
        '',
        'Best,',
        'Michael',
        'Founder, ZeroGEX',
      ].join('\n')
    : promo
      ? [
          'Hello,',
          '',
          `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way — but our limited-time introductory pricing is still live and closes ${promo}.${promoRatesText}`,
          '',
          `If you'd like to pick it back up at the intro rate, the same plan is one click away here: ${pricingUrl}`,
          '',
          `Once the offer closes the standard rates come back, so I wanted to give you a heads-up rather than let it lapse quietly. If ZeroGEX isn't the right fit, just ignore this — you won't hear from me again about it.`,
          '',
          'Best,',
          'Michael',
          'Founder, ZeroGEX',
        ].join('\n')
      : [
          'Hello,',
          '',
          "I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way — sometimes a tab just gets closed.",
          '',
          `If you'd like to pick it back up, the same plan is one click away here: ${pricingUrl}`,
          '',
          `If ZeroGEX isn't the right fit, just ignore this — you won't hear from me again about it. And if anything stopped you from finishing (a pricing question, a missing feature, a confusing step), feel free to reply to this email. I read every message.`,
          '',
          'Best,',
          'Michael',
          'Founder, ZeroGEX',
        ].join('\n');

  const ctaLabel = founding
    ? 'Lock in the founding rate'
    : promo
      ? 'Claim the intro rate'
      : 'Resume checkout';
  const intro = founding
    ? `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way &mdash; but as a founding member you're still eligible for the locked-in founding rate, and that offer closes <strong>${escapeHtml(founding)}</strong>.`
    : promo
      ? `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way &mdash; but our <strong>limited-time introductory pricing</strong> is still live and closes <strong>${escapeHtml(promo)}</strong>.${promoRatesHtml}`
      : `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way &mdash; sometimes a tab just gets closed.`;
  const closer = founding
    ? `After the deadline the founding rate is gone for good, so I wanted to give you a heads-up rather than let it lapse quietly. If ZeroGEX isn't the right fit, just ignore this &mdash; you won't hear from me again about it.`
    : promo
      ? `Once the offer closes the standard rates come back, so I wanted to give you a heads-up rather than let it lapse quietly. If ZeroGEX isn't the right fit, just ignore this &mdash; you won't hear from me again about it.`
      : `If ZeroGEX isn't the right fit, just ignore this &mdash; you won't hear from me again about it. And if anything stopped you from finishing, feel free to reply to this email. I read every message.`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${intro}</p>
      <p>If you'd like to pick it back up, the same plan is one click away:</p>
      <p style="margin: 24px 0;">
        <a href="${safePricingUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">${escapeHtml(ctaLabel)}</a>
      </p>
      <p>${closer}</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

export async function sendWelcomeBackEmail(to: string) {
  const subject = 'Welcome back to ZeroGEX!';
  const text = [
    'Hello,',
    '',
    'I just wanted to personally thank you for coming back to ZeroGEX — it really does mean a lot to have you here again.',
    '',
    "ZeroGEX has kept growing since you were last subscribed, and returning users like you help me keep building. Your full access has been restored, so you can jump straight back into the data.",
    '',
    ...apiKeyTextLines(API_KEY_INTRO_RETURNING),
    '',
    "Please feel free to reach out to me directly if anything has changed about what you need, or if there's something we could improve. I read every message, and customer feedback is a huge part of how I'm shaping the product.",
    '',
    'Thanks again — I really appreciate your support.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>I just wanted to personally thank you for coming back to ZeroGEX &mdash; it really does mean a lot to have you here again.</p>
      <p>ZeroGEX has kept growing since you were last subscribed, and returning users like you help me keep building. Your full access has been restored, so you can jump straight back into the data.</p>
      ${apiKeyHtmlBlock(API_KEY_INTRO_RETURNING)}
      <p>Please feel free to reach out to me directly if anything has changed about what you need, or if there's something we could improve. I read every message, and customer feedback is a huge part of how I'm shaping the product.</p>
      <p>Thanks again &mdash; I really appreciate your support.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Sent on the first failed renewal attempt for an invoice (gated by
// invoice.attempt_count === 1 in the webhook so it does not re-fire on each
// Stripe Smart Retry). Names the exact card that failed, states that access has
// dropped to the free Public tier until payment clears, and gives Stripe's next
// automatic-retry date — all resolved by the caller (the webhook) and passed in,
// so this presenter stays free of Stripe/DB I/O. Each enrichment is best-effort:
// the card phrase, amount, and retry date each degrade to neutral wording when
// the caller can't resolve them, so the email always sends. Points the customer
// at the billing portal — logging in is the access path, since the portal
// session is created server-side against their authenticated account.
export type CardExpiringEmailOptions = {
  // Display-ready brand ("Visa"), already normalized by the caller; null for a
  // wallet/unmapped method → neutral phrasing.
  cardBrand?: string | null;
  // Last four of the card on file, e.g. "4242".
  cardLast4: string;
  // "MM/YYYY" the card expires, e.g. "09/2026".
  expiryLabel: string;
};

// PROACTIVE card-expiry nudge — emailed by scripts/send-card-expiry-reminders.mts
// to an ACTIVE subscriber whose card on file expires within ~45 days, so they can
// update it BEFORE a renewal is declined into past_due. Friendly and low-urgency
// (nothing has failed yet), but names the exact card + expiry and drives a
// one-click card update. No FOH footer (transactional, like the dunning family).
// Split into a pure builder so a preview renders the exact wire copy.
export function buildCardExpiringEmail(opts: CardExpiringEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);
  const subject = 'Heads-up: your card on file expires soon';

  const cardPhrase = opts.cardBrand
    ? `your ${opts.cardBrand} card ending in ${opts.cardLast4}`
    : `the card ending in ${opts.cardLast4}`;
  const cardPhraseHtml = opts.cardBrand
    ? `your ${escapeHtml(opts.cardBrand)} card ending in <strong>${escapeHtml(opts.cardLast4)}</strong>`
    : `the card ending in <strong>${escapeHtml(opts.cardLast4)}</strong>`;

  const lead = `Just a friendly heads-up: ${cardPhrase} — the one on file for your ZeroGEX subscription — expires ${opts.expiryLabel}. Once it lapses, your next renewal could be declined and your access would pause until you update it.`;
  const leadHtml = `Just a friendly heads-up: ${cardPhraseHtml} — the one on file for your ZeroGEX subscription — expires <strong>${escapeHtml(opts.expiryLabel)}</strong>. Once it lapses, your next renewal could be declined and your access would pause until you update it.`;
  const fix =
    'Updating it takes about a minute from your account page and keeps everything running without a hitch — nothing else changes.';

  const text = [
    'Hello,',
    '',
    lead,
    '',
    fix,
    '',
    accountUrl,
    '',
    "If you've already updated your card (or your bank has issued a replacement Stripe can pick up automatically), you can ignore this. Any questions, just reply — I'm happy to help.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${leadHtml}</p>
      <p>${escapeHtml(fix)}</p>
      <p style="margin: 24px 0;">
        <a href="${safeAccountUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Update your card</a>
      </p>
      <p>If you've already updated your card (or your bank has issued a replacement Stripe can pick up automatically), you can ignore this. Any questions, just reply &mdash; I'm happy to help.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  return { subject, html, text };
}

// Thin sender over buildCardExpiringEmail so preview and production never drift.
export async function sendCardExpiringEmail(to: string, opts: CardExpiringEmailOptions) {
  const { subject, html, text } = buildCardExpiringEmail(opts);
  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

export async function sendPaymentFailedEmail(
  to: string,
  opts?: {
    amountFormatted?: string | null;
    // The card Stripe just tried and failed to charge, so the nudge can name it.
    // Resolved from Stripe by the caller; brand is display-ready (or null for a
    // wallet/Link/unmapped method → neutral phrasing), last4 like "6284".
    cardBrand?: string | null;
    cardLast4?: string | null;
    // Stripe's next automatic retry (invoice.next_payment_attempt), ISO, so the
    // email can give a concrete "we'll try again on …" date. Null when Stripe has
    // exhausted its automatic retries (this was the final attempt).
    nextAttemptIso?: string | null;
    // When an ACTIVE payment-recovery grace window is open for this account (an
    // established renewal failure — see BILLING_PAYMENT_GRACE_DAYS), the ISO
    // instant it runs through. Lets the email say access is retained until then
    // instead of implying an immediate downgrade. Null/omitted when no window is
    // open, its state isn't known yet, or grace is disabled.
    graceUntilIso?: string | null;
  },
) {
  const subject = "We couldn't process your ZeroGEX payment";
  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);

  // Name the exact card when the caller resolved it; otherwise stay neutral.
  const cardPhrase = opts?.cardLast4
    ? opts.cardBrand
      ? `your ${opts.cardBrand} card ending in ${opts.cardLast4}`
      : `the payment method ending in ${opts.cardLast4}`
    : null;

  const amountSentence = opts?.amountFormatted
    ? cardPhrase
      ? `Your subscription payment of ${opts.amountFormatted} was declined — ${cardPhrase} didn't go through.`
      : `Your subscription payment of ${opts.amountFormatted} was declined by your card issuer.`
    : cardPhrase
      ? `Your subscription payment was declined — ${cardPhrase} didn't go through.`
      : 'Your subscription payment was declined by your card issuer.';

  // Access-state wording. An established (previously active) subscription that
  // fails a renewal now keeps Pro through a short grace window (see
  // BILLING_PAYMENT_GRACE_DAYS / core/paymentGrace.ts) while Stripe retries,
  // rather than dropping to Public on the first failure — so this must NOT assert
  // an immediate downgrade. When the caller confirmed an active grace window
  // (graceUntilIso), say access is held through that date; otherwise stay
  // tense-neutral so it's correct whether the account still has access (a race
  // where the past_due sync hasn't landed) or has already dropped (the no-grace
  // trial-conversion case). Retry timing is covered separately by retrySentence.
  const accessSentence = opts?.graceUntilIso
    ? `Your Pro access stays on through ${formatTrialEndDate(opts.graceUntilIso)}, so nothing changes right now. If the payment still can't be collected by then, your account moves to the free Public tier — and full Pro switches back on automatically the moment a charge succeeds.`
    : 'Updating your payment method is the fastest way to keep your Pro access from lapsing — and if the account has already dropped to the free Public tier, full Pro switches back on automatically the moment a payment succeeds.';

  // Concrete next-retry date when Stripe still has attempts left; a firmer note
  // when this was the final automatic attempt and cancellation is imminent.
  const retrySentence = opts?.nextAttemptIso
    ? `Stripe will automatically try again on ${formatTrialEndDate(opts.nextAttemptIso)}. If the retries don't succeed, the subscription will be canceled and you'd need to resubscribe to get Pro back.`
    : 'Stripe has made its final automatic attempt, so the subscription will be canceled shortly unless you update your payment method now.';

  const text = [
    'Hello,',
    '',
    `${amountSentence} ${accessSentence}`,
    '',
    retrySentence,
    '',
    "If you'd rather fix it now, you can update your payment method in a minute from the billing portal on your account page:",
    accountUrl,
    '',
    'If it was just a temporary hiccup (insufficient funds, an expired or replaced card), the next retry may clear it with nothing needed from you.',
    '',
    "And if you have any questions, just reply to this email — I'm happy to help.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${escapeHtml(amountSentence)} ${escapeHtml(accessSentence)}</p>
      <p>${escapeHtml(retrySentence)}</p>
      <p>If you'd rather fix it now, you can update your payment method in a minute from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a>.</p>
      <p style="margin: 24px 0;">
        <a href="${safeAccountUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Update payment method</a>
      </p>
      <p>If it was just a temporary hiccup (insufficient funds, an expired or replaced card), the next retry may clear it with nothing needed from you.</p>
      <p>And if you have any questions, just reply to this email &mdash; I'm happy to help.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Dunning for a TRIAL-CONVERSION failure: the first charge, when a free trial
// ends, was declined. A trialer never actually "subscribed", so the renewal-
// framed sendPaymentFailedEmail copy ("your subscription payment was declined")
// reads wrong to them and can even suggest a charge they didn't authorize. This
// speaks to a NEW customer keeping the access they've just been trying — same
// enrichments (named card, grace deadline, next retry) but welcoming, not lapse-
// framed. No FOH footer: urgent/transactional like its renewal sibling. The
// webhook chooses between the two via core/trialDunning isTrialConversionFailure.
export async function sendTrialConversionFailedEmail(
  to: string,
  opts?: {
    amountFormatted?: string | null;
    cardBrand?: string | null;
    cardLast4?: string | null;
    nextAttemptIso?: string | null;
    graceUntilIso?: string | null;
  },
) {
  const subject = 'Your ZeroGEX trial ended — a quick card fix to keep your access';
  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);

  const cardPhrase = opts?.cardLast4
    ? opts.cardBrand
      ? `your ${opts.cardBrand} card ending in ${opts.cardLast4}`
      : `the card ending in ${opts.cardLast4}`
    : null;

  // Trial-framed opener: they were on a free trial, so this is the FIRST charge —
  // not a renewal of something they already pay for.
  const declineSentence = opts?.amountFormatted
    ? cardPhrase
      ? `Your free trial just wrapped up and I went to start your subscription (${opts.amountFormatted}) — but ${cardPhrase} was declined, so the first charge didn't go through.`
      : `Your free trial just wrapped up and I went to start your subscription (${opts.amountFormatted}) — but your card was declined, so the first charge didn't go through.`
    : cardPhrase
      ? `Your free trial just wrapped up and I went to start your subscription — but ${cardPhrase} was declined, so the first charge didn't go through.`
      : `Your free trial just wrapped up and I went to start your subscription — but your card was declined, so the first charge didn't go through.`;

  // Access wording: if a trial-grace window is open (BILLING_TRIAL_GRACE_ENABLED),
  // access is held through it; otherwise stay tense-neutral (the account may have
  // dropped to Public, and re-grants automatically the moment a charge clears).
  const accessSentence = opts?.graceUntilIso
    ? `Good news: your full access stays on through ${formatTrialEndDate(opts.graceUntilIso)}, so nothing changes right now. Update your card before then and you won't miss a beat — if a charge still can't be collected, the account moves to the free Public tier, and full access switches back on automatically the moment one succeeds.`
    : `Updating your card is the fastest way to keep your access going — and if the account has already dropped to the free Public tier, full access switches back on automatically the moment a charge succeeds.`;

  const retrySentence = opts?.nextAttemptIso
    ? `Stripe will automatically try the card again on ${formatTrialEndDate(opts.nextAttemptIso)}, so an expired-or-replaced card or a momentary insufficient-funds hold may simply clear on its own.`
    : `Stripe has made its final automatic attempt, so updating your card now is the way to pick your subscription back up.`;

  const text = [
    'Hello,',
    '',
    `${declineSentence} ${accessSentence}`,
    '',
    retrySentence,
    '',
    'You can update your card in about a minute from your account page:',
    accountUrl,
    '',
    "If ZeroGEX earned a spot in your routine this week, that's all it takes to keep it. And if something's holding you back, just reply to this email — I read every one and I'm happy to help.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${escapeHtml(declineSentence)} ${escapeHtml(accessSentence)}</p>
      <p>${escapeHtml(retrySentence)}</p>
      <p>You can update your card in about a minute from your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a>.</p>
      <p style="margin: 24px 0;">
        <a href="${safeAccountUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Update your card</a>
      </p>
      <p>If ZeroGEX earned a spot in your routine this week, that&rsquo;s all it takes to keep it. And if something&rsquo;s holding you back, just reply to this email &mdash; I read every one and I&rsquo;m happy to help.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// The success bookend to sendTrialConversionFailedEmail: the trial ended and
// the FIRST real charge cleared. Until this existed the lifecycle was
// asymmetric — a failed conversion got an email, a successful one got silence,
// so the single moment a member actually starts paying was the one moment we
// said nothing. That silence is what turns an expected charge into a "what is
// this?" charge, which is a refund request or a dispute rather than a renewal.
//
// Deliberately a short CONFIRMATION, not a second onboarding email: the
// start-here guidance already went out with the trial welcome on day 0 and the
// billing mechanics with the 48h reminder, so repeating either here would read
// as a pitch attached to a charge. It states what was taken, on which card,
// when the next one lands, and where to manage it — then gets out of the way.
// Carries the FOH footer like the other positive subscriber touchpoints.
export type TrialConvertedEmailOptions = {
  // Formatted amount actually collected, e.g. "$29.00", or null when the
  // invoice didn't expose a usable amount/currency (the copy then stays
  // amount-neutral rather than guessing).
  amountFormatted?: string | null;
  // Display-ready card brand ("Visa"), already normalized by formatCardBrand.
  // Null for wallet/Link/unmapped methods → neutral "payment method on file".
  cardBrand?: string | null;
  // Last four of the card charged. Null when no card is resolvable.
  cardLast4?: string | null;
  // ISO instant of the next renewal charge (the conversion invoice's period
  // end). Omitted from the copy when null rather than hedged.
  nextChargeIso?: string | null;
  // True when the conversion invoice settled at zero — an account credit (a
  // banked referral free month, most often) covered the first period in full.
  // The copy then confirms the membership WITHOUT claiming a payment was
  // taken, which would be a false statement on the one email whose whole job
  // is being accurate about money.
  fullyCredited?: boolean;
};

// Pure builder for the trial-conversion confirmation: subject + text + HTML from
// already-resolved inputs, no Resend/Stripe/DB I/O. Split from the sender on the
// same rationale as buildTrialReminderEmail — a preview can render the exact wire
// copy, and the branch matrix is unit-testable (tests/trialConverted.test.ts).
export function buildTrialConvertedEmail(opts?: TrialConvertedEmailOptions): {
  subject: string;
  html: string;
  text: string;
} {
  const subject = 'Your ZeroGEX trial just became a full membership';

  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  // Same card phrasing as the failure email so the two bookends name a card
  // identically — a member who sees both reads one consistent voice.
  const cardPhrase = opts?.cardLast4
    ? opts.cardBrand
      ? `your ${opts.cardBrand} card ending in ${opts.cardLast4}`
      : `the card ending in ${opts.cardLast4}`
    : null;

  const amount = opts?.amountFormatted ?? null;
  const chargeClause = amount
    ? cardPhrase
      ? `the first payment went through — ${amount} on ${cardPhrase}`
      : `the first payment went through — ${amount} on your payment method on file`
    : cardPhrase
      ? `the first payment went through on ${cardPhrase}`
      : 'the first payment went through';

  const openerSentence = opts?.fullyCredited
    ? 'Your free trial just wrapped up and your membership rolled straight on — a credit on your account covered this first period in full, so there was nothing to pay.'
    : `Your free trial just wrapped up and ${chargeClause}. You're now a full ZeroGEX member.`;

  const accessSentence =
    "Nothing changes on your end and there's nothing to do — your full access simply carries on uninterrupted.";

  const nextChargeSentence = opts?.nextChargeIso
    ? `Your next charge is on ${formatTrialEndDate(opts.nextChargeIso)}, and it renews automatically from there until you cancel.`
    : null;

  const manageSentenceText = `Your invoices, your card, and the cancel button all live on your account page — you're free to change or cancel any of it at any time: ${accountUrl}`;

  const thanksSentence =
    "Thank you for backing ZeroGEX this early. Paid members are what make it possible for me to keep improving the platform, and I don't take that lightly.";

  const questionsSentence =
    "If anything about this charge looks off, or you have a question about your plan, just reply to this email — I read every one and I'm happy to sort it out.";

  const text = [
    'Hello,',
    '',
    `${openerSentence} ${accessSentence}`,
    '',
    ...(nextChargeSentence ? [nextChargeSentence, ''] : []),
    manageSentenceText,
    '',
    `Jump back into the live dashboard: ${dashboardUrl}`,
    '',
    thanksSentence,
    '',
    questionsSentence,
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${escapeHtml(openerSentence)} ${escapeHtml(accessSentence)}</p>
      ${nextChargeSentence ? `<p>${escapeHtml(nextChargeSentence)}</p>` : ''}
      <p>Your invoices, your card, and the cancel button all live on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a> &mdash; you're free to change or cancel any of it at any time.</p>
      <p style="margin: 24px 0;">
        <a href="${safeDashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Open the live dashboard</a>
      </p>
      <p>${escapeHtml(thanksSentence)}</p>
      <p>${escapeHtml(questionsSentence)}</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  return { subject, html, text };
}

// Sends the trial-conversion confirmation. Thin wrapper over
// buildTrialConvertedEmail so the wire copy and any preview never drift.
export async function sendTrialConvertedEmail(to: string, opts?: TrialConvertedEmailOptions) {
  const { subject, html, text } = buildTrialConvertedEmail(opts);

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Sent on the past_due → active recovery — the bookend to
// sendPaymentFailedEmail. Fires when a failed renewal is finally resolved
// (Stripe's Smart Retry succeeds on a later attempt, or the member updates
// their card), which re-promotes the account out of the dunning downgrade.
// This is reassurance, not urgency, so unlike the payment-failed nudge it
// carries the FOH footer like the other positive subscriber touchpoints.
// Latched in the webhook (payment_recovery_pending) so it only fires after a
// real failure, never on an ordinary renewal.
export async function sendPaymentRecoveredEmail(to: string) {
  const subject = "You're all set — your ZeroGEX payment went through";
  const dashboardUrl = `${getAppUrl()}/dashboard`;
  const safeDashboardUrl = escapeHtml(dashboardUrl);

  const text = [
    'Hello,',
    '',
    "Good news — the subscription payment we had trouble with earlier just went through, so your ZeroGEX account is fully active again. There's nothing more you need to do.",
    '',
    "If your access was interrupted while the charge sorted itself out, it's all restored now, and you can jump straight back into the data:",
    dashboardUrl,
    '',
    "Sorry for the small bump. If you have any questions about the charge, just reply to this email — I'm happy to help.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    ...renderFohFooterTextLines(),
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>Good news &mdash; the subscription payment we had trouble with earlier just went through, so your ZeroGEX account is fully active again. There's nothing more you need to do.</p>
      <p>If your access was interrupted while the charge sorted itself out, it's all restored now, and you can jump straight back into the data.</p>
      <p style="margin: 24px 0;">
        <a href="${safeDashboardUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Open the live dashboard</a>
      </p>
      <p>Sorry for the small bump. If you have any questions about the charge, just reply to this email &mdash; I'm happy to help.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      ${renderFohFooterHtml()}
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Sent when a customer clicks Cancel and Stripe flips cancel_at_period_end
// from false → true. They still have full access until periodEndIso — this
// is the retention window, not a farewell. Manual discount fulfillment
// (customer replies "discount", Michael sets it up) is intentional: reading
// the reply is worth more than automating the coupon.
export async function sendCancellationEmail(
  to: string,
  opts: { periodEndIso: string | null; saveUrl?: string | null },
) {
  const subject = 'Sorry to see you go — mind sharing why?';
  const periodEndDate = opts.periodEndIso
    ? formatTrialEndDate(opts.periodEndIso)
    : 'the end of your current billing period';
  const saveUrl = opts.saveUrl ?? null;

  const text = [
    'Hello,',
    '',
    'I saw you just cancelled your ZeroGEX subscription — first, thank you. You\'ve been a real part of what I\'ve been building here, and I don\'t take that lightly.',
    '',
    `You still have full access until ${periodEndDate}, so nothing changes yet on your end. I just wanted to reach out personally before that day comes.`,
    '',
    ...(saveUrl
      ? [
          'If it comes down to price, here\'s the one-click version: claim 25% off for a full year and keep your access — no re-subscribe, no re-entering a card:',
          saveUrl,
          '',
        ]
      : []),
    "If you have a minute, I'd love to know what made you cancel. Even one sentence back on this email helps me a lot — I read every reply. Common ones I hear:",
    '',
    "  - The data wasn't what I expected",
    '  - Price is too high for how I trade',
    "  - I'm not trading as much right now",
    '  - Something specific was missing or broken',
    '  - Just trying it out for a stretch',
    '',
    "Whatever the reason, I'd genuinely like to hear it.",
    '',
    'And if it\'s a matter of cost: I can offer you 25% off for a full year if you\'d like to stay. Just reply with "discount" and I\'ll set it up on your account — no need to re-subscribe or re-enter a card.',
    '',
    'Either way — thanks for giving ZeroGEX a shot. If you ever come back, your account will be here waiting.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>I saw you just cancelled your ZeroGEX subscription &mdash; first, thank you. You've been a real part of what I've been building here, and I don't take that lightly.</p>
      <p>You still have full access until <strong>${escapeHtml(periodEndDate)}</strong>, so nothing changes yet on your end. I just wanted to reach out personally before that day comes.</p>
      ${saveUrl
        ? `<div style="background: #f4fbf6; border: 1px solid #bfe6cf; border-radius: 10px; padding: 16px 18px; margin: 20px 0; text-align: center;">
        <p style="margin: 0 0 12px; font-size: 15px; color: #1a1a1a;">If it comes down to price &mdash; keep your access at <strong>25% off for a full year</strong>, in one click. No re-subscribe, no re-entering a card.</p>
        <a href="${escapeHtml(saveUrl)}" style="display: inline-block; padding: 12px 22px; background: #f5b400; color: #000; font-weight: 700; text-decoration: none; border-radius: 8px;">Keep my access &amp; claim 25% off</a>
      </div>`
        : ''}
      <p>If you have a minute, I'd love to know what made you cancel. Even one sentence back on this email helps me a lot &mdash; I read every reply. Common ones I hear:</p>
      <ul style="padding-left: 20px; margin: 12px 0;">
        <li>The data wasn't what I expected</li>
        <li>Price is too high for how I trade</li>
        <li>I'm not trading as much right now</li>
        <li>Something specific was missing or broken</li>
        <li>Just trying it out for a stretch</li>
      </ul>
      <p>Whatever the reason, I'd genuinely like to hear it.</p>
      <p style="background: #fff8e1; border-left: 3px solid #f5b400; padding: 12px 14px; margin: 20px 0;">
        <strong>And if it's a matter of cost:</strong> I can offer you 25% off for a full year if you'd like to stay. Just reply with <strong>"discount"</strong> and I'll set it up on your account &mdash; no need to re-subscribe or re-enter a card.
      </p>
      <p>Either way &mdash; thanks for giving ZeroGEX a shot. If you ever come back, your account will be here waiting.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Win-back email sent ~a month AFTER a subscription actually lapsed (not the
// click-cancel moment — sendCancellationEmail already owns that). This is the
// churned-cohort reactivation pitch: "here's what you've missed, you're missing
// out, come back at a discount — no pressure." Fired by scripts/send-winback.mts,
// which anchors the ~1-month timing on the user's most-recent
// stripe_subscription_deleted audit event and dedupes via
// users.winback_email_sent_at (cleared on re-subscribe so a future re-churn can
// re-fire, mirroring cancel_ack_email_sent_at).
//
// Three discount variants, resolved by the caller and ranked auto > promo >
// manual so the email always carries the best redeemable offer:
//   - winbackAutoApply → the fully-automated one-click coupon. The CTA links to
//     /pricing?winback=1 and the checkout route attaches STRIPE_COUPON_WINBACK_*
//     for this eligible churner (verified server-side). No code, no reply.
//   - promoDeadlineLabel → the live limited-time public promo (auto-applies at
//     /pricing) with a time-boxed deadline. Fallback when no win-back coupon is
//     configured but a public promo happens to be running.
//   - neither → the evergreen manual offer: reply "discount" and it's set up by
//     hand. Last-resort fallback so the email still makes a concrete offer even
//     with no coupon plumbing configured at all.
// discountLabel (e.g. "25% off your first year") is shown in the auto + manual
// copy and MUST match the actual STRIPE_COUPON_WINBACK_* value.
//
// Every send carries a plain-language opt-out footer ("you're receiving this
// because you created a ZeroGEX account… delete your account here"), where the
// opt-out mechanism is self-service account deletion (/account#delete-account).

export type WinbackHighlight = { title: string; body: string };

// "What's new since you left" — the default marquee list. scripts/send-winback.mts
// overrides this from content/winback-highlights.json so the copy stays evergreen
// without a code change; this constant is the fallback when that file is absent
// or unreadable. Keep it current if you ever edit it directly.
export const DEFAULT_WINBACK_HIGHLIGHTS: WinbackHighlight[] = [
  {
    title: 'Gamma Chart',
    body:
      'a live price-and-dealer-gamma terminal with the Gamma Flip, Call/Put Walls, and Max Pain drawn right on SPY, QQQ, SPX, and NDX — plus session rewind to replay how a level held.',
  },
  {
    title: 'My Dashboard',
    body:
      'a customizable board you build from the pieces of ZeroGEX you use most — arrange the charts and cards how you like, and it saves your layout, settings, and symbols.',
  },
  {
    title: 'Trade Bias',
    body:
      'a single, signed directional call that fuses the gamma and volatility regime with live price action, flow, tape, and momentum — for a multi-day swing or a same-day 0DTE read.',
  },
  {
    title: 'NDX coverage',
    body:
      'the Nasdaq-100 now gets the same gamma read as SPY, SPX, and QQQ across every tool.',
  },
];

export type WinbackEmailOptions = {
  winbackAutoApply?: boolean;
  discountLabel?: string;
  promoDeadlineLabel?: string | null;
  // Override the "what's new" bullets (evergreen list from the caller).
  highlights?: WinbackHighlight[];
};

// Pure render — no network. Returns the subject + text + html so the same
// content can be sent to a churner (sendWinbackEmail) or embedded in the
// founder's weekly review digest (sendWinbackDigestEmail) without drift.
export function renderWinbackEmail(opts?: WinbackEmailOptions): {
  subject: string;
  text: string;
  html: string;
} {
  const auto = opts?.winbackAutoApply === true;
  // Promo copy is a fallback only — the automated win-back coupon always wins
  // when it's configured, since it's the targeted per-user offer.
  const promo = !auto ? opts?.promoDeadlineLabel ?? null : null;
  const label = opts?.discountLabel?.trim() || '25% off your first year';
  const highlights =
    opts?.highlights && opts.highlights.length > 0 ? opts.highlights : DEFAULT_WINBACK_HIGHLIGHTS;

  // Auto variant sends them through the ?winback=1 link so the coupon attaches
  // at checkout; the other variants land on plain /pricing.
  const ctaHref = auto ? `${getAppUrl()}/pricing?winback=1` : `${getAppUrl()}/pricing`;
  const safeCtaHref = escapeHtml(ctaHref);

  // Opt-out target: self-service account deletion is the unsubscribe mechanism.
  const accountUrl = `${getAppUrl()}/account#delete-account`;
  const safeAccountUrl = escapeHtml(accountUrl);

  const subject = auto
    ? `A lot has changed at ZeroGEX — and your discount's ready`
    : promo
      ? `Your ZeroGEX intro rate is open again — through ${promo}`
      : 'A lot has changed at ZeroGEX since you left';

  const discountLineText = auto
    ? `And to make coming back easy, I've set aside ${label} for you — it's already on your account, so when you tap the button below you'll see the lower price before you confirm anything. No code to type, nothing to reply to.`
    : promo
      ? `And on price: our limited-time introductory pricing is open again right now — the discounted rate applies automatically at checkout, but only through ${promo}. If cost was part of why you left, this is the moment.`
      : `And if price was part of why you left, that offer still stands: just reply with the word "discount" and I'll get you set up with ${label}. I'll take care of the coupon on my end — you won't have to sort out anything fiddly.`;

  const discountLineHtml = auto
    ? `And to make coming back easy, I've set aside <strong>${escapeHtml(label)}</strong> for you &mdash; it's already on your account, so when you tap the button below you'll see the lower price before you confirm anything. No code to type, nothing to reply to.`
    : promo
      ? `And on price: our <strong>limited-time introductory pricing is open again</strong> right now &mdash; the discounted rate applies automatically at checkout, but only through <strong>${escapeHtml(promo)}</strong>. If cost was part of why you left, this is the moment.`
      : `And if price was part of why you left, that offer still stands: just reply with the word <strong>&ldquo;discount&rdquo;</strong> and I'll get you set up with <strong>${escapeHtml(label)}</strong>. I'll take care of the coupon on my end &mdash; you won't have to sort out anything fiddly.`;

  const ctaLabel = auto
    ? 'Come back at a discount'
    : promo
      ? 'Come back — see the new pricing'
      : 'See what you\'ve missed';

  const footerText =
    "You're receiving this because you created a ZeroGEX account. If you'd rather not hear from us, you can delete your account here (this cancels any subscription and closes your account):";

  const text = [
    'Hello,',
    '',
    "It's been about a month since your ZeroGEX subscription ended, and I wanted to reach out personally — no hard sell, just a genuine note. I don't like losing people, and I'd rather hear from you than not.",
    '',
    "A fair amount has changed since you left. A few of the bigger ones:",
    '',
    ...highlights.map((h) => `  • ${h.title} — ${h.body}`),
    '',
    "I'll be honest: if you still trade the way you used to, I think a couple of these would genuinely change your workflow, and it's a little bit of a shame to be missing them.",
    '',
    discountLineText,
    '',
    "No pressure at all, though. If the timing isn't right, just ignore this and I won't keep nudging you. But your account is still here exactly as you left it, the door's open, and I'd love to have you back.",
    '',
    'If anything specific pushed you away — a missing feature, a bug, a pricing thing — just hit reply and tell me. I read every message myself, and it genuinely shapes what I build next.',
    '',
    `Come back whenever you're ready: ${ctaHref}`,
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    '—',
    footerText,
    accountUrl,
  ].join('\n');

  const highlightsHtml = highlights
    .map(
      (h) =>
        `<li style="margin: 0 0 10px;"><strong>${escapeHtml(h.title)}</strong> &mdash; ${escapeHtml(h.body)}</li>`,
    )
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.55;">
      <p>Hello,</p>
      <p>It's been about a month since your ZeroGEX subscription ended, and I wanted to reach out personally &mdash; no hard sell, just a genuine note. I don't like losing people, and I'd rather hear from you than not.</p>
      <p>A fair amount has changed since you left. A few of the bigger ones:</p>
      <ul style="padding-left: 20px; margin: 12px 0;">${highlightsHtml}</ul>
      <p>I'll be honest: if you still trade the way you used to, I think a couple of these would genuinely change your workflow, and it's a little bit of a shame to be missing them.</p>
      <p style="background: #fff8e1; border-left: 3px solid #f5b400; padding: 12px 14px; margin: 20px 0;">${discountLineHtml}</p>
      <p style="margin: 24px 0;">
        <a href="${safeCtaHref}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">${escapeHtml(ctaLabel)}</a>
      </p>
      <p>No pressure at all, though. If the timing isn't right, just ignore this and I won't keep nudging you. But your account is still here exactly as you left it, the door's open, and I'd love to have you back.</p>
      <p>If anything specific pushed you away &mdash; a missing feature, a bug, a pricing thing &mdash; just hit reply and tell me. I read every message myself, and it genuinely shapes what I build next.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      <p style="font-size: 12px; color: #999; margin-top: 28px; border-top: 1px solid #eee; padding-top: 14px; line-height: 1.5;">
        You're receiving this because you created a ZeroGEX account. If you'd rather not hear from us, you can <a href="${safeAccountUrl}" style="color: #999; text-decoration: underline;">delete your account</a> &mdash; that cancels any subscription and closes the account.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendWinbackEmail(to: string, opts?: WinbackEmailOptions) {
  const { subject, text, html } = renderWinbackEmail(opts);

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Operator alert: one email per cancellation, the moment we notice one, carrying
// the reason the member typed on their way out. Sent by
// scripts/send-cancellation-alerts.mts (see there for the sweep + latch), never
// to a customer — `to` is always the founder's own address.
//
// The point of this email is a DECISION, not a record: everything needed to
// judge "is this one savable, and what do I say?" sits above the fold — the
// verbatim comment first (it is the only part no dashboard can reconstruct),
// then tenure and the save-window deadline, then the three commands you would
// otherwise go dig out of the Makefile.
//
// Deliberately no Folds of Honor footer and no unsubscribe: this is internal
// operational mail, not a subscriber touchpoint.
export async function sendCancellationAlertEmail(to: string, alert: ChurnAlert) {
  const pending = alert.kind === 'pending';
  const appUrl = getAppUrl();
  const adminUrl = `${appUrl}/admin/monitoring`;

  const factLines = alert.facts.map((f) => `  ${f.label.padEnd(18)} ${f.value}`).join('\n');
  const commandLines = alert.commands.map((c) => `  ${c}`).join('\n');

  const text = [
    alert.headline,
    ...(alert.saveWindowNote ? ['', alert.saveWindowNote] : []),
    '',
    'WHY THEY LEFT',
    `  Survey reason: ${alert.reasonLabel}`,
    alert.comment ? `  In their words: "${alert.comment}"` : '  They typed nothing.',
    '',
    'MEMBER',
    factLines,
    '',
    'NEXT',
    commandLines,
    '',
    `Admin dashboard: ${adminUrl}`,
    '',
    alert.hasSignal
      ? 'Reply to them from your own inbox — a founder reply beats any automated flow.'
      : 'No reason captured. Worth a short "what made you leave?" note; those replies are how the survey gets better.',
  ].join('\n');

  // The comment gets a pull-quote because it is the highest-value string in the
  // whole email — the one thing that tells you what to actually build or say.
  const commentHtml = alert.comment
    ? `<blockquote style="margin: 0 0 18px; padding: 14px 16px; background: #fff8e1; border-left: 3px solid #f5b400; font-size: 15px; line-height: 1.5; color: #1a1a1a;">&ldquo;${escapeHtml(alert.comment)}&rdquo;</blockquote>`
    : `<p style="margin: 0 0 18px; padding: 14px 16px; background: #f5f5f5; border-left: 3px solid #ccc; font-size: 14px; color: #666;">They typed nothing &mdash; only the survey reason above.</p>`;

  const factsHtml = alert.facts
    .map(
      (f) =>
        `<tr>
           <td style="padding: 5px 14px 5px 0; color: #777; font-size: 13px; white-space: nowrap; vertical-align: top;">${escapeHtml(f.label)}</td>
           <td style="padding: 5px 0; color: #1a1a1a; font-size: 13px; vertical-align: top;">${escapeHtml(f.value)}</td>
         </tr>`,
    )
    .join('');

  const commandsHtml = alert.commands
    .map(
      (c) =>
        `<div style="font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12.5px; background: #f5f5f5; padding: 7px 10px; border-radius: 6px; margin: 0 0 6px; color: #1a1a1a;">${escapeHtml(c)}</div>`,
    )
    .join('');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 620px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <div style="display: inline-block; font-size: 11px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 4px 9px; border-radius: 5px; margin-bottom: 12px; ${
        pending ? 'background: #fff8e1; color: #8a6100;' : 'background: #f1f1f1; color: #666;'
      }">${pending ? 'Cancelled &mdash; still has access' : 'Subscription ended'}</div>
      <h1 style="font-size: 19px; margin: 0 0 4px;">${escapeHtml(alert.email)}</h1>
      <p style="margin: 0 0 4px; color: #444; font-size: 14px;">${escapeHtml(alert.reasonLabel)} &middot; after ${escapeHtml(alert.tenure)}</p>
      ${
        alert.saveWindowNote
          ? `<p style="margin: 0 0 18px; color: #8a6100; font-size: 13px; font-weight: 600;">${escapeHtml(alert.saveWindowNote)}</p>`
          : '<div style="height: 14px;"></div>'
      }
      ${commentHtml}
      <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #777; margin: 22px 0 6px;">Member</h2>
      <table style="border-collapse: collapse; width: 100%;">${factsHtml}</table>
      <h2 style="font-size: 13px; text-transform: uppercase; letter-spacing: 0.05em; color: #777; margin: 22px 0 8px;">Next</h2>
      ${commandsHtml}
      <p style="margin: 18px 0 0; font-size: 13px; color: #444;">${
        alert.hasSignal
          ? 'Reply from your own inbox &mdash; a founder reply beats any automated flow.'
          : 'No reason captured. Worth a short &ldquo;what made you leave?&rdquo; note; those replies are how the survey gets better.'
      }</p>
      <p style="margin: 20px 0 0; font-size: 12px; color: #999; border-top: 1px solid #eee; padding-top: 12px;">
        <a href="${escapeHtml(adminUrl)}" style="color: #999;">Admin dashboard</a>
        &middot; sent by <code style="font-size: 11.5px;">make cancellation-alerts</code>
      </p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject: alert.subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Weekly review digest to the founder (scripts/send-winback.mts --digest). It
// lists exactly who the win-back WOULD go to this run and embeds the rendered
// draft, but sends nothing to those users — the actual send is a separate,
// deliberate `make winback YES=1`. This is the "email me the draft + the list
// it will be sent to before it goes" step.
export async function sendWinbackDigestEmail(
  to: string,
  opts: {
    recipients: string[];
    mode: 'auto' | 'promo' | 'manual';
    sendCommand: string;
    draft: { subject: string; text: string; html: string };
  },
) {
  const { recipients, mode, sendCommand, draft } = opts;
  const count = recipients.length;
  const subject = `[ZeroGEX] Win-back review — ${count} churned member${count === 1 ? '' : 's'} ready (${mode})`;

  const listText = recipients.length > 0 ? recipients.map((e) => `  - ${e}`).join('\n') : '  (none)';
  const text = [
    `${count} churned member${count === 1 ? '' : 's'} are eligible for the win-back email this week.`,
    `Discount variant: ${mode}.`,
    '',
    'Nothing has been sent yet. To send to everyone below, run:',
    `  ${sendCommand}`,
    '',
    `Recipients (${count}):`,
    listText,
    '',
    '======================================================',
    'DRAFT that will be sent (subject + body):',
    `Subject: ${draft.subject}`,
    '======================================================',
    '',
    draft.text,
  ].join('\n');

  const safeList =
    recipients.length > 0
      ? recipients.map((e) => `<li style="margin:2px 0;">${escapeHtml(e)}</li>`).join('')
      : '<li style="margin:2px 0; color:#999;">(none)</li>';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <h1 style="font-size: 18px; margin: 0 0 6px;">Win-back review — ${count} eligible</h1>
      <p style="margin: 0 0 4px; color: #444;">Discount variant: <strong>${escapeHtml(mode)}</strong>. Nothing has been sent yet.</p>
      <p style="margin: 0 0 16px; color: #444;">To send to everyone listed, run:<br>
        <code style="display:inline-block; margin-top:6px; background:#f5f5f5; padding:6px 10px; border-radius:6px; font-size:13px;">${escapeHtml(sendCommand)}</code>
      </p>
      <h2 style="font-size: 14px; margin: 18px 0 6px;">Recipients (${count})</h2>
      <ul style="padding-left: 18px; margin: 0 0 20px; font-size: 13px; color: #333;">${safeList}</ul>
      <div style="border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden;">
        <div style="background: #f5b400; color: #000; font-weight: 700; font-size: 13px; padding: 8px 12px;">
          DRAFT PREVIEW &mdash; Subject: ${escapeHtml(draft.subject)}
        </div>
        <div style="padding: 4px 8px;">${draft.html}</div>
      </div>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Founder-voice nudge to a user who signed up + verified their email but never
// opened checkout. Fired ~2h after signup by scripts/send-verified-never-paid.mts.
// One-shot per account (idempotency latch on users.verified_never_paid_email_sent_at).
// Deliberately no discount — the pitch is that the free trial removes the
// financial risk, so a coupon would just muddy the ask.
export async function sendVerifiedNeverPaidEmail(to: string) {
  const subject = 'Quick note from Michael at ZeroGEX';
  // Land them on the trial-continuation pricing hero ("You're almost done…")
  // rather than the generic pricing intro, so the email and the page tell one
  // consistent "start your trial" story.
  const pricingUrl = `${getAppUrl()}/pricing?trial=1`;
  const safePricingUrl = escapeHtml(pricingUrl);

  const text = [
    'Hello,',
    '',
    "I'm Michael, the founder of ZeroGEX. I noticed you signed up for an account but haven't tried the full product yet — wanted to reach out personally rather than route you through a generic marketing flow.",
    '',
    "If you've been weighing the one week free trial: it's 7 days of full access, your card is on file but won't be charged until day 8, and we send a heads-up email 48 hours before the first payment so the conversion is never a surprise. If within the 7 days you find it is not the right fit, you can cancel in one click on the billing portal and you won't be charged.",
    '',
    "If you have a question, a hesitation, or feedback on what's missing — just hit reply. I read every message myself, and customer notes are a big part of how I decide what to build next.",
    '',
    "If you're ready to start the trial:",
    pricingUrl,
    '',
    'Either way, thanks for giving ZeroGEX a look.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>I'm Michael, the founder of ZeroGEX. I noticed you signed up for an account but haven't tried the full product yet &mdash; wanted to reach out personally rather than route you through a generic marketing flow.</p>
      <p>If you've been weighing the one week free trial: it's 7 days of full access, your card is on file but won't be charged until day 8, and we send a heads-up email 48 hours before the first payment so the conversion is never a surprise. If within the 7 days you find it is not the right fit, you can cancel in one click on the billing portal and you won't be charged.</p>
      <p>If you have a question, a hesitation, or feedback on what's missing &mdash; just hit reply. I read every message myself, and customer notes are a big part of how I decide what to build next.</p>
      <p style="margin: 24px 0;">
        <a href="${safePricingUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Start the free trial</a>
      </p>
      <p>Either way, thanks for giving ZeroGEX a look.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Second-touch reactivation email for a verified-never-paid signup who ignored
// the first ~2h nudge (sendVerifiedNeverPaidEmail). Fired ~3 weeks later by
// scripts/send-reactivation.mts. One-shot per account (latch on
// users.reactivation_email_sent_at). This is the inactive-signup analogue of the
// churned win-back: the first touch pitched the standard 7-day trial and didn't
// convert, so this one CHANGES the offer to an extended trial (`trialDays`,
// granted server-side at checkout for the ?reactivate=1 arrival) — the longer
// trial is the incentive, so there is deliberately no discount to muddy it.
//
// Unlike the transactional lifecycle nudges, this is a re-engagement send to
// someone who already passed once, so it carries a real marketing-unsubscribe
// affordance: a footer opt-out link plus the one-click List-Unsubscribe header
// (RFC 8058). `unsubUrl` is the signed per-user link the caller builds via
// core/unsubToken.ts buildUnsubUrl(); the sender excludes anyone already
// opted out before we ever get here.
export type ReactivationEmailOptions = { trialDays: number; unsubUrl: string };

// Pure render — no network. Returns subject + text + html so the same content
// can be delivered to a cold signup (sendReactivationEmail) or embedded in the
// founder's pre-send review digest (sendReactivationDigestEmail) without drift.
// Mirrors renderWinbackEmail.
export function renderReactivationEmail(opts: ReactivationEmailOptions): {
  subject: string;
  text: string;
  html: string;
} {
  const trialDays = Math.max(1, Math.floor(opts.trialDays));
  const chargeDay = trialDays + 1;
  const ctaHref = `${getAppUrl()}/pricing?trial=1&reactivate=1`;
  const safeCtaHref = escapeHtml(ctaHref);
  const safeUnsub = escapeHtml(opts.unsubUrl);

  const subject = `I extended your ZeroGEX free trial to ${trialDays} days`;

  const text = [
    'Hello,',
    '',
    "It's Michael, the founder of ZeroGEX. A little while back you created an account but never started the trial — no worries, life gets busy. I'm reaching out one more time because I don't think 7 days was a fair test, and I'd rather fix that than lose you over it.",
    '',
    `So I've set your trial to a full ${trialDays} days.`,
    '',
    'Same full access — every gamma level, the daily Read that tells you in plain English whether SPX is pinned, squeezing, or set to break before the open, the live flow, the backtester, and the TradeWorkz bots with their fully public trade audit — just a lot more room to see whether it earns a place in your routine.',
    '',
    'How the trial works, so nothing catches you off guard:',
    `  • ${trialDays} days of full access, starting the moment you activate.`,
    `  • Your card is on file but is NOT charged until day ${chargeDay}.`,
    '  • We email you 48 hours before that first charge — it is never a surprise.',
    "  • If it's not for you, one click in the billing portal cancels it and you won't be charged a cent.",
    '',
    `Start your ${trialDays}-day trial: ${ctaHref}`,
    '',
    "And if something specific held you back — a missing feature, a question, price, or it just wasn't the right week — hit reply and tell me. I read every message myself, and it genuinely shapes what I build next.",
    '',
    'Either way, thanks for giving ZeroGEX a look.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
    '',
    '---',
    'You are receiving this because you created a ZeroGEX account.',
    `Unsubscribe from these emails: ${opts.unsubUrl}`,
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.55;">
      <p>Hello,</p>
      <p>It's Michael, the founder of ZeroGEX. A little while back you created an account but never started the trial &mdash; no worries, life gets busy. I'm reaching out one more time because I don't think 7 days was a fair test, and I'd rather fix that than lose you over it.</p>
      <p style="background: #fff8e1; border-left: 3px solid #f5b400; padding: 12px 14px; margin: 20px 0; font-size: 17px;">So I've set your trial to a full <strong>${trialDays} days</strong>.</p>
      <p>Same full access &mdash; every gamma level, the daily Read that tells you in plain English whether SPX is pinned, squeezing, or set to break before the open, the live flow, the backtester, and the TradeWorkz&trade; bots with their fully public trade audit &mdash; just a lot more room to see whether it earns a place in your routine.</p>
      <p style="margin: 16px 0 4px;">How the trial works, so nothing catches you off guard:</p>
      <ul style="padding-left: 20px; margin: 4px 0 16px;">
        <li style="margin: 0 0 8px;"><strong>${trialDays} days</strong> of full access, starting the moment you activate.</li>
        <li style="margin: 0 0 8px;">Your card is on file but is <strong>not charged until day ${chargeDay}</strong>.</li>
        <li style="margin: 0 0 8px;">We email you <strong>48 hours before</strong> that first charge &mdash; it is never a surprise.</li>
        <li style="margin: 0 0 8px;">If it's not for you, <strong>one click</strong> in the billing portal cancels it and you won't be charged a cent.</li>
      </ul>
      <p style="margin: 24px 0;">
        <a href="${safeCtaHref}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Start my ${trialDays}-day trial</a>
      </p>
      <p>And if something specific held you back &mdash; a missing feature, a question, price, or it just wasn't the right week &mdash; hit reply and tell me. I read every message myself, and it genuinely shapes what I build next.</p>
      <p>Either way, thanks for giving ZeroGEX a look.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
      <p style="margin: 28px 0 0; padding-top: 14px; border-top: 1px solid #e8e8e8; font-size: 12px; color: #8a8a8a; line-height: 1.5;">
        You're receiving this because you created a ZeroGEX account.
        <a href="${safeUnsub}" style="color: #8a8a8a; text-decoration: underline;">Unsubscribe from these emails</a>.
      </p>
    </div>
  `.trim();

  return { subject, text, html };
}

export async function sendReactivationEmail(to: string, opts: ReactivationEmailOptions) {
  const { subject, text, html } = renderReactivationEmail(opts);

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
    // One-click unsubscribe (RFC 8058) — this is a re-engagement send, so make
    // opting out a single tap for the recipient and the mailbox provider alike.
    headers: {
      'List-Unsubscribe': `<${opts.unsubUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Pre-send review digest to the founder (scripts/send-reactivation.mts
// --digest). Lists exactly who the reactivation email WOULD go to this run and
// embeds the rendered draft, but sends nothing to those users — the real send is
// a separate, deliberate `make reactivation YES=1`. Mirrors sendWinbackDigestEmail.
export async function sendReactivationDigestEmail(
  to: string,
  opts: {
    recipients: string[];
    sendCommand: string;
    trialDays: number;
    draft: { subject: string; text: string; html: string };
  },
) {
  const { recipients, sendCommand, trialDays, draft } = opts;
  const count = recipients.length;
  const subject = `[ZeroGEX] Reactivation review — ${count} cold signup${count === 1 ? '' : 's'} ready (${trialDays}-day trial)`;

  const listText =
    recipients.length > 0 ? recipients.map((e) => `  - ${e}`).join('\n') : '  (none)';
  const text = [
    `${count} cold verified-never-paid signup${count === 1 ? '' : 's'} are eligible for the reactivation email this run.`,
    `Offer: extended ${trialDays}-day free trial.`,
    '',
    'Nothing has been sent yet. To send to everyone below, run:',
    `  ${sendCommand}`,
    '',
    `Recipients (${count}):`,
    listText,
    '',
    '======================================================',
    'DRAFT that will be sent (subject + body):',
    `Subject: ${draft.subject}`,
    '======================================================',
    '',
    draft.text,
  ].join('\n');

  const safeList =
    recipients.length > 0
      ? recipients.map((e) => `<li style="margin:2px 0;">${escapeHtml(e)}</li>`).join('')
      : '<li style="margin:2px 0; color:#999;">(none)</li>';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 640px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <h1 style="font-size: 18px; margin: 0 0 6px;">Reactivation review &mdash; ${count} eligible</h1>
      <p style="margin: 0 0 4px; color: #444;">Offer: extended <strong>${trialDays}-day</strong> free trial. Nothing has been sent yet.</p>
      <p style="margin: 0 0 16px; color: #444;">To send to everyone listed, run:<br>
        <code style="display:inline-block; margin-top:6px; background:#f5f5f5; padding:6px 10px; border-radius:6px; font-size:13px;">${escapeHtml(sendCommand)}</code>
      </p>
      <h2 style="font-size: 14px; margin: 18px 0 6px;">Recipients (${count})</h2>
      <ul style="padding-left: 18px; margin: 0 0 20px; font-size: 13px; color: #333;">${safeList}</ul>
      <div style="border: 1px solid #e5e5e5; border-radius: 10px; overflow: hidden;">
        <div style="background: #f5b400; color: #000; font-weight: 700; font-size: 13px; padding: 8px 12px;">
          DRAFT PREVIEW &mdash; Subject: ${escapeHtml(draft.subject)}
        </div>
        <div style="padding: 4px 8px;">${draft.html}</div>
      </div>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

// Nudge for a user who registered but never clicked the verification link.
// Copy is deliberately about VERIFICATION, not a discount or a hard trial
// pitch: an unverified account is procedurally blocked from checkout (see
// app/api/billing/checkout/route.ts), so the single next step that unlocks
// everything — including the free trial — is confirming the email. `verifyUrl`
// is a freshly-minted, 24h single-use verify link (the original signup token
// has almost certainly expired by the time this fires). Sent at most once per
// account; see scripts/send-verify-reminders.mts.
export async function sendVerifyReminderEmail(to: string, verifyUrl: string) {
  const safeLink = escapeHtml(verifyUrl);
  const subject = 'Finish setting up your ZeroGEX account';

  const text = [
    'Hello,',
    '',
    "I'm Michael, the founder of ZeroGEX. You created an account but the email address was never confirmed, so the account is still only half-set-up — and right now that's the one thing standing between you and the product.",
    '',
    'Confirming your email unlocks everything, including the 7-day free trial: 7 days of full access, card on file but not charged until day 8, a heads-up email 48 hours before the first payment, and one-click cancel any time inside the trial.',
    '',
    'Confirm your email with this link (it expires in 24 hours):',
    verifyUrl,
    '',
    "If you didn't create a ZeroGEX account, you can safely ignore this — nothing further will happen. And if something went wrong or you have a question, just hit reply; I read every message myself.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>I'm Michael, the founder of ZeroGEX. You created an account but the email address was never confirmed, so the account is still only half-set-up &mdash; and right now that's the one thing standing between you and the product.</p>
      <p>Confirming your email unlocks everything, including the 7-day free trial: 7 days of full access, card on file but not charged until day 8, a heads-up email 48 hours before the first payment, and one-click cancel any time inside the trial.</p>
      <p style="margin: 24px 0;">
        <a href="${safeLink}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Confirm email &amp; unlock the trial</a>
      </p>
      <p style="font-size: 13px; color: #555;">Or copy this URL into your browser:<br><span style="word-break: break-all;">${safeLink}</span></p>
      <p style="font-size: 13px; color: #555;">This link expires in 24 hours.</p>
      <p>If you didn't create a ZeroGEX account, you can safely ignore this &mdash; nothing further will happen. And if something went wrong or you have a question, just hit reply; I read every message myself.</p>
      <p>Best,<br>Michael<br>Founder, ZeroGEX</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

export async function sendPasswordResetEmail(to: string, link: string) {
  const safeLink = escapeHtml(link);
  const subject = 'Reset your ZeroGEX password';
  const text = [
    'Someone requested a password reset for your ZeroGEX account.',
    '',
    'If that was you, open this link to set a new password:',
    link,
    '',
    'This link expires in 30 minutes and can only be used once.',
    '',
    "If you didn't request this, you can safely ignore this email — your password will not change.",
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">Reset your ZeroGEX password</h1>
      <p>Someone requested a password reset for your ZeroGEX account.</p>
      <p>If that was you, click the button below to set a new password:</p>
      <p style="margin: 24px 0;">
        <a href="${safeLink}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Reset password</a>
      </p>
      <p style="font-size: 13px; color: #555;">Or copy this URL into your browser:<br><span style="word-break: break-all;">${safeLink}</span></p>
      <p style="font-size: 13px; color: #555;">This link expires in 30 minutes and can only be used once.</p>
      <p style="font-size: 13px; color: #555;">If you didn't request this, you can safely ignore this email — your password will not change.</p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text,
    html,
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}

/**
 * Notification email for a TradeWorkz bot entering or exiting a position.
 *
 * Called by scripts/tradeworkz-notify-deliver.mts once per queued
 * ``tw_notifications_log`` row with ``channel='email'``. The payload
 * shape mirrors what the reconciler writes on entry / exit — see
 * src/tradeworkz/reconciler.py. The email is intentionally short —
 * followers ask for an alert, not a novel — and links back to
 * /trading-signals for the full drilldown.
 */
export type TradeworkzEventType = 'entry' | 'exit' | 'add' | 'cut' | 'stopped' | 'target';

export interface TradeworkzEmailPayload {
  underlying?: string;
  direction?: 'bullish' | 'bearish' | string;
  strategy_type?: string;
  outcome?: 'win' | 'loss' | 'scratch' | string;
  realized_pnl?: number;
  pnl_percent?: number;
  reason?: string;
  contracts?: number;
  entry_price?: number;
  exit_price?: number;
  target_price?: number;
  stop_price?: number;
  conviction?: number;
  rationale?: string;
}

function tw_fmtMoneySigned(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  const abs = Math.abs(v);
  const sign = v < 0 ? '-' : '+';
  // Promote to M once the rounded K representation would hit 1000.00
  // — same rounding-boundary rule as fmtMoney in app/trading-signals/
  // format.ts, so a $999,999.99 amount reads "$1.00M" instead of the
  // visually-indistinguishable "$1000.00K".
  if (abs >= 999_995) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(2)}K`;
  return `${sign}$${abs.toFixed(2)}`;
}

function tw_fmtPct(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  return `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`;
}

function tw_fmtPrice(v: number | undefined | null): string {
  if (v === undefined || v === null || !Number.isFinite(v)) return '—';
  return `$${v.toFixed(2)}`;
}

function tw_outcomeChip(outcome: string | undefined): { label: string; color: string; bg: string } {
  if (outcome === 'win') return { label: 'WIN', color: '#0F7A3A', bg: '#DBF3E4' };
  if (outcome === 'loss') return { label: 'LOSS', color: '#A31226', bg: '#FBE1E5' };
  return { label: 'SCRATCH', color: '#374151', bg: '#E5E7EB' };
}

export async function sendTradeworkzNotification(
  to: string,
  args: {
    botId: string;
    botDisplayName: string;
    eventType: TradeworkzEventType | string;
    payload: TradeworkzEmailPayload;
    dashboardUrl?: string;
  },
) {
  const { botDisplayName, eventType, payload } = args;
  const dashboardUrl = args.dashboardUrl ?? `${getAppUrl()}/trading-signals`;
  const isExit = eventType === 'exit' || eventType === 'stopped' || eventType === 'target';
  const isEntry = eventType === 'entry';
  const dirText =
    payload.direction === 'bullish'
      ? 'LONG'
      : payload.direction === 'bearish'
        ? 'SHORT'
        : (payload.direction || 'NEUTRAL').toUpperCase();
  const underlying = payload.underlying ?? 'SPY';

  const subject = isExit
    ? `${botDisplayName} closed ${dirText} ${underlying} ${tw_fmtMoneySigned(payload.realized_pnl ?? null)} (${tw_fmtPct(payload.pnl_percent ?? null)})`
    : isEntry
      ? `${botDisplayName} opened ${dirText} ${underlying} · ${payload.contracts ?? '?'} contracts @ ${tw_fmtPrice(payload.entry_price ?? null)}`
      : `${botDisplayName} — ${eventType.toUpperCase()} on ${underlying}`;

  const textLines: string[] = [];
  textLines.push(`${botDisplayName} · ${eventType.toUpperCase()}`);
  textLines.push('');
  textLines.push(`Underlying: ${underlying}`);
  textLines.push(`Direction: ${dirText}`);
  if (payload.strategy_type) textLines.push(`Structure: ${payload.strategy_type}`);
  if (payload.contracts !== undefined) textLines.push(`Contracts: ${payload.contracts}`);
  if (isEntry) {
    if (payload.entry_price !== undefined) textLines.push(`Entry: ${tw_fmtPrice(payload.entry_price)}`);
    if (payload.target_price !== undefined) textLines.push(`Target: ${tw_fmtPrice(payload.target_price)}`);
    if (payload.stop_price !== undefined) textLines.push(`Stop: ${tw_fmtPrice(payload.stop_price)}`);
    if (payload.conviction !== undefined) textLines.push(`Conviction: ${(payload.conviction * 100).toFixed(0)}%`);
  }
  if (isExit) {
    if (payload.entry_price !== undefined) textLines.push(`Entry: ${tw_fmtPrice(payload.entry_price)}`);
    if (payload.exit_price !== undefined) textLines.push(`Exit: ${tw_fmtPrice(payload.exit_price)}`);
    textLines.push(`P&L: ${tw_fmtMoneySigned(payload.realized_pnl ?? null)} (${tw_fmtPct(payload.pnl_percent ?? null)})`);
    if (payload.outcome) textLines.push(`Outcome: ${payload.outcome.toUpperCase()}`);
    if (payload.reason) textLines.push(`Reason: ${payload.reason}`);
  }
  if (payload.rationale) {
    textLines.push('');
    textLines.push(payload.rationale);
  }
  textLines.push('');
  textLines.push(`Open the dashboard: ${dashboardUrl}`);
  textLines.push('');
  textLines.push('You are receiving this because you followed this bot on TradeWorkz™. Manage or unfollow from the dashboard.');

  const outcome = tw_outcomeChip(payload.outcome);
  const safeUrl = escapeHtml(dashboardUrl);
  const safeBotName = escapeHtml(botDisplayName);
  const safeReason = payload.reason ? escapeHtml(payload.reason) : null;
  const safeStrategy = payload.strategy_type ? escapeHtml(payload.strategy_type) : null;
  const safeRationale = payload.rationale ? escapeHtml(payload.rationale) : null;
  const headline = isExit
    ? `${safeBotName} closed a ${dirText} ${escapeHtml(underlying)} trade`
    : isEntry
      ? `${safeBotName} opened a ${dirText} ${escapeHtml(underlying)} trade`
      : `${safeBotName} — ${eventType.toUpperCase()} on ${escapeHtml(underlying)}`;
  const headerColor = isExit && payload.outcome
    ? payload.outcome === 'win' ? '#0F7A3A' : payload.outcome === 'loss' ? '#A31226' : '#374151'
    : '#003F5C';

  const rows: Array<{ label: string; value: string; tone?: string }> = [];
  if (payload.strategy_type) rows.push({ label: 'Structure', value: safeStrategy! });
  if (payload.contracts !== undefined) rows.push({ label: 'Contracts', value: String(payload.contracts) });
  if (isEntry) {
    if (payload.entry_price !== undefined) rows.push({ label: 'Entry', value: tw_fmtPrice(payload.entry_price) });
    if (payload.target_price !== undefined) rows.push({ label: 'Target', value: tw_fmtPrice(payload.target_price) });
    if (payload.stop_price !== undefined) rows.push({ label: 'Stop', value: tw_fmtPrice(payload.stop_price) });
    if (payload.conviction !== undefined) rows.push({ label: 'Conviction', value: `${(payload.conviction * 100).toFixed(0)}%` });
  } else if (isExit) {
    if (payload.entry_price !== undefined) rows.push({ label: 'Entry', value: tw_fmtPrice(payload.entry_price) });
    if (payload.exit_price !== undefined) rows.push({ label: 'Exit', value: tw_fmtPrice(payload.exit_price) });
    rows.push({
      label: 'Realized P&L',
      value: `${tw_fmtMoneySigned(payload.realized_pnl ?? null)} (${tw_fmtPct(payload.pnl_percent ?? null)})`,
      tone: (payload.realized_pnl ?? 0) >= 0 ? '#0F7A3A' : '#A31226',
    });
    if (safeReason) rows.push({ label: 'Reason', value: safeReason });
  }

  const rowsHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:6px 0; color:#6b7280; font-size:13px; width:120px;">${r.label}</td>
          <td style="padding:6px 0; color:${r.tone ?? '#111827'}; font-size:13px; font-weight:500; text-align:right; font-variant-numeric: tabular-nums;">${r.value}</td>
        </tr>`,
    )
    .join('');

  const outcomeBadge = isExit && payload.outcome
    ? `<span style="display:inline-block; margin-left:8px; padding:2px 8px; border-radius:9999px; background:${outcome.bg}; color:${outcome.color}; font-size:11px; font-weight:600; letter-spacing:0.03em;">${outcome.label}</span>`
    : '';

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <div style="border-top: 3px solid ${headerColor}; padding-top: 20px;">
        <div style="font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; color: #6b7280; margin-bottom: 6px;">
          TradeWorkz&trade; ${eventType.toUpperCase()}${outcomeBadge}
        </div>
        <h1 style="font-size: 18px; font-weight: 600; color: #111827; margin: 0 0 16px;">${headline}</h1>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">${rowsHtml}</table>
        ${safeRationale ? `<p style="font-size: 13px; color: #4b5563; border-left: 3px solid #e5e7eb; padding-left: 10px; margin: 16px 0;">${safeRationale}</p>` : ''}
        <p style="margin: 24px 0;">
          <a href="${safeUrl}" style="display: inline-block; padding: 10px 18px; background: ${headerColor}; color: #ffffff; font-weight: 600; text-decoration: none; border-radius: 8px; font-size: 14px;">Open dashboard</a>
        </p>
      </div>
      <p style="font-size: 11px; color: #9ca3af; margin-top: 32px; line-height: 1.5;">
        You are receiving this because you followed ${safeBotName} on TradeWorkz&trade;. Manage channels or unfollow from the bot card on the dashboard.
      </p>
    </div>
  `.trim();

  const client = getClient();
  const result = await client.emails.send({
    from: getFromAddress(),
    to,
    subject,
    text: textLines.join('\n'),
    html,
  });
  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }
}
