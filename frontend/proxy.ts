import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, hasTierAccess, isPublicRoute, requiredTierForRoute } from '@/core/auth';
import { getSessionFromRequest } from '@/core/serverAuth';
import { recordRequest, resolveUserIdFromCookie } from '@/core/monitoring';
import {
  ATTRIBUTION_COOKIE_NAME,
  mintAttributionId,
  setAttributionCookie,
} from '@/core/attribution';

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SESSION_COOKIE_MAX_AGE_SECONDS = readPositiveInt('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 14);

const STATIC_ASSET_EXT = /\.(?:css|js|map|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|eot|ico|txt|json|xml)$/i;

// Mint a fresh zgx_attr cookie on the first HTML request that lands
// without one. Guarded away from static asset requests, API calls, and
// Next internals so the cookie is only touched on real page navigations —
// keeps the middleware fast on the request paths that outnumber pages.
function attributionShouldTouch(pathname: string): boolean {
  if (pathname.startsWith('/_next')) return false;
  if (pathname.startsWith('/api/')) return false;
  if (STATIC_ASSET_EXT.test(pathname)) return false;
  return true;
}

function ensureAttributionCookie(request: NextRequest, response: NextResponse): void {
  if (!attributionShouldTouch(request.nextUrl.pathname)) return;
  if (request.cookies.get(ATTRIBUTION_COOKIE_NAME)?.value) return;
  setAttributionCookie(response, mintAttributionId());
}

function recordRequestForMonitoring(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/admin/monitoring') ||
      STATIC_ASSET_EXT.test(pathname)
    ) {
      return;
    }
    const isApi = pathname.startsWith('/api/');
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip')?.trim() ||
      null;
    const sessionToken = request.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
    const userId = sessionToken ? resolveUserIdFromCookie(sessionToken) : null;
    recordRequest({ isApi, userId, ip });
  } catch {
    // Monitoring must never break a request.
  }
}

export async function proxy(request: NextRequest) {
  const response = await proxyImpl(request);
  ensureAttributionCookie(request, response);
  return response;
}

async function proxyImpl(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  recordRequestForMonitoring(request);
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
    // Anonymous /dashboard visitors get the free public preview instead of
    // a /login wall — the 15-min-delayed gamma-levels page is the SEO-target
    // teaser that replaces the previously-open /dashboard preview. Subscribers
    // still land on the full live dashboard because they bypass this branch.
    if (pathname === '/dashboard') {
      const response = NextResponse.redirect(new URL('/spx-gamma-levels', request.url));
      response.headers.set('X-Robots-Tag', 'noindex, follow');
      return response;
    }
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('next', `${pathname}${search}`);
    // X-Robots-Tag attaches to the redirect itself, so Googlebot reads
    // "the source URL is noindex" before following. Without this, gated
    // routes that ended up linked externally (the seven in GSC's
    // "Indexed, though blocked by robots.txt" bucket) stayed in the index
    // because robots.txt prevented Google from ever seeing a directive.
    // robots.ts now allows crawling for these routes precisely so this
    // header is visible.
    const response = NextResponse.redirect(loginUrl);
    response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
  }

  if (!hasTierAccess(session.user.tier, requiredTier)) {
    const unauthorizedUrl = new URL('/unauthorized', request.url);
    unauthorizedUrl.searchParams.set('required', requiredTier ?? 'basic');
    unauthorizedUrl.searchParams.set('current', session.user.tier);
    unauthorizedUrl.searchParams.set('path', pathname);
    const response = NextResponse.redirect(unauthorizedUrl);
    response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
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
