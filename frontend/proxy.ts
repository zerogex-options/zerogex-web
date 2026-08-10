import { NextRequest, NextResponse } from 'next/server';
import { SESSION_COOKIE_NAME, hasTierAccess, isPublicRoute, requiredTierForRoute } from '@/core/auth';
import { getSessionFromRequest } from '@/core/serverAuth';
import { recordRequest, resolveUserIdFromCookie } from '@/core/monitoring';
import { DEFAULT_LOCALE, normalizeLocale } from '@/core/i18n/locales';
import {
  INVARIANT_PATH_HEADER,
  LOCALE_HEADER,
  localeFromPathname,
  localeHref,
  stripLocalePrefix,
} from '@/core/i18n/routing';

function readPositiveInt(name: string, fallback: number) {
  const raw = process.env[name];
  const parsed = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

const SESSION_COOKIE_MAX_AGE_SECONDS = readPositiveInt('AUTH_SESSION_TTL_SECONDS', 60 * 60 * 24 * 14);

const STATIC_ASSET_EXT = /\.(?:css|js|map|svg|png|jpg|jpeg|gif|webp|woff2?|ttf|eot|ico|txt|json|xml)$/i;

function recordRequestForMonitoring(request: NextRequest) {
  try {
    const pathname = request.nextUrl.pathname;
    if (
      pathname.startsWith('/_next') ||
      pathname.startsWith('/api/admin/monitoring') ||
      // The page-analytics beacon fires ~2 requests per pageview; counting them
      // here would inflate this monitor's API-call totals with its own sibling
      // feature's telemetry. It has its own dashboard at /admin/analytics.
      pathname.startsWith('/api/analytics/') ||
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
  const { pathname, search } = request.nextUrl;
  recordRequestForMonitoring(request);
  const authEnabled = process.env.NEXT_PUBLIC_AUTH_ENABLED === '1';

  // The locale is carried in the URL path prefix (/it, /de, /es, /fr); English
  // is the default and stays unprefixed. `invariantPath` is the un-prefixed
  // path the physical route tree serves, and is what every auth/access check
  // below runs against so gating is identical regardless of language.
  const locale = localeFromPathname(pathname);
  const invariantPath = stripLocalePrefix(pathname);
  const hasLocalePrefix = locale !== DEFAULT_LOCALE;

  // Assets, Next internals, and API routes are never localized — pass them
  // through untouched (matching the original behavior). `invariantPath` is
  // checked too so a stray /it/api/* can't slip into the page pipeline.
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    invariantPath.startsWith('/api') ||
    pathname.includes('.')
  ) {
    if (!authEnabled && pathname.startsWith('/api/auth/')) {
      return new NextResponse(null, { status: 404 });
    }
    return NextResponse.next();
  }

  // An explicit /en/... prefix is redundant with the canonical unprefixed URL —
  // 308 it away so there is exactly one English URL per page (no duplicate).
  const enPrefix = pathname.match(/^\/en(\/.*)?$/i);
  if (enPrefix) {
    const url = request.nextUrl.clone();
    url.pathname = enPrefix[1] || '/';
    return NextResponse.redirect(url, 308);
  }

  // Returning visitors: honor a saved non-English `lang` cookie on the bare
  // homepage by sending them to their localized home. 307 (temporary) so the
  // unprefixed `/` stays the canonical English URL — crawlers send no cookie
  // and so never trip this, keeping the English home indexable at `/`.
  if (pathname === '/' && request.method === 'GET') {
    const cookieLocale = normalizeLocale(request.cookies.get('lang')?.value);
    if (cookieLocale !== DEFAULT_LOCALE) {
      const url = request.nextUrl.clone();
      url.pathname = `/${cookieLocale}`;
      return NextResponse.redirect(url, 307);
    }
  }

  // Request headers the downstream render reads (via core/localizedMetadata.ts)
  // to recover the locale and the un-prefixed path — for <html lang>, the
  // content dictionaries/markdown, and canonical + hreflang alternates.
  const buildHeaders = () => {
    const headers = new Headers(request.headers);
    headers.set(LOCALE_HEADER, locale);
    headers.set(INVARIANT_PATH_HEADER, invariantPath);
    return headers;
  };

  // Let the request through: a /xx-prefixed URL is REWRITTEN onto the physical
  // (un-prefixed) route so the browser URL keeps its locale prefix while the
  // route tree stays English-shaped. English passes straight through, still
  // stamped with the headers so the server has one uniform locale source.
  const allow = (): NextResponse => {
    if (hasLocalePrefix) {
      const url = request.nextUrl.clone();
      url.pathname = invariantPath;
      return NextResponse.rewrite(url, { request: { headers: buildHeaders() } });
    }
    return NextResponse.next({ request: { headers: buildHeaders() } });
  };

  // A redirect that keeps the visitor inside their current locale (so a gated
  // /it/dashboard bounces to /it/login, not /login).
  const localizedRedirect = (targetPath: string): NextResponse => {
    return NextResponse.redirect(new URL(localeHref(locale, targetPath), request.url));
  };

  if (!authEnabled) {
    if (invariantPath === '/login' || invariantPath === '/register') {
      return localizedRedirect('/');
    }
    return allow();
  }

  if (isPublicRoute(invariantPath)) {
    return allow();
  }

  const requiredTier = requiredTierForRoute(invariantPath);
  if (!requiredTier) {
    return allow();
  }

  const session = await getSessionFromRequest(request);
  if (!session) {
    // Anonymous /dashboard visitors get the free public preview instead of
    // a /login wall — the 15-min-delayed gamma-levels page is the SEO-target
    // teaser that replaces the previously-open /dashboard preview. Subscribers
    // still land on the full live dashboard because they bypass this branch.
    if (invariantPath === '/dashboard') {
      const response = localizedRedirect('/spx-gamma-levels');
      response.headers.set('X-Robots-Tag', 'noindex, follow');
      return response;
    }
    const loginUrl = new URL(localeHref(locale, '/login'), request.url);
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

  // Post-checkout grace. Stripe's success_url (/dashboard?trial_started=1) can
  // load a beat before the subscription webhook grants the trialing tier. Let a
  // logged-in visitor into the dashboard during that window instead of bouncing
  // them to the unlock screen the instant after they paid. The gamma/flow APIs
  // stay tier-gated server-side, so no paid data leaks while the tier settles;
  // once the webhook lands the normal gate applies again on the next navigation.
  const justStartedTrial =
    invariantPath === '/dashboard' && request.nextUrl.searchParams.get('trial_started') === '1';

  if (!justStartedTrial && !hasTierAccess(session.user.tier, requiredTier)) {
    const unauthorizedUrl = new URL(localeHref(locale, '/unauthorized'), request.url);
    unauthorizedUrl.searchParams.set('required', requiredTier ?? 'basic');
    unauthorizedUrl.searchParams.set('current', session.user.tier);
    unauthorizedUrl.searchParams.set('path', pathname);
    const response = NextResponse.redirect(unauthorizedUrl);
    response.headers.set('X-Robots-Tag', 'noindex, follow');
    return response;
  }

  const response = allow();
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
