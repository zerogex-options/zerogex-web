import { Resend } from 'resend';

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
