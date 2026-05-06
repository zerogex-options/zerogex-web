'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const SELF_SIGNUP_TIERS = new Set(['basic', 'pro']);

export default function RegisterPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-[var(--color-bg)]" />}>
      <RegisterPageContent />
    </Suspense>
  );
}

function RegisterPageContent() {
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
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-csrf-token': csrfToken,
        },
        body: JSON.stringify({ email, password, tier: selectedTier }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setError(payload.error ?? 'Registration failed');
        return;
      }

      router.replace(loginHref);
    } finally {
      setLoading(false);
    }
  };

  const tierLabel = selectedTier === 'pro' ? 'Pro' : 'Basic';

  return (
    <main className="min-h-screen px-6 py-12 flex items-center justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <section className="w-full max-w-xl rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
        <h1 className="text-3xl font-bold">Create account</h1>
        <p className="mt-3 text-[var(--color-text-secondary)]">
          You&rsquo;re signing up for the <span className="font-semibold text-[var(--color-text-primary)]">{tierLabel}</span> tier.
          Use a strong password (12+ characters).
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
