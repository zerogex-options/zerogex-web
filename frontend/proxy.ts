import { NextRequest, NextResponse } from 'next/server';
import { hasTierAccess, isPublicRoute, requiredTierForRoute } from '@/core/auth';
import { getSessionFromRequest } from '@/core/serverAuth';

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SESSION_COOKIE_MAX_AGE_SECONDS = readPositiveInt('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 14);

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === '1';

  if (!authEnabled) {
    if (pathname.startsWith('/api/auth/')) {
      return new NextResponse(null, { status: 404 });
    }

    if (pathname === '/login' || pathname === '/register') {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      url.search = '';
      return NextResponse.redirect(url);
    }

    return NextResponse.next();
  }

  if (pathname.startsWith('/_next') || pathname.startsWith('/api') || pathname.includes('.')) {
    return NextResponse.next();
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  const requiredTier = requiredTierForRoute(pathname);
  if (!requiredTier) {
    return NextResponse.next();
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (!hasTierAccess(session.user.tier, requiredTier)) {
    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('required', requiredTier ?? 'basic');
    unauthorizedUrl.searchParams.set('current', session.user.tier);
    unauthorizedUrl.searchParams.set('path', pathname);
    return NextResponse.redirect(unauthorizedUrl);
  }

  const response = NextResponse.next();
  if (session.rotatedToken) {
    response.cookies.set({
      name: 'zgx_session',
      value: session.rotatedToken,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)'],
};
