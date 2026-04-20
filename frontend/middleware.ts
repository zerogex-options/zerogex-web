import { NextRequest, NextResponse } from 'next/server';

const AUTH_API_PREFIX = '/api/auth/';
const AUTH_PAGES = new Set(['/login', '/register']);

export function middleware(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_AUTH_ENABLED === '1') {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (pathname.startsWith(AUTH_API_PREFIX)) {
    return new NextResponse(null, { status: 404 });
  }

  if (AUTH_PAGES.has(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/auth/:path*', '/login', '/register'],
};
