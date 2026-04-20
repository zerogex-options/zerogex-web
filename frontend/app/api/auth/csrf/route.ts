import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { issueCsrfCookie } from '@/core/serverAuth';

export async function GET() {
  const token = randomBytes(24).toString('hex');
  const response = NextResponse.json({ csrfToken: token });
  issueCsrfCookie(response, token);
  return response;
}
