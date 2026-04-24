'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mail, Rocket, ShieldCheck, XCircle } from 'lucide-react';
import { AUTH_TIERS, normalizeTier, TierId } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  accent: 'var(--color-brand-accent)',
  border: 'var(--color-border)',
};

const TIER_LABELS: Record<TierId, string> = AUTH_TIERS.reduce(
  (acc, tier) => ({ ...acc, [tier.id]: tier.label }),
  {} as Record<TierId, string>,
);

export default function AccountPage() {
  const router = useRouter();
  const { data: authSession, loading, refresh } = useAuthSession();
  const [cancelling, setCancelling] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const tier = useMemo(() => normalizeTier(authSession?.user?.tier), [authSession?.user?.tier]);
  const email = authSession?.user?.email ?? '';
  const tierLabel = TIER_LABELS[tier] ?? 'Public';
  const canUpgrade = tier !== 'elite' && tier !== 'admin';
  const canCancel = tier === 'pro' || tier === 'elite';

  const handleCancelSubscription = async () => {
    setCancelling(true);
    setFeedback(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setFeedback({ type: 'error', message: 'Unable to obtain CSRF token. Please refresh and try again.' });
        return;
      }

      const response = await fetch('/api/auth/subscription/cancel', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken },
        credentials: 'include',
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        setFeedback({ type: 'error', message: payload.error ?? 'Subscription cancellation failed' });
        return;
      }

      await refresh();
      setFeedback({ type: 'success', message: 'Your subscription has been cancelled. You are now on the Starter tier.' });
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setCancelling(false);
      setConfirmOpen(false);
    }
  };

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
        <p style={{ color: C.muted }}>Loading account...</p>
      </main>
    );
  }

  if (!authSession?.authenticated) {
    return (
      <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
        <section
          style={{
            maxWidth: 560,
            margin: '0 auto',
            background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: 28,
          }}
        >
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>Account</h1>
          <p style={{ marginTop: 12, color: C.muted }}>
            You need to be signed in to view your account.
          </p>
          <button
            onClick={() => router.push('/login?next=/account')}
            style={{
              marginTop: 20,
              background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
              border: 'none',
              borderRadius: 12,
              padding: '12px 20px',
              color: 'var(--text-inverse)',
              fontWeight: 800,
              fontSize: 14,
              cursor: 'pointer',
            }}
          >
            Sign in
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>Account</h1>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 15 }}>
            Manage your profile, subscription tier, and membership.
          </p>
        </header>

        {feedback && (
          <div
            role="status"
            style={{
              marginBottom: 20,
              borderRadius: 12,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 600,
              border: '1px solid',
              borderColor: feedback.type === 'success' ? 'var(--color-bull)' : 'var(--color-bear)',
              color: feedback.type === 'success' ? 'var(--color-bull)' : 'var(--color-bear)',
              background: feedback.type === 'success' ? 'var(--color-bull-soft)' : 'var(--color-bear-soft)',
            }}
          >
            {feedback.message}
          </div>
        )}

        <section
          style={{
            background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: 28,
            boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
          }}
        >
          <div style={{ display: 'grid', gap: 20 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <Mail size={14} /> Account Name
              </div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: C.light, wordBreak: 'break-all' }}>{email}</div>
            </div>

            <div style={{ height: 1, background: C.border }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <ShieldCheck size={14} /> Tier
              </div>
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 14px',
                    borderRadius: 999,
                    fontSize: 14,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: C.amber,
                    border: `1px solid ${C.amber}66`,
                    background: `${C.amber}12`,
                  }}
                >
                  {tierLabel}
                </span>
                {canUpgrade && (
                  <button
                    type="button"
                    onClick={() => router.push('/pricing')}
                    style={{
                      background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                      border: 'none',
                      borderRadius: 10,
                      padding: '8px 16px',
                      color: 'var(--text-inverse)',
                      fontWeight: 800,
                      fontSize: 13,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <Rocket size={14} /> Upgrade
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light }}>Subscription</h2>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            Cancelling ends your paid subscription and removes your access to premium features.
          </p>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!canCancel || cancelling}
            style={{
              background: 'transparent',
              border: '1px solid',
              borderColor: 'var(--color-bear)',
              color: 'var(--color-bear)',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 700,
              fontSize: 14,
              cursor: canCancel && !cancelling ? 'pointer' : 'not-allowed',
              opacity: canCancel && !cancelling ? 1 : 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <XCircle size={16} /> Cancel Subscription
          </button>
          {!canCancel && (
            <p style={{ margin: '10px 0 0', color: C.muted, fontSize: 12 }}>
              No active paid subscription to cancel.
            </p>
          )}
        </section>
      </div>

      {confirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 1000,
          }}
          onClick={() => !cancelling && setConfirmOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: 440,
              width: '100%',
              background: C.card,
              border: `1px solid ${C.border}`,
              borderRadius: 16,
              padding: 24,
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light }}>Cancel subscription?</h3>
            <p style={{ margin: '10px 0 0', color: C.muted, fontSize: 14, lineHeight: 1.5 }}>
              You will lose access to paid features immediately and be moved to the Starter tier. This action cannot be undone.
            </p>
            <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                disabled={cancelling}
                style={{
                  background: 'transparent',
                  border: `1px solid ${C.border}`,
                  color: C.light,
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 700,
                  fontSize: 13,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                }}
              >
                Keep subscription
              </button>
              <button
                type="button"
                onClick={handleCancelSubscription}
                disabled={cancelling}
                style={{
                  background: 'var(--color-bear)',
                  border: 'none',
                  color: 'var(--text-inverse)',
                  borderRadius: 10,
                  padding: '8px 16px',
                  fontWeight: 800,
                  fontSize: 13,
                  cursor: cancelling ? 'not-allowed' : 'pointer',
                  opacity: cancelling ? 0.7 : 1,
                }}
              >
                {cancelling ? 'Cancelling...' : 'Yes, cancel'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
