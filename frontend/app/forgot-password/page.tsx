'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { getCsrfToken } from '@/core/csrfClient';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

export default function ForgotPasswordPage() {
  const t = usePageT(dict);
  const [email, setEmail] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'sent' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

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
    setStatus('loading');
    setErrorMessage(null);

    // Echo the live zgx_csrf cookie value, not the copy captured at mount: a
    // concurrent /api/auth/session (fired by the shared layout for a still-valid
    // session) can overwrite the cookie afterward, making a stale copy fail with
    // an intermittent "Invalid CSRF token". The cookie is the server's source of
    // truth.
    const token = (await getCsrfToken()) || csrfToken;
    if (!token) {
      setStatus('error');
      setErrorMessage(t('initErrorMessage'));
      return;
    }

    try {
      const response = await fetch('/api/auth/password/forgot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-csrf-token': token },
        body: JSON.stringify({ email }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus('error');
        setErrorMessage(payload.error ?? t('genericErrorMessage'));
        return;
      }

      setStatus('sent');
    } catch {
      setStatus('error');
      setErrorMessage(t('networkErrorMessage'));
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          {t('intro')}
        </p>

        {status === 'sent' ? (
          <div className="mt-8 rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] p-4 text-sm">
            <p className="font-semibold">{t('checkEmailTitle')}</p>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {t('checkEmailBody')}
            </p>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              {t('googleSignupHint')}
            </p>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block text-sm">
              <span className="mb-1 block text-[var(--color-text-secondary)]">{t('emailLabel')}</span>
              <input
                className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-2"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoComplete="email"
              />
            </label>

            {status === 'error' && errorMessage && <p className="text-sm text-red-400">{errorMessage}</p>}

            <button
              disabled={status === 'loading'}
              className="w-full rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 font-semibold text-black transition-all duration-150 hover:brightness-110 hover:shadow-[0_8px_20px_var(--color-info-soft)] hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-60"
              type="submit"
            >
              {status === 'loading' ? t('sendingButton') : t('sendButton')}
            </button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/login" className="text-[var(--color-brand-primary)] hover:underline">
            {t('backToSignIn')}
          </Link>
          <Link href="/register" className="text-[var(--color-brand-primary)] hover:underline">
            {t('createAccount')}
          </Link>
        </div>
      </section>
    </main>
  );
}
