import { Resend } from 'resend';

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
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px;">
      <h1 style="font-size: 20px; margin: 0 0 16px;">🎉 You earned a free month</h1>
      <p>Someone you referred just subscribed to ZeroGEX. ${escapeHtml(rewardSentence)}</p>
      <p style="margin: 24px 0;">
        <a href="${safeLink}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">View your referrals</a>
      </p>
      <p style="font-size: 13px; color: #555;">Thanks for spreading the word.</p>
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
  const subject = trialEndDate
    ? 'Welcome to ZeroGEX — your free trial has started'
    : 'Thank you for subscribing to ZeroGEX!';

  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);
  const trialLineText = trialEndDate
    ? `Your 7-day free trial is now active — you have full access right away, and you won't be charged until ${trialEndDate}. Cancel anytime before then from the billing portal on your account page (${accountUrl}) and you won't be billed a cent.`
    : null;
  const trialLineHtml = trialEndDate
    ? `Your 7-day free trial is now active &mdash; you have full access right away, and you won't be charged until ${escapeHtml(trialEndDate)}. Cancel anytime before then from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a> and you won't be billed a cent.`
    : null;
  const promoLineText = promoLabel
    ? `You're on our limited-time introductory rate for the ${promoLabel} — it's already attached to your subscription. After that period your plan renews automatically at our standard rate.`
    : null;
  const promoLineHtml = promoLabel
    ? `You're on our <strong>limited-time introductory rate</strong> for the ${escapeHtml(promoLabel)} &mdash; it's already attached to your subscription. After that period your plan renews automatically at our standard rate.`
    : null;

  const text = [
    'Hello,',
    '',
    ...(trialLineText ? [trialLineText, ''] : []),
    ...(promoLineText ? [promoLineText, ''] : []),
    'I just wanted to personally thank you for subscribing to ZeroGEX.',
    '',
    "It genuinely means a lot to have your support this early. ZeroGEX is still growing quickly, and early paid users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders.",
    '',
    "Please feel free to reach out to me directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.",
    '',
    'Thanks again — I really appreciate your support.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      ${trialLineHtml ? `<p>${trialLineHtml}</p>` : ''}
      ${promoLineHtml ? `<p>${promoLineHtml}</p>` : ''}
      <p>I just wanted to personally thank you for subscribing to ZeroGEX.</p>
      <p>It genuinely means a lot to have your support this early. ZeroGEX is still growing quickly, and early paid users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders.</p>
      <p>Please feel free to reach out to me directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.</p>
      <p>Thanks again &mdash; I really appreciate your support.</p>
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
    "Please feel free to reach out to me directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.",
    '',
    'Thanks again — I really appreciate your support.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      ${trialLineHtml ? `<p>${trialLineHtml}</p>` : ''}
      <p>I just wanted to personally thank you for subscribing to ZeroGEX.</p>
      <p>It genuinely means a lot to have your support this early. ZeroGEX is still growing quickly, and early paid users like you help make it possible for me to keep improving the platform, adding features, and making the data more useful for active traders. As a Founding Member your rate is locked in for the first year, and the 25% lifetime discount applies automatically after that.</p>
      <p>Please feel free to reach out to me directly if you run into anything, have questions, or see something that could be improved. I read every message, and customer feedback is a huge part of how I'm shaping the product.</p>
      <p>Thanks again &mdash; I really appreciate your support.</p>
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

// Nudge sent ~48h before a free trial converts to a paid charge. The intent
// is courteous, not promotional — give the user a heads-up so they have time
// to cancel cleanly if the service isn't a fit, which cuts the refund-request
// load and the chargeback risk that follow surprise auto-conversions. Sent
// at most once per trial window (latched by users.trial_reminder_email_sent_at,
// which the webhook clears whenever a new 'trialing' state begins).
export async function sendTrialReminderEmail(
  to: string,
  opts: {
    trialEndIso: string;
    // When the underlying subscription is on the limited-time public promo,
    // the cron job passes a short label like "first 6 months" so the reminder
    // mentions the introductory rate that will kick in after the trial ends.
    promoIntroLabel?: string | null;
  },
) {
  const trialEndDate = formatTrialEndDate(opts.trialEndIso);
  const promoLabel = opts.promoIntroLabel ?? null;
  const subject = 'Your ZeroGEX free trial ends in 2 days';

  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);

  const promoLineText = promoLabel
    ? `Good news on the price: you locked in our limited-time introductory rate for the ${promoLabel}, so that's what your card will be charged after the trial — not the standard rate.`
    : null;
  const promoLineHtml = promoLabel
    ? `Good news on the price: you locked in our <strong>limited-time introductory rate</strong> for the ${escapeHtml(promoLabel)}, so that's what your card will be charged after the trial &mdash; not the standard rate.`
    : null;

  const text = [
    'Hello,',
    '',
    `A quick heads-up: your ZeroGEX free trial ends on ${trialEndDate}, and your first payment will be charged then unless you cancel before that.`,
    '',
    ...(promoLineText ? [promoLineText, ''] : []),
    "If ZeroGEX is working for you, there's nothing you need to do — you'll keep full access and the renewal will go through automatically.",
    '',
    `If it isn't the right fit, you can cancel anytime from the billing portal on your account page (${accountUrl}) and you won't be charged a cent.`,
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
      <p>A quick heads-up: your ZeroGEX free trial ends on <strong>${escapeHtml(trialEndDate)}</strong>, and your first payment will be charged then unless you cancel before that.</p>
      ${promoLineHtml ? `<p>${promoLineHtml}</p>` : ''}
      <p>If ZeroGEX is working for you, there's nothing you need to do &mdash; you'll keep full access and the renewal will go through automatically.</p>
      <p>If it isn't the right fit, you can cancel anytime from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a> and you won't be charged a cent.</p>
      <p style="margin: 24px 0;">
        <a href="${safeAccountUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Manage subscription</a>
      </p>
      <p>Either way, thanks for giving ZeroGEX a try &mdash; if there's anything I can do to make it more useful for you, just reply to this email. I read every message.</p>
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
  },
) {
  const subject = `Final reminder: ZeroGEX founding rate closes tomorrow, ${opts.deadlineLabel}`;
  const safeFoundingUrl = escapeHtml(opts.foundingHref);
  const safeDeadline = escapeHtml(opts.deadlineLabel);

  const text = [
    'Hello,',
    '',
    `Just a final reminder that the ZeroGEX founding rate closes tomorrow, ${opts.deadlineLabel}.`,
    '',
    'I wanted to send one last note because you were part of the early ZeroGEX cohort, and I do not want anyone who intended to lock in the founding rate to miss the deadline.',
    '',
    "Here's the offer:",
    '',
    '  • Basic: $12/mo for the first year, normally $39/mo',
    '  • Pro: $19/mo for the first year, normally $59/mo',
    '  • After the first year, you keep 25% off standard pricing for as long as your subscription stays active',
    '  • No charge today. Your card will not be billed until July 1.',
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
        <li><strong>Basic:</strong> $12/mo for the first year, normally $39/mo</li>
        <li><strong>Pro:</strong> $19/mo for the first year, normally $59/mo</li>
        <li>After the first year, you keep <strong>25% off standard pricing</strong> for as long as your subscription stays active</li>
        <li><strong>No charge today.</strong> Your card will not be billed until July 1.</li>
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
  },
) {
  const founding = opts.foundingDeadlineLabel;
  // Promo only surfaces when founding isn't already in play for this user;
  // the two offers are mutually exclusive at checkout (founding wins) so the
  // email should match what they'd actually get back to.
  const promo = !founding ? opts.promoDeadlineLabel ?? null : null;

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
          `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way — but our limited-time introductory pricing is still live and closes ${promo}. Basic starts at $19/mo and Pro at $29/mo, with discounted annual plans too.`,
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
      ? `I noticed you started a ZeroGEX subscription recently but didn't finish. No pressure either way &mdash; but our <strong>limited-time introductory pricing</strong> is still live and closes <strong>${escapeHtml(promo)}</strong>. Basic starts at <strong>$19/mo</strong> and Pro at <strong>$29/mo</strong>, with discounted annual plans too.`
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
    "Please feel free to reach out to me directly if anything has changed about what you need, or if there's something we could improve. I read every message, and customer feedback is a huge part of how I'm shaping the product.",
    '',
    'Thanks again — I really appreciate your support.',
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>I just wanted to personally thank you for coming back to ZeroGEX &mdash; it really does mean a lot to have you here again.</p>
      <p>ZeroGEX has kept growing since you were last subscribed, and returning users like you help me keep building. Your full access has been restored, so you can jump straight back into the data.</p>
      <p>Please feel free to reach out to me directly if anything has changed about what you need, or if there's something we could improve. I read every message, and customer feedback is a huge part of how I'm shaping the product.</p>
      <p>Thanks again &mdash; I really appreciate your support.</p>
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

// Sent on the first failed renewal attempt for an invoice (gated by
// invoice.attempt_count === 1 in the webhook so it does not re-fire on each
// Stripe Smart Retry). Points the customer at the billing portal — logging
// in is the access path, since the portal session is created server-side
// against their authenticated account.
export async function sendPaymentFailedEmail(
  to: string,
  opts?: { amountFormatted?: string | null },
) {
  const subject = "We couldn't process your ZeroGEX payment";
  const accountUrl = `${getAppUrl()}/account`;
  const safeAccountUrl = escapeHtml(accountUrl);
  const amountSentence = opts?.amountFormatted
    ? `Your subscription payment of ${opts.amountFormatted} was declined by your card issuer.`
    : 'Your subscription payment was declined by your card issuer.';

  const text = [
    'Hello,',
    '',
    `${amountSentence} Stripe will automatically retry over the next few days, so if it was a temporary issue (insufficient funds, an expired card, etc.) it may go through on the next attempt with no action needed from you.`,
    '',
    "If you'd rather resolve it now, you can update your payment method anytime from the billing portal on your account page:",
    accountUrl,
    '',
    "If you have any questions, just reply to this email — I'm happy to help.",
    '',
    'Best,',
    'Michael',
    'Founder, ZeroGEX',
  ].join('\n');

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #1a1a1a; max-width: 560px; margin: 0 auto; padding: 24px; line-height: 1.5;">
      <p>Hello,</p>
      <p>${escapeHtml(amountSentence)} Stripe will automatically retry over the next few days, so if it was a temporary issue (insufficient funds, an expired card, etc.) it may go through on the next attempt with no action needed from you.</p>
      <p>If you'd rather resolve it now, you can update your payment method anytime from the billing portal on your <a href="${safeAccountUrl}" style="color: #f5b400; font-weight: 600;">account page</a>.</p>
      <p style="margin: 24px 0;">
        <a href="${safeAccountUrl}" style="display: inline-block; padding: 12px 20px; background: #f5b400; color: #000; font-weight: 600; text-decoration: none; border-radius: 8px;">Update payment method</a>
      </p>
      <p>If you have any questions, just reply to this email &mdash; I'm happy to help.</p>
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

// Sent when a customer clicks Cancel and Stripe flips cancel_at_period_end
// from false → true. They still have full access until periodEndIso — this
// is the retention window, not a farewell. Manual discount fulfillment
// (customer replies "discount", Michael sets it up) is intentional: reading
// the reply is worth more than automating the coupon.
export async function sendCancellationEmail(
  to: string,
  opts: { periodEndIso: string | null },
) {
  const subject = 'Sorry to see you go — mind sharing why?';
  const periodEndDate = opts.periodEndIso
    ? formatTrialEndDate(opts.periodEndIso)
    : 'the end of your current billing period';

  const text = [
    'Hello,',
    '',
    'I saw you just cancelled your ZeroGEX subscription — first, thank you. You\'ve been a real part of what I\'ve been building here, and I don\'t take that lightly.',
    '',
    `You still have full access until ${periodEndDate}, so nothing changes yet on your end. I just wanted to reach out personally before that day comes.`,
    '',
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

// Founder-voice nudge to a user who signed up + verified their email but never
// opened checkout. Fired ~2h after signup by scripts/send-verified-never-paid.mts.
// One-shot per account (idempotency latch on users.verified_never_paid_email_sent_at).
// Deliberately no discount — the pitch is that the free trial removes the
// financial risk, so a coupon would just muddy the ask.
export async function sendVerifiedNeverPaidEmail(to: string) {
  const subject = 'Quick note from Michael at ZeroGEX';
  const pricingUrl = `${getAppUrl()}/pricing`;
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
