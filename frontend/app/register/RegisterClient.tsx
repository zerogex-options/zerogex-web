'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCsrfToken } from '@/core/csrfClient';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';
import { useLanguage } from '@/core/LanguageContext';
import { LOCALE_META, type Locale } from '@/core/i18n/locales';

const SELF_SIGNUP_TIERS = new Set(['basic', 'pro']);

export default function RegisterClient({
  referralEnabled,
  campaignActive,
}: {
  referralEnabled: boolean;
  campaignActive: boolean;
}) {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-bg)]" />}>
      <RegisterPageContent referralEnabled={referralEnabled} campaignActive={campaignActive} />
    </Suspense>
  );
}

function RegisterPageContent({
  referralEnabled,
  campaignActive,
}: {
  referralEnabled: boolean;
  campaignActive: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { locale, setLocale, t } = useLanguage();
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

  // Referral code from the inbound link (zerogex.io/register?ref=CODE). Persist
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
      // Companion first-touch timestamp for the Ambassador Program's attribution
      // window. Set ONLY IF ABSENT so it records the FIRST click, not the latest;
      // given a 60-day-ish window, use a matching lifetime.
      if (!/(?:^|;\s*)zgx_ref_ts=/.test(document.cookie)) {
        const tsMaxAge = 60 * 60 * 24 * 60; // 60 days
        document.cookie = `zgx_ref_ts=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=${tsMaxAge}; SameSite=Lax`;
      }
      setReferralPresent(true);
      return;
    }
    setReferralPresent(/(?:^|;\s*)zgx_ref=/.test(document.cookie));
  }, [refCode]);

  // Only promise a discount when the program is actually live. Campaign codes
  // (e.g. the business-card ?ref=TARGET) also set zgx_ref, but they're a coupon
  // — not a person-to-person referral — so they get the neutral campaign banner
  // below instead of the "a friend referred you" copy.
  const showReferralBanner = referralPresent && referralEnabled && !campaignActive;
  const showCampaignBanner = campaignActive;

  // Funnel step: the signup page was viewed. Fires once on mount, carrying any
  // UTM campaign string so paid traffic that reaches signup is attributable
  // (pairs with the account_created = `signup` event fired on successful submit).
  useEffect(() => {
    capture(TelemetryEvent.SignupPageView, { tier: selectedTier, ...readUtmParams() });
    // Intentionally once-per-mount; selectedTier is stable for the visit.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Where to send the user after successful register. /pricing is the default
  // because it's step two of the trial flow: the new account picks a plan there
  // and the 7-day Stripe trial starts at checkout. A ?next= target (e.g. from a
  // deep link) overrides it.
  const successHref = nextPath ?? '/pricing';

  const loginHref = useMemo(() => {
    return nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';
  }, [nextPath]);

  useEffect(() => {
    const loadCsrf = async () => {
      try {
        const response = await fetch('/api/auth/csrf', { credentials: 'include' });
        if (!response.ok) return;
        const payload = (await response.json()) as { csrfToken?: string };
        if (payload.csrfToken) setCsrfToken(payload.csrfToken);
      } catch {
        // Swallow — submit-time getCsrfToken() retries and reports its own
        // error to the user. Keeping the button enabled means a transient
        // /api/auth/csrf failure doesn't leave them staring at a permanently
        // greyed-out Create Account button with no explanation.
      }
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
      if (!token) {
        setError(t('register.csrfError'));
        return;
      }
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': token,
        },
        body: JSON.stringify({ email, password, tier: selectedTier, ref: refCode ?? undefined }),
      });

      const payload = (await response.json()) as {
        error?: string;
        emailVerificationSent?: boolean;
      };
      if (!response.ok) {
        setError(payload.error ?? t('register.genericError'));
        return;
      }

      // Top of the funnel: account created. (Identity is attached on the next
      // page load by ClientLayout once the session resolves; PostHog stitches
      // this anonymous event to that identity automatically.) Carry any UTM
      // still on the URL so a directly-attributed signup keeps its campaign.
      capture(TelemetryEvent.Signup, {
        tier: selectedTier,
        referred: Boolean(refCode),
        ...readUtmParams(),
      });

      // Step two of the trial flow: continue on /pricing with the trial-context
      // hero. Build /pricing?trial=1&source=registration and carry any UTM that
      // drove the signup so campaign attribution survives the hop. A custom
      // non-pricing ?next= target (e.g. a deep link) is honored instead.
      const pricingParams = new URLSearchParams({ trial: '1', source: 'registration' });
      for (const [key, value] of Object.entries(readUtmParams())) pricingParams.set(key, value);
      // Carry a plan preselection through if the pricing-bound next= carried one
      // (e.g. a logged-out "Start Pro Trial" click → /register?next=/pricing?…plan=pro),
      // so the chosen card lands highlighted instead of making them re-pick.
      if (nextPath?.startsWith('/pricing')) {
        const nextPlan = new URLSearchParams(nextPath.split('?')[1] ?? '').get('plan');
        if (nextPlan === 'basic' || nextPlan === 'pro') pricingParams.set('plan', nextPlan);
      }
      const trialHref = `/pricing?${pricingParams.toString()}`;
      const base = successHref.startsWith('/pricing') ? trialHref : successHref;

      // If the verification mail couldn't be dispatched on signup, append a
      // hint to the destination so /pricing (or whatever next= points at)
      // can show a "couldn't send the link — use Resend" banner. The account
      // is otherwise fine; the user is auto-logged-in and just needs to hit
      // the Resend button.
      const target =
        payload.emailVerificationSent === false
          ? base + (base.includes('?') ? '&' : '?') + 'email_send_failed=1'
          : base;

      // /api/auth/register now sets the session cookie itself; skip the
      // /login bounce and go straight to the next destination.
      router.replace(target);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">{t('register.title')}</h1>
        {showReferralBanner && (
          <div className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-brand-primary)]">
            {t('register.referralBanner')}
          </div>
        )}
        {showCampaignBanner && (
          <div className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-brand-primary)]">
            {t('register.campaignBanner')}
          </div>
        )}
        <p className="mt-3 text-[var(--color-text-secondary)]">
          {t('register.trialInfo')}
        </p>
        <p className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-medium text-[var(--color-text-primary)]">
          {t('register.valueProp')}
        </p>

        <form onSubmit={onSubmit} className="mt-8 space-y-4">
          <label className="block text-sm">
            <span className="mb-1 block text-[var(--color-text-secondary)]">{t('register.languageLabel')}</span>
            <select
              className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
              value={locale}
              onChange={(event) => setLocale(event.target.value as Locale)}
              aria-label={t('language.select')}
            >
              {LOCALE_META.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.flag} {l.label} ({l.englishName})
                </option>
              ))}
            </select>
          </label>

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
              minLength={12}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
            <span className="mt-1 block text-xs text-[var(--color-text-secondary)] opacity-80">
              {t('register.passwordHint')}
            </span>
          </label>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <button
            disabled={loading}
            className="w-full rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 font-semibold text-black disabled:opacity-60"
            type="submit"
          >
            {loading ? t('register.submitting') : t('register.submit')}
          </button>

          <p className="text-center text-xs text-[var(--color-text-secondary)]">
            {t('register.nextStep')}
          </p>
        </form>

        <div className="mt-6 text-sm">
          <Link href={loginHref} className="text-[var(--color-brand-primary)] hover:underline">
            {t('register.haveAccount')}
          </Link>
        </div>
      </section>
    </main>
  );
}
