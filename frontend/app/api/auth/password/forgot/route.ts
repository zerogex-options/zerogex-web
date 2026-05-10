import { NextRequest, NextResponse } from 'next/server';
import { requestPasswordReset, validateCsrf } from '@/core/serverAuth';
import { sendPasswordResetEmail } from '@/core/mailer';

const GENERIC_RESPONSE = {
  ok: true,
  message: 'If an account with that email exists, a password reset link has been sent.',
};

export async function POST(request: NextRequest) {
  if (!validateCsrf(request)) {
    return NextResponse.json({ error: 'Invalid CSRF token' }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as { email?: string };
  const email = body.email?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: 'Email is required' }, { status: 400 });
  }

  try {
    const result = await requestPasswordReset(request, email);
    if (result.status === 'issued') {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? new URL(request.url).origin;
      const link = `${baseUrl}/reset-password?token=${encodeURIComponent(result.token)}`;
      try {
        await sendPasswordResetEmail(result.email, link);
      } catch (err) {
        console.error('[password-reset] failed to send email:', err);
      }
    }
    return NextResponse.json(GENERIC_RESPONSE);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process request';
    return NextResponse.json({ error: message }, { status: 429 });
  }
}
