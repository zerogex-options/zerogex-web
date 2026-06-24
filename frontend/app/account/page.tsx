'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Copy, Gift, Heart, KeyRound, Link2, Mail, Rocket, Settings, ShieldCheck } from 'lucide-react';
import { AUTH_TIERS, normalizeTier, TierId } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';

type DonationPayload = {
  pledgePct: number;
  partner: string;
  baseAmountUsd: number;
  donationUsd: number;
  interval: string;
  currency: string;
};

type IdentitiesPayload = {
  hasPassword: boolean;
  identities: Array<{ provider: 'google' | 'apple'; createdAt: string }>;
};

type ReferralPayload = {
  enabled: boolean;
  code?: string;
  link?: string;
  totalSignups?: number;
  totalConverted?: number;
  monthsEarned?: number;
  bankedMonths?: number;
  creditOnNextBill?: string;
};

const PASSWORD_MIN_LENGTH = 12;

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
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
          <p style={{ color: C.muted }}>Loading account...</p>
        </main>
      }
    >
      <AccountPageContent />
    </Suspense>
  );
}

function AccountPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authSession, loading } = useAuthSession();
  const [opening, setOpening] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [identities, setIdentities] = useState<IdentitiesPayload | null>(null);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [unlinkingProvider, setUnlinkingProvider] = useState<string | null>(null);
  const [showSetPassword, setShowSetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [settingPassword, setSettingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [referral, setReferral] = useState<ReferralPayload | null>(null);
  const [referralCopied, setReferralCopied] = useState(false);
  const [donation, setDonation] = useState<DonationPayload | null>(null);

  const refreshIdentities = async () => {
    setIdentitiesLoading(true);
    try {
      const response = await fetch('/api/account/identities', { credentials: 'include' });
      if (!response.ok) {
        setIdentities(null);
        return;
      }
      const data = (await response.json()) as IdentitiesPayload;
      setIdentities(data);
    } catch {
      setIdentities(null);
    } finally {
      setIdentitiesLoading(false);
    }
  };

  useEffect(() => {
    if (authSession?.authenticated) refreshIdentities();
  }, [authSession?.authenticated]);

  useEffect(() => {
    if (!authSession?.authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/account/referrals', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as ReferralPayload;
        if (!cancelled) setReferral(data);
      } catch {
        /* referral card is non-critical; silently skip on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authSession?.authenticated]);

  const handleCopyReferral = async () => {
    if (!referral?.link) return;
    try {
      await navigator.clipboard.writeText(referral.link);
      setReferralCopied(true);
      setTimeout(() => setReferralCopied(false), 2000);
    } catch {
      setFeedback({ type: 'error', message: 'Could not copy link. Copy it manually.' });
    }
  };

  useEffect(() => {
    const link = searchParams?.get('link');
    if (link === 'success') {
      setFeedback({ type: 'success', message: 'Provider linked to your account.' });
    } else if (link === 'error') {
      const reason = searchParams?.get('reason');
      setFeedback({ type: 'error', message: reason ? decodeURIComponent(reason) : 'Could not link provider.' });
    }
  }, [searchParams]);

  useEffect(() => {
    if (!authSession?.authenticated) return;
    if (searchParams?.get('checkout') !== 'success') return;
    const sessionId = searchParams?.get('session_id');
    if (!sessionId) return;

    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(
          `/api/billing/checkout/donation?session_id=${encodeURIComponent(sessionId)}`,
          { credentials: 'include' },
        );
        if (!response.ok) return;
        const data = (await response.json()) as DonationPayload;
        if (!cancelled) setDonation(data);
      } catch {
        /* donation banner is non-critical; silently skip on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authSession?.authenticated, searchParams]);

  const handleSetPassword = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < PASSWORD_MIN_LENGTH) {
      setPasswordError(`Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Passwords do not match.');
      return;
    }

    setSettingPassword(true);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setPasswordError('Unable to obtain CSRF token. Please refresh and try again.');
        return;
      }
      const response = await fetch('/api/account/password/set', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password: newPassword }),
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setPasswordError(payload.error ?? 'Failed to set password.');
        return;
      }
      setFeedback({ type: 'success', message: 'Password set. You can now sign in with your email and password.' });
      setShowSetPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      await refreshIdentities();
    } catch {
      setPasswordError('Something went wrong. Please try again.');
    } finally {
      setSettingPassword(false);
    }
  };

  const handleUnlink = async (provider: 'google' | 'apple') => {
    setUnlinkingProvider(provider);
    setFeedback(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setFeedback({ type: 'error', message: 'Unable to obtain CSRF token. Please refresh and try again.' });
        return;
      }
      const response = await fetch('/api/account/identities/unlink', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ provider }),
      });
      const payload = (await response.json()) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setFeedback({ type: 'error', message: payload.error ?? 'Failed to unlink provider.' });
        return;
      }
      setFeedback({ type: 'success', message: `Disconnected ${provider}.` });
      await refreshIdentities();
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const tier = useMemo(() => normalizeTier(authSession?.user?.tier), [authSession?.user?.tier]);
  const email = authSession?.user?.email ?? '';
  const tierLabel = TIER_LABELS[tier] ?? 'Public';
  const canUpgrade = tier !== 'pro' && tier !== 'admin';
  const canManageBilling = tier !== 'public' && tier !== 'admin';

  const handleManageSubscription = async () => {
    setOpening(true);
    setFeedback(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setFeedback({ type: 'error', message: 'Unable to obtain CSRF token. Please refresh and try again.' });
        return;
      }

      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken },
        credentials: 'include',
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setFeedback({ type: 'error', message: payload.error ?? 'Could not open billing portal.' });
        return;
      }

      window.location.href = payload.url;
    } catch {
      setFeedback({ type: 'error', message: 'Something went wrong. Please try again.' });
    } finally {
      setOpening(false);
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

        {donation && (
          <div
            role="status"
            style={{
              marginBottom: 20,
              borderRadius: 14,
              padding: '16px 18px',
              border: `1px solid ${C.amber}55`,
              background: `linear-gradient(135deg, ${C.amber}1a 0%, ${C.amber}08 100%)`,
              color: C.light,
              display: 'flex',
              alignItems: 'flex-start',
              gap: 14,
            }}
          >
            <div
              style={{
                width: 36, height: 36, borderRadius: 10,
                background: `${C.amber}26`, border: `1px solid ${C.amber}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}
            >
              <Heart size={16} style={{ color: C.amber }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                Welcome aboard — and thank you.
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
                Your subscription just contributed{' '}
                <strong style={{ color: C.amber }}>
                  ${donation.donationUsd.toFixed(2)}
                </strong>{' '}
                to <strong style={{ color: C.light }}>{donation.partner}</strong> — {donation.pledgePct}% of
                every {donation.interval === 'year' ? 'annual' : 'monthly'} billing cycle.{' '}
                <Link href="/giving" style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}>
                  See our giving page →
                </Link>
              </div>
            </div>
          </div>
        )}

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
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light }}>Sign-in methods</h2>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            Connect or disconnect the providers you use to sign in. You must keep at least one method active.
          </p>
          {identitiesLoading ? (
            <p style={{ color: C.muted, fontSize: 14 }}>Loading sign-in methods…</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <SignInMethodRow
                  icon={<KeyRound size={16} />}
                  label="Email & password"
                  status={identities?.hasPassword ? 'Active' : 'Not set'}
                  statusActive={!!identities?.hasPassword}
                  action={
                    identities?.hasPassword ? (
                      <a href="/forgot-password" style={secondaryButtonStyle(false)}>
                        Reset password
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setShowSetPassword((v) => !v);
                          setPasswordError(null);
                          setNewPassword('');
                          setConfirmPassword('');
                        }}
                        style={primaryLinkButtonStyle()}
                      >
                        {showSetPassword ? 'Cancel' : 'Set password'}
                      </button>
                    )
                  }
                />
                {showSetPassword && !identities?.hasPassword && (
                  <form
                    onSubmit={handleSetPassword}
                    style={{
                      marginTop: 12,
                      padding: 16,
                      borderRadius: 12,
                      border: `1px solid ${C.border}`,
                      background: 'var(--bg-active)',
                      display: 'grid',
                      gap: 12,
                    }}
                  >
                    <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
                      Add a password so you can sign in with your email in addition to your linked provider.
                      Your existing sign-in methods will keep working.
                    </p>
                    <label style={{ display: 'block', fontSize: 13 }}>
                      <span style={{ color: C.muted, display: 'block', marginBottom: 4 }}>New password</span>
                      <input
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        style={{
                          width: '100%',
                          background: 'var(--color-surface)',
                          border: `1px solid ${C.border}`,
                          color: C.light,
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 14,
                        }}
                      />
                    </label>
                    <label style={{ display: 'block', fontSize: 13 }}>
                      <span style={{ color: C.muted, display: 'block', marginBottom: 4 }}>Confirm new password</span>
                      <input
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        autoComplete="new-password"
                        required
                        minLength={PASSWORD_MIN_LENGTH}
                        style={{
                          width: '100%',
                          background: 'var(--color-surface)',
                          border: `1px solid ${C.border}`,
                          color: C.light,
                          borderRadius: 8,
                          padding: '8px 10px',
                          fontSize: 14,
                        }}
                      />
                    </label>
                    <p style={{ margin: 0, color: C.muted, fontSize: 12 }}>
                      Must be at least {PASSWORD_MIN_LENGTH} characters.
                    </p>
                    {passwordError && (
                      <p style={{ margin: 0, color: 'var(--color-bear)', fontSize: 13, fontWeight: 600 }}>
                        {passwordError}
                      </p>
                    )}
                    <div>
                      <button
                        type="submit"
                        disabled={settingPassword}
                        style={{
                          ...primaryLinkButtonStyle(),
                          opacity: settingPassword ? 0.6 : 1,
                          cursor: settingPassword ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {settingPassword ? 'Saving…' : 'Save password'}
                      </button>
                    </div>
                  </form>
                )}
              </div>
              <SignInMethodRow
                icon={<Link2 size={16} />}
                label="Google"
                status={identities?.identities.some((i) => i.provider === 'google') ? 'Connected' : 'Not connected'}
                statusActive={!!identities?.identities.some((i) => i.provider === 'google')}
                action={
                  identities?.identities.some((i) => i.provider === 'google') ? (
                    <button
                      type="button"
                      onClick={() => handleUnlink('google')}
                      disabled={unlinkingProvider === 'google'}
                      style={secondaryButtonStyle(unlinkingProvider === 'google')}
                    >
                      {unlinkingProvider === 'google' ? 'Disconnecting…' : 'Disconnect'}
                    </button>
                  ) : (
                    <a href="/api/auth/oauth/google/start?intent=link" style={primaryLinkButtonStyle()}>
                      Connect
                    </a>
                  )
                }
              />
              <SignInMethodRow
                icon={<Link2 size={16} />}
                label="Apple"
                status="Coming soon"
                statusActive={false}
                action={
                  <span style={secondaryButtonStyle(true)} aria-disabled="true">
                    Connect
                  </span>
                }
              />
            </div>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light }}>Subscription</h2>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            Update payment methods, switch plans, or cancel your subscription in the secure Stripe billing portal. Tier changes on paid plans are pro-rated automatically. Switching plans during your free trial ends the trial and starts billing immediately on the new plan.
          </p>
          <button
            type="button"
            onClick={handleManageSubscription}
            disabled={!canManageBilling || opening}
            style={{
              background:
                'linear-gradient(135deg, var(--color-brand-primary) 0%, var(--heat-mid) 100%)',
              border: 'none',
              color: 'var(--text-inverse)',
              borderRadius: 10,
              padding: '10px 18px',
              fontWeight: 800,
              fontSize: 14,
              cursor: canManageBilling && !opening ? 'pointer' : 'not-allowed',
              opacity: canManageBilling && !opening ? 1 : 0.5,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              boxShadow: '0 6px 20px var(--color-brand-primary-soft, rgba(245,180,0,0.25))',
            }}
          >
            <Settings size={16} /> {opening ? 'Opening portal…' : 'Manage Subscription'}
          </button>
        </section>

        {referral?.enabled && referral.link && (
          <section style={{ marginTop: 24 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: C.light, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Gift size={18} /> Refer a friend
            </h2>
            <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
              Share your link. Your friend gets their first month free (or 10% off their first year on annual),
              and you earn a free month every time a referral subscribes.
            </p>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 14px',
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: 'var(--bg-active)',
              }}
            >
              <input
                readOnly
                value={referral.link}
                onFocus={(e) => e.currentTarget.select()}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  color: C.light,
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                  minWidth: 0,
                }}
              />
              <button
                type="button"
                onClick={handleCopyReferral}
                style={{
                  ...primaryLinkButtonStyle(),
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                <Copy size={14} /> {referralCopied ? 'Copied!' : 'Copy link'}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              <ReferralStat label="Signed up" value={referral.totalSignups ?? 0} />
              <ReferralStat label="Subscribed" value={referral.totalConverted ?? 0} />
              <ReferralStat label="Free months earned" value={referral.monthsEarned ?? 0} />
              {(referral.bankedMonths ?? 0) > 0 && (
                <ReferralStat label="Months banked" value={referral.bankedMonths ?? 0} />
              )}
            </div>
            {referral.creditOnNextBill && (
              <div
                style={{
                  marginTop: 14,
                  padding: '12px 16px',
                  borderRadius: 12,
                  border: '1px solid var(--color-bull)',
                  background: 'var(--color-bull-soft)',
                  color: 'var(--color-bull)',
                  fontSize: 14,
                  fontWeight: 700,
                }}
              >
                {referral.creditOnNextBill} credit will be applied to your next bill.
              </div>
            )}
            {(referral.bankedMonths ?? 0) > 0 && (
              <p style={{ margin: '10px 0 0', color: C.muted, fontSize: 13 }}>
                Banked months are applied automatically as account credit the next time you subscribe.
              </p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function ReferralStat({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        flex: '1 1 120px',
        minWidth: 120,
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'var(--bg-active)',
      }}
    >
      <div style={{ fontSize: 24, fontWeight: 800, color: C.light }}>{value}</div>
      <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SignInMethodRow({
  icon,
  label,
  status,
  statusActive,
  action,
}: {
  icon: React.ReactNode;
  label: string;
  status: string;
  statusActive: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '14px 16px',
        borderRadius: 12,
        border: `1px solid ${C.border}`,
        background: 'var(--bg-active)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ color: C.muted }}>{icon}</span>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, color: C.light }}>{label}</div>
          <div style={{ fontSize: 12, color: statusActive ? 'var(--color-bull)' : C.muted, marginTop: 2 }}>{status}</div>
        </div>
      </div>
      {action}
    </div>
  );
}

function secondaryButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'transparent',
    border: `1px solid ${C.border}`,
    color: C.light,
    borderRadius: 10,
    padding: '8px 14px',
    fontWeight: 700,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    textDecoration: 'none',
    display: 'inline-block',
  };
}

function primaryLinkButtonStyle(): React.CSSProperties {
  return {
    background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
    border: 'none',
    borderRadius: 10,
    padding: '8px 14px',
    color: 'var(--text-inverse)',
    fontWeight: 800,
    fontSize: 13,
    cursor: 'pointer',
    textDecoration: 'none',
    display: 'inline-block',
  };
}
