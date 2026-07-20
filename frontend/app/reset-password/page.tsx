'use client';

import { FormEvent, Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { getCsrfToken } from '@/core/csrfClient';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

const PASSWORD_MIN_LENGTH = 12;

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-bg)]" />}>
      <ResetPasswordPageContent />
    </Suspense>
  );
}

function ResetPasswordPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const t = usePageT(dict);

  const fetchCsrf = async () => {
    try {
      const response = await fetch('/api/auth/csrf', { credentials: 'include' });
      if (!response.ok) return null;
      const payload = (await response.json()) as { csrfToken?: string };
      return payload.csrfToken ?? null;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const value = await fetchCsrf();
      if (!cancelled && value) setCsrfToken(value);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!token) {
      setStatus('error');
      setErrorMessage(t('invalidLink'));
      return;
    }
    if (password !== confirm) {
      setStatus('error');
      setErrorMessage(t('passwordsDontMatch'));
      return;
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
      setStatus('error');
      setErrorMessage(t('passwordTooShort', { minLength: PASSWORD_MIN_LENGTH }));
      return;
    }

    setStatus('loading');
    setErrorMessage(null);

    // Echo the live zgx_csrf cookie value, not the copy captured at mount: a
    // concurrent /api/auth/session (fired by the shared layout for a still-valid
    // session) can overwrite the cookie afterward, making a stale copy fail with
    // an intermittent "Invalid CSRF token". The cookie is the server's source of
    // truth.
    const csrf = (await getCsrfToken()) || csrfToken;
    if (!csrf) {
      setStatus('error');
      setErrorMessage(t('csrfInitFailed'));
      return;
    }

    try {
      const response = await fetch('/api/auth/password/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': csrf },
        body: JSON.stringify({ token, password }),
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setStatus('error');
        setErrorMessage(payload.error ?? t('resetFailed'));
        return;
      }

      setStatus('success');
      setTimeout(() => router.replace('/login'), 2500);
    } catch {
      setStatus('error');
      setErrorMessage(t('networkError'));
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          {t('subtitle', { minLength: PASSWORD_MIN_LENGTH })}
        </p>

        {status === 'success' ? (
          <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] p-4 text-sm">
            <p className="font-semibold">{t('successTitle')}</p>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {t('successBody')}
            </p>
          </div>
        ) : !token ? (
          <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] p-4 text-sm">
            <p className="font-semibold">{t('invalidLinkTitle')}</p>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {t('invalidLinkBody')} <Link href="/forgot-password" className="text-[var(--color-brand-primary)] hover:underline">{t('requestNewOne')}</Link>.
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--color-text-secondary)]">{t('newPasswordLabel')}</span>
              <input
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block text-[var(--color-text-secondary)]">{t('confirmPasswordLabel')}</span>
              <input
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
                type="password"
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                required
                minLength={PASSWORD_MIN_LENGTH}
                autoComplete="new-password"
              />
            </label>

            {status === 'error' && errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

            <button
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 font-semibold text-black transition-all duration-150 hover:brightness-110 hover:shadow-[0_8px_20px_var(--color-info-soft)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              type="submit"
            >
              {status === 'loading' ? t('updating') : t('updatePassword')}
            </button>
          </form>
        )}

        <div className="mt-6 text-sm">
          <Link href="/login" className="text-[var(--color-brand-primary)] hover:underline">
            {t('backToSignIn')}
          </Link>
        </div>
      </section>
    </main>
  );
}
