'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

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
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [csrfToken, setCsrfToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const nextPath = useMemo(() => {
    const next = searchParams.get('next');
    if (!next || !next.startsWith('/')) return '/dashboard';
    return next;
  }, [searchParams]);

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
      const token = csrfToken || (await loadCsrf());
      if (!token) {
        setError('Unable to initialize secure login. Please refresh and try again.');
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
        setError(payload.error ?? 'Login failed');
        return;
      }

      router.replace(nextPath);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">Sign in to ZeroGEX</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          Use your account credentials to authenticate. Session tokens are secure, HttpOnly cookies.
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
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <div className="mt-6 grid gap-3">
          <a
            href="/api/auth/oauth/google/start"
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-center text-sm font-semibold hover:bg-[var(--bg-hover)]"
          >
            Continue with Google
          </a>
          <a
            href="/api/auth/oauth/apple/start"
            className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-center text-sm font-semibold hover:bg-[var(--bg-hover)]"
          >
            Continue with Apple
          </a>
        </div>

        <div className="mt-6 flex items-center justify-between text-sm">
          <Link href="/register" className="text-[var(--color-brand-primary)] hover:underline">
            Create account
          </Link>
          <Link href="/" className="text-[var(--color-brand-primary)] hover:underline">
            Back to landing
          </Link>
        </div>
      </section>
    </main>
  );
}
