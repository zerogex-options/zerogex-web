'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AUTH_TIERS } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';

const TIER_LABELS: Record<string, string> = AUTH_TIERS.reduce(
  (acc, tier) => ({ ...acc, [tier.id]: tier.label }),
  {} as Record<string, string>,
);

export default function AccountPage() {
  const router = useRouter();
  const { data: session, loading, refresh } = useAuthSession();
  const [cancelling, setCancelling] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !session?.authenticated) {
      router.replace('/login?next=/account');
    }
  }, [loading, session, router]);

  if (loading || !session?.authenticated || !session.user) {
    return (
      <main className="min-h-[60vh] px-6 py-12 flex items-center justify-center text-[var(--color-text-primary)]">
        <p className="text-sm text-[var(--color-text-secondary)]">Loading account…</p>
      </main>
    );
  }

  const { email, tier } = session.user;
  const tierLabel = TIER_LABELS[tier] ?? tier;
  const isElite = (tier as string) === 'elite';

  const handleCancelSubscription = async () => {
    const confirmed = window.confirm(
      'Cancel your ZeroGEX subscription? Your paid access will remain until the current billing period ends.',
    );
    if (!confirmed) return;

    setCancelling(true);
    setNotice(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf');
      const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };
      const response = await fetch('/api/account/subscription', {
        method: 'DELETE',
        headers: { 'x-csrf-token': csrfToken },
      });

      if (response.status === 404) {
        setNotice(
          'Self-serve cancellation is not available yet. Please email support@zerogex.io and we will close out your subscription.',
        );
        return;
      }

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setNotice(payload.error ?? 'Could not cancel subscription. Please contact support.');
        return;
      }

      setNotice('Your subscription has been cancelled.');
      await refresh();
    } catch {
      setNotice(
        'Could not reach the billing service. Please try again shortly or email support@zerogex.io.',
      );
    } finally {
      setCancelling(false);
    }
  };

  return (
    <main className="px-6 py-10 max-w-3xl mx-auto text-[var(--color-text-primary)]">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Account</h1>
        <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
          Manage your ZeroGEX subscription and account details.
        </p>
      </header>

      <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <dl className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--color-border)] pb-4">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                Account
              </dt>
              <dd className="mt-1 text-base font-semibold break-all">{email}</dd>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <dt className="text-xs uppercase tracking-[0.18em] text-[var(--color-text-secondary)]">
                Tier
              </dt>
              <dd className="mt-1 text-base font-semibold capitalize">{tierLabel}</dd>
            </div>
            {!isElite && (
              <Link
                href="/#pricing"
                className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-sm font-semibold text-black hover:opacity-90"
              >
                Upgrade
              </Link>
            )}
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-sm">
        <h2 className="text-lg font-semibold">Subscription</h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Cancelling stops future renewals. You keep paid access until the end of your current
          billing period.
        </p>
        <button
          type="button"
          onClick={handleCancelSubscription}
          disabled={cancelling}
          className="mt-4 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-primary)] hover:bg-[var(--bg-hover)] disabled:opacity-60"
        >
          {cancelling ? 'Cancelling…' : 'Cancel Subscription'}
        </button>
        {notice && (
          <p className="mt-3 text-sm text-[var(--color-text-secondary)]">{notice}</p>
        )}
      </section>
    </main>
  );
}
