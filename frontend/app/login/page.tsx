'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCsrfToken } from '@/core/csrfClient';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useLanguage } from '@/core/LanguageContext';

// Friendly copy for the ?error=... codes the OAuth callbacks redirect with on
// failure (google/callback/route.ts, apple/callback/route.ts). Without this
// the user lands back on /login and sees a blank form — "Continue with Google"
// looks broken. Anything unrecognized falls through to a generic provider
// message so a new error code can be added on the server first and still
// surface something useful.
function describeOAuthError(code: string): string {
  switch (code) {
    case 'oauth_state_mismatch':
    case 'apple_state_mismatch':
      return 'Sign-in was interrupted. Please try again.';
    case 'oauth_rate_limited':
    case 'apple_rate_limited':
      return 'Too many sign-in attempts from your network. Please wait a few minutes and try again.';
    case 'oauth_token_exchange_failed':
    case 'apple_token_exchange_failed':
      return 'We couldn’t complete sign-in with the provider. Please try again.';
    case 'oauth_missing_id_token':
    case 'apple_missing_id_token':
    case 'oauth_profile_invalid':
    case 'apple_profile_invalid':
      return 'We couldn’t verify your account with the provider. Please try again or use email and password.';
    case 'oauth_link_unauthenticated':
      return 'You need to be signed in before linking an account.';
    default:
      if (code.startsWith('apple_')) return 'Apple sign-in failed. Please try again or use email and password.';
      if (code.startsWith('oauth_')) return 'Google sign-in failed. Please try again or use email and password.';
      return 'Sign-in failed. Please try again.';
  }
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-bg)]" />}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  // Seed from the URL once at mount so a failed OAuth round-trip
  // (?error=oauth_*) doesn't land on a silent form. Re-render later on
  // local-login failure simply overwrites this with the credential error.
  const oauthError = useMemo(() => {
    const code = searchParams.get('error');
    return code ? describeOAuthError(code) : null;
  }, [searchParams]);
  const [error, setError] = useState<string | null>(oauthError);
  const [loading, setLoading] = useState(false);
  // Shared session store (same request the layout/header already fire, so this
  // adds no extra fetch). Drives the "already signed in" forward below.
  const { data: authSession, loading: authLoading } = useAuthSession();

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');
    // Only honor same-origin app paths, and never a path back to an auth page:
    // a ?next=/login (or /register) would make the already-authenticated
    // forward below bounce back to this page and loop. Fall through to the
    // dashboard for anything unusable.
    if (!next || !next.startsWith('/') || next.startsWith('/login') || next.startsWith('/register')) {
      return '/dashboard';
    }
    return next;
  }, [searchParams]);

  // Forward visitors who already have a valid session instead of leaving them
  // stranded on the sign-in form. Without this, a signed-in user who lands on
  // /login (a stale bookmark, the landing "Login" link, a middleware round-trip
  // that resolved after they'd authenticated in another tab) sees the form and
  // nothing happens — "stuck on the login page." A fresh/incognito browser has
  // no session cookie, so it takes the normal credential path and works, which
  // is exactly the "works in a private window" report. Waits for the session
  // fetch to resolve so we never redirect on the initial loading snapshot.
  const alreadyAuthenticated = !authLoading && authSession?.authenticated === true;
  useEffect(() => {
    if (alreadyAuthenticated) {
      router.replace(nextPath);
    }
  }, [alreadyAuthenticated, nextPath, router]);

  const loadCsrf = async () => {
    try {
      const response = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (!response.ok) return null;
      const payload = (await response.json()) as { csrfToken?: string };
      if (!payload.csrfToken) return null;
      setCsrfToken(payload.csrfToken);
      return payload.csrfToken;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    void loadCsrf();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Echo whatever value is in the zgx_csrf cookie *now* rather than the
      // copy captured at mount. ClientLayout fetches /api/auth/session on every
      // page (including this one); for a still-valid session that response
      // rewrites zgx_csrf with the session's CSRF secret, racing the
      // /api/auth/csrf call here. If session's write lands last, the mount-time
      // token goes stale and the server sees header != cookie — the
      // intermittent "Invalid CSRF token". Reading the cookie at submit time
      // always matches whatever the server will compare against.
      const token = (await getCsrfToken()) || csrfToken;
      if (!token) {
        setError(t('login.csrfError'));
        return;
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ email, password }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? t('login.genericError'));
        return;
      }

      router.replace(nextPath);
    } finally {
      setLoading(false);
    }
  };

  // Already signed in: render the plain background (matching the Suspense
  // fallback) while the effect above forwards them, rather than flashing a
  // sign-in form they don't need.
  if (alreadyAuthenticated) {
    return <main className="min-h-screen bg-[var(--color-bg)]" />;
  }

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">{t('login.title')}</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          {t('login.subtitle')}
        </p>
        <p className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
          {t('login.valueProp')}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{t('register.emailLabel')}</span>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{t('register.passwordLabel')}</span>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 font-semibold text-black transition-all duration-150 hover:brightness-110 hover:shadow-[0_8px_20px_var(--color-info-soft)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
            type="submit"
          >
            {loading ? t('login.submitting') : t('login.submit')}
          </button>

          <div className="text-right text-sm">
            <Link href="/forgot-password" className="text-[var(--color-brand-primary)] hover:underline">
              {t('login.forgotPassword')}
            </Link>
          </div>
        </form>

        <div className="mt-6 grid gap-3">
          <a
            href="/api/auth/oauth/google/start"
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-center text-sm font-semibold hover:bg-[var(--bg-hover)]"
          >
            {t('login.continueGoogle')}
          </a>
          <span
            aria-disabled="true"
            className="w-full cursor-not-allowed rounded-lg border border-[var(--color-border)] px-4 py-2 text-center text-sm font-semibold opacity-50"
          >
            {t('login.continueApple')}
          </span>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/register" className="text-[var(--color-brand-primary)] hover:underline">
            {t('login.createAccount')}
          </Link>
          <Link href="/" className="text-[var(--color-brand-primary)] hover:underline">
            {t('login.backToLanding')}
          </Link>
        </div>
      </section>
    </main>
  );
}
