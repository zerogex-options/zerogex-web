'use client';

import { FormEvent, Suspense, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Award, Bell, CreditCard, Copy, Fingerprint, Gift, KeyRound, Link2, Mail, Rocket, Settings, ShieldCheck, Trash2 } from 'lucide-react';
import { AUTH_TIERS, normalizeTier, TierId } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import AccountApiKeys from '@/components/AccountApiKeys';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';

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

type BillingStatusPayload = {
  status: string | null;
  hasSubscription: boolean;
  paymentIssue: boolean;
  currentPeriodEnd: string | null;
};

const PASSWORD_MIN_LENGTH = 12;

// Type-to-confirm guard word for account deletion. Kept as a fixed token (not
// translated) so the confirmation is unambiguous regardless of UI language.
const DELETE_CONFIRM_WORD = 'DELETE';

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
  const t = usePageT(dict);
  return (
    <Suspense
      fallback={
        <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
          <p style={{ color: C.muted }}>{t('loadingAccount')}</p>
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
  const t = usePageT(dict);
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
  // Ambassador entry point — shown ONLY to ambassadors so the normal subscriber
  // dashboard isn't overloaded with program information they don't have.
  const [ambassador, setAmbassador] = useState<{ isAmbassador: boolean; status?: string } | null>(null);
  const [billing, setBilling] = useState<BillingStatusPayload | null>(null);
  const [donation, setDonation] = useState<DonationPayload | null>(null);
  // X/Twitter handle. `xHandle` is the input value (without the leading @);
  // `xHandleSaved` is the persisted value the server confirmed (null when unset).
  const [xHandle, setXHandle] = useState('');
  const [xHandleSaved, setXHandleSaved] = useState<string | null>(null);
  const [xHandleLoading, setXHandleLoading] = useState(true);
  const [savingXHandle, setSavingXHandle] = useState(false);
  const [xHandleError, setXHandleError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

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

  useEffect(() => {
    if (!authSession?.authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/billing/status', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as BillingStatusPayload;
        if (!cancelled) setBilling(data);
      } catch {
        /* billing-status banner is non-critical; silently skip on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authSession?.authenticated]);

  useEffect(() => {
    if (!authSession?.authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/account/ambassador', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as {
          enabled: boolean;
          isAmbassador?: boolean;
          dashboard?: { status?: string };
        };
        if (!cancelled && data.enabled && data.isAmbassador) {
          setAmbassador({ isAmbassador: true, status: data.dashboard?.status });
        }
      } catch {
        /* ambassador card is non-critical; silently skip on failure */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authSession?.authenticated]);

  useEffect(() => {
    if (!authSession?.authenticated) return;
    let cancelled = false;
    (async () => {
      setXHandleLoading(true);
      try {
        const response = await fetch('/api/account/social', { credentials: 'include' });
        if (!response.ok) return;
        const data = (await response.json()) as { xHandle: string | null };
        if (!cancelled) {
          setXHandleSaved(data.xHandle ?? null);
          setXHandle(data.xHandle ?? '');
        }
      } catch {
        /* social card is non-critical; silently skip on failure */
      } finally {
        if (!cancelled) setXHandleLoading(false);
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
      setFeedback({ type: 'error', message: t('couldNotCopyLink') });
    }
  };

  useEffect(() => {
    const link = searchParams?.get('link');
    if (link === 'success') {
      setFeedback({ type: 'success', message: t('providerLinked') });
    } else if (link === 'error') {
      const reason = searchParams?.get('reason');
      setFeedback({ type: 'error', message: reason ? decodeURIComponent(reason) : t('couldNotLinkProvider') });
    }
  }, [searchParams, t]);

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
      setPasswordError(t('passwordMinLength', { min: PASSWORD_MIN_LENGTH }));
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError(t('passwordsDoNotMatch'));
      return;
    }

    setSettingPassword(true);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setPasswordError(t('csrfError'));
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
        setPasswordError(payload.error ?? t('failedToSetPassword'));
        return;
      }
      setFeedback({ type: 'success', message: t('passwordSetSuccess') });
      setShowSetPassword(false);
      setNewPassword('');
      setConfirmPassword('');
      await refreshIdentities();
    } catch {
      setPasswordError(t('somethingWentWrong'));
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
        setFeedback({ type: 'error', message: t('csrfError') });
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
        setFeedback({ type: 'error', message: payload.error ?? t('failedToUnlinkProvider') });
        return;
      }
      setFeedback({ type: 'success', message: t('disconnectedProvider', { provider }) });
      await refreshIdentities();
    } catch {
      setFeedback({ type: 'error', message: t('somethingWentWrong') });
    } finally {
      setUnlinkingProvider(null);
    }
  };

  const handleSaveXHandle = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setXHandleError(null);
    setSavingXHandle(true);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setXHandleError(t('csrfError'));
        return;
      }
      const response = await fetch('/api/account/social', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ xHandle: xHandle.trim() }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        xHandle?: string | null;
        error?: string;
      };
      if (!response.ok) {
        setXHandleError(payload.error ?? t('failedToSaveXHandle'));
        return;
      }
      const saved = payload.xHandle ?? null;
      setXHandleSaved(saved);
      setXHandle(saved ?? '');
      setFeedback({ type: 'success', message: saved ? t('xHandleSaved') : t('xHandleRemoved') });
    } catch {
      setXHandleError(t('somethingWentWrong'));
    } finally {
      setSavingXHandle(false);
    }
  };

  const tier = useMemo(() => normalizeTier(authSession?.user?.tier), [authSession?.user?.tier]);
  const email = authSession?.user?.email ?? '';
  const tierLabel = TIER_LABELS[tier] ?? 'Public';
  const canUpgrade = tier !== 'pro' && tier !== 'admin';
  const hasActiveSubscription = !!authSession?.user?.hasActiveSubscription;
  // Also allow anyone with a Stripe subscription on file — a customer whose
  // first charge failed sits at tier=public but has stripe_subscription_id
  // set, and the billing portal is precisely where they update the card that
  // got declined. Gating on tier alone would lock them out of the fix.
  const canManageBilling = tier !== 'admin' && (tier !== 'public' || hasActiveSubscription);

  const handleManageSubscription = async () => {
    setOpening(true);
    setFeedback(null);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setFeedback({ type: 'error', message: t('csrfError') });
        return;
      }

      const response = await fetch('/api/billing/portal', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken },
        credentials: 'include',
      });
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        setFeedback({ type: 'error', message: payload.error ?? t('couldNotOpenBillingPortal') });
        return;
      }

      window.location.href = payload.url;
    } catch {
      setFeedback({ type: 'error', message: t('somethingWentWrong') });
    } finally {
      setOpening(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleteError(null);
    setDeletingAccount(true);
    try {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        setDeleteError(t('csrfError'));
        return;
      }
      const response = await fetch('/api/account/delete', {
        method: 'POST',
        headers: { 'x-csrf-token': csrf.csrfToken, 'Content-Type': 'application/json' },
        credentials: 'include',
      });
      const payload = (await response.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!response.ok) {
        setDeleteError(payload.error ?? t('deleteAccountFailed'));
        return;
      }
      // Full navigation (not router.push) so the cleared session cookie and the
      // in-memory auth store both reset — a soft-routed transition would keep
      // the stale "authenticated" state around.
      window.location.href = '/?account_deleted=1';
    } catch {
      setDeleteError(t('somethingWentWrong'));
    } finally {
      setDeletingAccount(false);
    }
  };

  if (loading) {
    return (
      <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
        <p style={{ color: C.muted }}>{t('loadingAccount')}</p>
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
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800 }}>{t('accountTitle')}</h1>
          <p style={{ marginTop: 12, color: C.muted }}>
            {t('signInRequired')}
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
            {t('signIn')}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main style={{ minHeight: '100vh', padding: '48px 24px', color: C.light }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <header style={{ marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, letterSpacing: '-0.5px' }}>{t('accountTitle')}</h1>
          <p style={{ margin: '8px 0 0', color: C.muted, fontSize: 15 }}>
            {t('accountSubtitle')}
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
                width: 44, height: 44, borderRadius: '50%',
                background: '#ffffff', border: `1px solid ${C.amber}55`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                padding: 3,
              }}
            >
              <Image
                src="/folds-of-honor-proud-supporter.png"
                alt=""
                width={38}
                height={38}
                style={{ width: 38, height: 38, objectFit: 'contain' }}
              />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 4 }}>
                {t('donationWelcome')}
              </div>
              <div style={{ fontSize: 13.5, color: C.muted, lineHeight: 1.55 }}>
                {t('donationContributedPrefix')}{' '}
                <strong style={{ color: C.amber }}>
                  ${donation.donationUsd.toFixed(2)}
                </strong>{' '}
                {t('donationContributedTo')} <strong style={{ color: C.light }}>{donation.partner}</strong>{' '}
                {t('donationContributedSuffix', {
                  pct: donation.pledgePct,
                  interval: donation.interval === 'year' ? t('donationIntervalAnnual') : t('donationIntervalMonthly'),
                })}{' '}
                <Link href="/giving" style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}>
                  {t('seeGivingPage')}
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

        {authSession.user?.emailVerified === false && authSession.user?.email && (
          <VerifyEmailBanner email={authSession.user.email} />
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
                <Mail size={14} /> {t('accountName')}
              </div>
              <div style={{ marginTop: 8, fontSize: 20, fontWeight: 700, color: C.light, wordBreak: 'break-all' }}>{email}</div>
            </div>

            <div style={{ height: 1, background: C.border }} />

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: C.muted, fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                <ShieldCheck size={14} /> {t('tier')}
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
                    <Rocket size={14} /> {t('upgrade')}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        <section style={{ marginTop: 24 }}>
          <SectionHeading icon={<CreditCard size={18} />}>{t('subscription')}</SectionHeading>
          {billing?.paymentIssue && (
            <div
              role="alert"
              style={{
                margin: '6px 0 14px',
                borderRadius: 12,
                padding: '12px 16px',
                fontSize: 14,
                fontWeight: 600,
                border: '1px solid var(--color-bear)',
                color: 'var(--color-bear)',
                background: 'var(--color-bear-soft)',
              }}
            >
              {t('paymentIssueWarning')}
            </div>
          )}
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            {t('billingDescription')}
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
            <Settings size={16} />{' '}
            {opening
              ? t('openingPortal')
              : billing?.paymentIssue
                ? t('updatePaymentMethod')
                : t('manageSubscription')}
          </button>
          {!canManageBilling && tier === 'public' && (
            <p style={{ margin: '10px 0 0', color: C.muted, fontSize: 13 }}>
              {t('noActiveSubscription')}{' '}
              <Link href="/pricing" style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}>
                {t('pricingPage')}
              </Link>{' '}
              {t('toGetStarted')}
            </p>
          )}
        </section>

        <AccountApiKeys />

        <section style={{ marginTop: 24 }}>
          <SectionHeading icon={<Fingerprint size={18} />}>{t('signInMethods')}</SectionHeading>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            {t('signInMethodsDescription')}
          </p>
          {identitiesLoading ? (
            <p style={{ color: C.muted, fontSize: 14 }}>{t('loadingSignInMethods')}</p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              <div>
                <SignInMethodRow
                  icon={<KeyRound size={16} />}
                  label={t('emailPassword')}
                  status={identities?.hasPassword ? t('active') : t('notSet')}
                  statusActive={!!identities?.hasPassword}
                  action={
                    identities?.hasPassword ? (
                      <a href="/forgot-password" style={secondaryButtonStyle(false)}>
                        {t('resetPassword')}
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
                        {showSetPassword ? t('cancel') : t('setPassword')}
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
                      {t('setPasswordDescription')}
                    </p>
                    <label style={{ display: 'block', fontSize: 13 }}>
                      <span style={{ color: C.muted, display: 'block', marginBottom: 4 }}>{t('newPassword')}</span>
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
                      <span style={{ color: C.muted, display: 'block', marginBottom: 4 }}>{t('confirmNewPassword')}</span>
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
                      {t('passwordMinCharacters', { min: PASSWORD_MIN_LENGTH })}
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
                        {settingPassword ? t('saving') : t('savePassword')}
                      </button>
                    </div>
                  </form>
                )}
              </div>
              <SignInMethodRow
                icon={<Link2 size={16} />}
                label={t('google')}
                status={identities?.identities.some((i) => i.provider === 'google') ? t('connected') : t('notConnected')}
                statusActive={!!identities?.identities.some((i) => i.provider === 'google')}
                action={
                  identities?.identities.some((i) => i.provider === 'google') ? (
                    <button
                      type="button"
                      onClick={() => handleUnlink('google')}
                      disabled={unlinkingProvider === 'google'}
                      style={secondaryButtonStyle(unlinkingProvider === 'google')}
                    >
                      {unlinkingProvider === 'google' ? t('disconnecting') : t('disconnect')}
                    </button>
                  ) : (
                    <a href="/api/auth/oauth/google/start?intent=link" style={primaryLinkButtonStyle()}>
                      {t('connect')}
                    </a>
                  )
                }
              />
              <SignInMethodRow
                icon={<Link2 size={16} />}
                label={t('apple')}
                status={t('comingSoon')}
                statusActive={false}
                action={
                  <span style={secondaryButtonStyle(true)} aria-disabled="true">
                    {t('connect')}
                  </span>
                }
              />
            </div>
          )}
        </section>

        <section style={{ marginTop: 24 }}>
          <SectionHeading icon={<Bell size={18} />}>{t('notifications')}</SectionHeading>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            {t('notificationsDescription')}
          </p>
          <Link
            href="/account/notifications"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 16px',
              borderRadius: 10,
              background: 'var(--color-info)',
              color: 'var(--color-on-info, #ffffff)',
              fontWeight: 700,
              fontSize: 13,
              textDecoration: 'none',
            }}
          >
            <Bell size={14} /> {t('manageNotifications')}
          </Link>
        </section>

        <section style={{ marginTop: 24 }}>
          <SectionHeading icon={<XLogo size={16} />}>{t('socialMedia')}</SectionHeading>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            {t('socialMediaDescription')}
          </p>
          {xHandleLoading ? (
            <p style={{ color: C.muted, fontSize: 14 }}>{t('loading')}</p>
          ) : (
            <form onSubmit={handleSaveXHandle} style={{ display: 'grid', gap: 12 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '12px 14px',
                  borderRadius: 12,
                  border: `1px solid ${C.border}`,
                  background: 'var(--bg-active)',
                }}
              >
                <span style={{ color: C.muted, display: 'inline-flex', alignItems: 'center' }}>
                  <XLogo size={16} />
                </span>
                <span style={{ color: C.muted, fontSize: 15, fontWeight: 700 }}>@</span>
                <input
                  value={xHandle}
                  onChange={(e) => {
                    setXHandle(e.target.value.replace(/^@+/, ''));
                    setXHandleError(null);
                  }}
                  placeholder={t('xHandlePlaceholder')}
                  maxLength={15}
                  autoComplete="off"
                  spellCheck={false}
                  aria-label={t('xHandleAriaLabel')}
                  style={{
                    flex: 1,
                    background: 'transparent',
                    border: 'none',
                    color: C.light,
                    fontSize: 15,
                    fontWeight: 600,
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
                <button
                  type="submit"
                  disabled={savingXHandle || xHandle.trim() === (xHandleSaved ?? '')}
                  style={{
                    ...primaryLinkButtonStyle(),
                    whiteSpace: 'nowrap',
                    opacity: savingXHandle || xHandle.trim() === (xHandleSaved ?? '') ? 0.6 : 1,
                    cursor:
                      savingXHandle || xHandle.trim() === (xHandleSaved ?? '')
                        ? 'not-allowed'
                        : 'pointer',
                  }}
                >
                  {savingXHandle ? t('saving') : t('save')}
                </button>
              </div>
              {xHandleError && (
                <p style={{ margin: 0, color: 'var(--color-bear)', fontSize: 13, fontWeight: 600 }}>
                  {xHandleError}
                </p>
              )}
              {xHandleSaved ? (
                <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
                  {t('connectedAs')}{' '}
                  <a
                    href={`https://x.com/${xHandleSaved}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: C.amber, fontWeight: 700, textDecoration: 'none' }}
                  >
                    @{xHandleSaved}
                  </a>
                  {t('clearFieldToRemove')}
                </p>
              ) : (
                <p style={{ margin: 0, color: C.muted, fontSize: 13 }}>
                  {t('xHandleHelper')}
                </p>
              )}
            </form>
          )}
        </section>

        {referral?.enabled && referral.link && (
          <section style={{ marginTop: 24 }}>
            <SectionHeading icon={<Gift size={18} />}>{t('referAFriend')}</SectionHeading>
            <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
              {t('referralDescription')}
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
                <Copy size={14} /> {referralCopied ? t('copied') : t('copyLink')}
              </button>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 14 }}>
              <ReferralStat label={t('signedUp')} value={referral.totalSignups ?? 0} />
              <ReferralStat label={t('subscribed')} value={referral.totalConverted ?? 0} />
              <ReferralStat label={t('freeMonthsEarned')} value={referral.monthsEarned ?? 0} />
              {(referral.bankedMonths ?? 0) > 0 && (
                <ReferralStat label={t('monthsBanked')} value={referral.bankedMonths ?? 0} />
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
                {t('creditAppliedToNextBill', { credit: referral.creditOnNextBill })}
              </div>
            )}
            {(referral.bankedMonths ?? 0) > 0 && (
              <p style={{ margin: '10px 0 0', color: C.muted, fontSize: 13 }}>
                {t('bankedMonthsAutoApplied')}
              </p>
            )}
          </section>
        )}

        {ambassador?.isAmbassador && (
          <section style={{ marginTop: 24 }}>
            <SectionHeading icon={<Award size={18} />}>ZeroGEX Ambassador</SectionHeading>
            <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
              {ambassador.status === 'invited'
                ? "You've been invited to the ZeroGEX Ambassador Program. Review the terms and activate your account."
                : 'Manage your referral link, reward preference, and earnings.'}
            </p>
            <Link
              href="/account/ambassador"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 18px',
                borderRadius: 10,
                background: `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)`,
                color: 'var(--text-inverse)',
                fontWeight: 800,
                fontSize: 13,
                textDecoration: 'none',
              }}
            >
              <Award size={14} />{' '}
              {ambassador.status === 'invited' ? 'Review invitation' : 'Open ambassador dashboard'}
            </Link>
          </section>
        )}

        <section id="delete-account" style={{ marginTop: 24 }}>
          <SectionHeading icon={<Trash2 size={18} />}>{t('dangerZoneTitle')}</SectionHeading>
          <p style={{ margin: '6px 0 14px', color: C.muted, fontSize: 14 }}>
            {t('deleteAccountDescription')}
          </p>
          {!showDeleteConfirm ? (
            <button
              type="button"
              onClick={() => {
                setShowDeleteConfirm(true);
                setDeleteError(null);
                setDeleteConfirmText('');
              }}
              style={destructiveButtonStyle(false)}
            >
              {t('deleteAccountButton')}
            </button>
          ) : (
            <div
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                border: '1px solid var(--color-bear)',
                background: 'var(--color-bear-soft)',
              }}
            >
              <p style={{ margin: '0 0 8px', color: C.light, fontSize: 14, fontWeight: 700 }}>
                {t('deleteAccountConfirmTitle')}
              </p>
              <p style={{ margin: '0 0 12px', color: C.muted, fontSize: 13 }}>
                {t('deleteAccountConfirmBody', { word: DELETE_CONFIRM_WORD })}
              </p>
              <input
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder={DELETE_CONFIRM_WORD}
                aria-label={t('deleteAccountConfirmAria')}
                autoComplete="off"
                style={{
                  width: '100%',
                  maxWidth: 260,
                  padding: '9px 12px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: 'var(--color-surface)',
                  color: C.light,
                  fontSize: 14,
                  fontWeight: 600,
                  outline: 'none',
                }}
              />
              <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={
                    deletingAccount ||
                    deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD
                  }
                  onClick={handleDeleteAccount}
                  style={destructiveButtonStyle(
                    deletingAccount ||
                      deleteConfirmText.trim().toUpperCase() !== DELETE_CONFIRM_WORD,
                  )}
                >
                  {deletingAccount ? t('deletingAccount') : t('deleteAccountConfirmButton')}
                </button>
                <button
                  type="button"
                  disabled={deletingAccount}
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteConfirmText('');
                    setDeleteError(null);
                  }}
                  style={secondaryButtonStyle(deletingAccount)}
                >
                  {t('cancel')}
                </button>
              </div>
              {deleteError && (
                <p style={{ margin: '10px 0 0', color: 'var(--color-bear)', fontSize: 13 }}>
                  {deleteError}
                </p>
              )}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function destructiveButtonStyle(disabled: boolean): React.CSSProperties {
  return {
    background: 'var(--color-bear)',
    border: '1px solid var(--color-bear)',
    color: 'var(--text-inverse, #ffffff)',
    borderRadius: 10,
    padding: '9px 16px',
    fontWeight: 800,
    fontSize: 13,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
  };
}

function SectionHeading({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: 0,
        fontSize: 18,
        fontWeight: 800,
        color: C.light,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ display: 'inline-flex', alignItems: 'center', color: C.amber }}>{icon}</span>
      {children}
    </h2>
  );
}

// Inline X (formerly Twitter) logo. lucide-react dropped brand glyphs, so we
// render the official mark ourselves. Uses currentColor + a size prop so it
// matches the lucide icons used elsewhere on this page.
function XLogo({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
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
