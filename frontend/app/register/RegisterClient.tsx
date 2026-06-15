'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCsrfToken } from '@/core/csrfClient';
import { capture } from '@/core/analytics/posthog-client';
import { AnalyticsEvent } from '@/core/analytics/events';

const SELF_SIGNUP_TIERS = new Set(['basic', 'pro']);

export default function RegisterClient({ referralEnabled }: { referralEnabled: boolean }) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-bg)]" />}>
      <RegisterPageContent referralEnabled={referralEnabled} />
    </Suspense>
  );
}

function RegisterPageContent({ referralEnabled }: { referralEnabled: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const selectedTier = useMemo(() => {
    const raw = searchParams.get('tier');
    return raw && SELF_SIGNUP_TIERS.has(raw) ? raw : 'basic';
  }, [searchParams]);

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/')) return null;
    return next;
  }, [searchParams]);

  // Referral code from the inbound link (zerogex.com/register?ref=CODE). Persist
  // it in a first-party cookie so the attribution survives the user browsing
  // around (and the OAuth round-trip) before they actually register.
  const refCode = useMemo(() => {
    const raw = searchParams.get('ref');
    return raw ? raw.trim() : null;
  }, [searchParams]);

  // Drives the "you were referred" banner. True when a ?ref= code is on the URL
  // OR a zgx_ref cookie from an earlier visit is still around.
  const [referralPresent, setReferralPresent] = useState(false);

  useEffect(() => {
    if (refCode) {
      const maxAge = 60 * 60 * 24 * 30; // 30 days
      document.cookie = `zgx_ref=${encodeURIComponent(refCode)}; path=/; max-age=${maxAge}; SameSite=Lax`;
      setReferralPresent(true);
      return;
    }
    setReferralPresent(/(?:^|;\s*)zgx_ref=/.test(document.cookie));
  }, [refCode]);

  // Only promise a discount when the program is actually live.
  const showReferralBanner = referralPresent && referralEnabled;

  // Where to send the user after successful register. /pricing is the default
  // because (post-cutover) new accounts are created at tier=public — they have
  // no premium access until they subscribe, and /pricing is the conversion path.
  const successHref = nextPath ?? '/pricing';

  const loginHref = useMemo(() => {
    return nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
  }, [nextPath]);

  useEffect(() => {
    const loadCsrf = async () => {
      const response = await fetch('/api/auth/csrf');
      const payload = (await response.json()) as { csrfToken: string };
      setCsrfToken(payload.csrfToken);
    };

    void loadCsrf();
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // Send the live zgx_csrf cookie value: a concurrent /api/auth/session
      // (fired by the shared layout for a still-valid session) can overwrite
      // the cookie after mount, leaving the captured copy stale and producing
      // an intermittent "Invalid CSRF token". The cookie is what the server
      // validates against.
      const token = (await getCsrfToken()) || csrfToken;
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ email, password, tier: selectedTier, ref: refCode ?? undefined }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Registration failed');
        return;
      }

      // Top of the funnel: account created. (Identity is attached on the next
      // page load by ClientLayout once the session resolves; PostHog stitches
      // this anonymous event to that identity automatically.)
      capture(AnalyticsEvent.Signup, {
        tier: selectedTier,
        referred: Boolean(refCode),
      });

      // /api/auth/register now sets the session cookie itself; skip the
      // /login bounce and go straight to the next destination.
      router.replace(successHref);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">Create account</h1>
        {showReferralBanner && (
          <div className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-brand-primary)]">
            🎉 A friend referred you — your discount is applied at checkout.
          </div>
        )}
        <p className="mt-3 text-[var(--color-text-secondary)]">
          New accounts have no premium access until they subscribe — you&rsquo;ll be sent to
          the pricing page after sign-up. Use a strong password (12+ characters).
        </p>
        <p className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
          ZeroGEX helps traders understand where the market may react before price gets there.
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">Email</span>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">Password</span>
            <input
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
              type="password"
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            disabled={loading || !csrfToken}
            className="w-full rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 font-semibold text-black disabled:opacity-60"
            type="submit"
          >
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-sm">
          <Link href={loginHref} className="text-[var(--color-brand-primary)] hover:underline">
            Already have an account? Sign in
          </Link>
        </div>
      </section>
    </main>
  );
}
