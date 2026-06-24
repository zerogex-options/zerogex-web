import { NextResponse } from 'next/server';
import { getGivingTotals } from '@/core/giving';

export const dynamic = 'force-static';

export async function GET() {
  const response = NextResponse.json(getGivingTotals());
  response.headers.set('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  return response;
}
