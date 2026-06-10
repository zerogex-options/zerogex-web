'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import { useTheme } from '@/core/ThemeContext';
import { normalizeTier, TierId } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';
import { ArrowRight, CheckCircle2, Loader2, Moon, Sparkles, Sun } from 'lucide-react';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

type Cadence = 'monthly' | 'annual';
type BillableTier = 'basic' | 'pro';

// Display mirror of TRIAL_PERIOD_DAYS in
// frontend/app/api/billing/checkout/route.ts. Keep in sync — the server is
// the source of truth for what Stripe actually does.
const TRIAL_DAYS = 7;

// Display-only pricing. Source of truth for what Stripe actually charges is
// the price IDs configured in env; if those drift from these numbers the UI
// will show stale prices until this constant is updated.
const DISPLAY = {
  basic: {
    monthly: { rack: 39, promo: 24, founding: 12 },
    annual: { rack: 199, perMonth: 16.58, savingsPct: 57 },
  },
  pro: {
    monthly: { rack: 59, promo: 39, founding: 19 },
    annual: { rack: 299, perMonth: 24.92, savingsPct: 58 },
  },
} as const;

type Props = {
  promoActive: boolean;
  referralEnabled: boolean;
};

type TierAction =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'subscribe'; tier: BillableTier; label: string }
  | { kind: 'portal'; label: string }
  | { kind: 'current'; label: string };

function formatMoney(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function CtaButton({
  action,
  busy,
  accent,
  onSubscribe,
  onPortal,
}: {
  action: TierAction;
  busy: boolean;
  accent: string;
  onSubscribe: (tier: BillableTier) => void;
  onPortal: () => void;
}) {
  const baseStyle = {
    marginTop: 22,
    width: '100%',
    border: 'none',
    borderRadius: 12,
    padding: '12px 18px',
    fontSize: 14,
    fontWeight: 800,
    cursor: 'pointer',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    color: 'var(--text-inverse)',
    background: `linear-gradient(135deg, ${accent} 0%, var(--heat-mid) 100%)`,
  } as const;

  if (action.kind === 'current') {
    return (
      <button
        type="button"
        disabled
        style={{
          ...baseStyle,
          background: 'transparent',
          color: C.muted,
          border: `1px solid ${C.border}`,
          cursor: 'default',
        }}
      >
        {action.label}
      </button>
    );
  }

  if (action.kind === 'link') {
    return (
      <Link href={action.href} style={{ textDecoration: 'none', display: 'block' }}>
        <span style={baseStyle as React.CSSProperties}>
          {action.label} <ArrowRight size={16} />
        </span>
      </Link>
    );
  }

  const handleClick = () => {
    if (busy) return;
    if (action.kind === 'subscribe') onSubscribe(action.tier);
    else onPortal();
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      style={{ ...baseStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : action.label}
      {!busy && action.kind === 'subscribe' && <ArrowRight size={16} />}
    </button>
  );
}

function PriceDisplay({
  cadence,
  tier,
  promoActive,
}: {
  cadence: Cadence;
  tier: BillableTier;
  promoActive: boolean;
}) {
  if (cadence === 'annual') {
    const { rack, perMonth } = DISPLAY[tier].annual;
    return (
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
          <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>
            {formatMoney(rack)}
          </span>
          <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/year</span>
        </div>
        <div style={{ marginTop: 4, fontSize: 13, color: C.muted }}>
          ≈ {formatMoney(perMonth)}/mo, billed annually
        </div>
      </div>
    );
  }
  const { rack, promo } = DISPLAY[tier].monthly;
  if (promoActive) {
    return (
      <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10 }}>
        <span style={{ fontSize: 20, color: C.muted, textDecoration: 'line-through' }}>
          {formatMoney(rack)}
        </span>
        <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>
          {formatMoney(promo)}
        </span>
        <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/mo</span>
      </div>
    );
  }
  return (
    <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>
        {formatMoney(rack)}
      </span>
      <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/mo</span>
    </div>
  );
}

function Badge({ children, accent }: { children: React.ReactNode; accent: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.12em',
        textTransform: 'uppercase',
        border: `1px solid ${accent}66`,
        color: accent,
        borderRadius: 999,
        padding: '4px 10px',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function TierCard({
  title,
  tier,
  cadence,
  promoActive,
  highlights,
  features,
  accent,
  action,
  busy,
  onSubscribe,
  onPortal,
}: {
  title: string;
  tier: BillableTier;
  cadence: Cadence;
  promoActive: boolean;
  highlights: string[];
  features: string[];
  accent: string;
  action: TierAction;
  busy: boolean;
  onSubscribe: (tier: BillableTier) => void;
  onPortal: () => void;
}) {
  return (
    <article
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${accent}66`,
        borderRadius: 18,
        padding: 28,
        boxShadow: `0 12px 40px ${accent}20`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.light }}>{title}</h3>
        {highlights.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {highlights.map((h) => (
              <Badge key={h} accent={accent}>
                {h}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <PriceDisplay cadence={cadence} tier={tier} promoActive={promoActive} />

      <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
        {TRIAL_DAYS}-day free trial — cancel anytime before it ends and you won&rsquo;t be charged.
      </p>

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 12, flex: 1 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55 }}>
            <CheckCircle2 size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>

      <CtaButton action={action} busy={busy} accent={accent} onSubscribe={onSubscribe} onPortal={onPortal} />
    </article>
  );
}

function CadenceToggle({
  cadence,
  setCadence,
}: {
  cadence: Cadence;
  setCadence: (c: Cadence) => void;
}) {
  const btn = (active: boolean) =>
    ({
      flex: 1,
      padding: '10px 18px',
      border: 'none',
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 800,
      letterSpacing: '0.04em',
      cursor: 'pointer',
      color: active ? 'var(--text-inverse)' : C.muted,
      background: active ? `linear-gradient(135deg, ${C.amber} 0%, var(--heat-mid) 100%)` : 'transparent',
      transition: 'all 0.18s ease',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
    }) as const;

  return (
    <div
      style={{
        display: 'inline-flex',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: 'var(--bg-hover)',
        border: `1px solid ${C.border}`,
      }}
    >
      <button type="button" style={btn(cadence === 'monthly')} onClick={() => setCadence('monthly')}>
        Monthly
      </button>
      <button type="button" style={btn(cadence === 'annual')} onClick={() => setCadence('annual')}>
        Annual
        <span
          style={{
            fontSize: 10,
            fontWeight: 800,
            padding: '2px 6px',
            borderRadius: 999,
            background: cadence === 'annual' ? 'rgba(255,255,255,0.22)' : `${C.amber}22`,
            color: cadence === 'annual' ? 'var(--text-inverse)' : C.amber,
          }}
        >
          SAVE 57%
        </span>
      </button>
    </div>
  );
}

// useSearchParams() forces this subtree out of static rendering, so wrap the
// inner body in Suspense at the top level. Matches the pattern used by
// /register and /reset-password.
export default function PricingClient(props: Props) {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} />}>
      <PricingClientInner {...props} />
    </Suspense>
  );
}

function PricingClientInner({ promoActive: serverPromoActive, referralEnabled }: Props) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isDark = theme === 'dark';
  const { data: authSession, loading: authLoading, refresh: refreshSession } = useAuthSession();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A referred visitor carries the zgx_ref cookie set when they landed on the
  // ?ref= link; surface a reminder that their discount applies at checkout.
  // Lazily derived (no effect) — this subtree is client-rendered (it bails out
  // of SSR via useSearchParams), so reading document.cookie here is safe.
  const [hasRefCookie] = useState(
    () => typeof document !== 'undefined' && /(?:^|;\s*)zgx_ref=/.test(document.cookie),
  );
  // Only promise a discount when the program is actually live.
  const referralPresent = hasRefCookie && referralEnabled;

  // Derived (not stored) from ?verified=1 / ?verify_error=… so we don't have
  // to setState inside an effect. If the user reloads the page, the param
  // is still present and the banner re-renders — that's the correct read
  // (verified state hasn't regressed; an invalid link is still invalid).
  const verifyNotice = useMemo<{ kind: 'success' | 'error'; message: string } | null>(() => {
    if (searchParams.get('verified') === '1') {
      return { kind: 'success', message: 'Email verified! You can now subscribe.' };
    }
    const verifyError = searchParams.get('verify_error');
    if (verifyError === 'expired') {
      return {
        kind: 'error',
        message: 'That verification link has expired. Use Resend below to get a new one.',
      };
    }
    if (verifyError === 'invalid') {
      return {
        kind: 'error',
        message: 'That verification link is no longer valid. Use Resend below to get a new one.',
      };
    }
    return null;
  }, [searchParams]);

  // When the user lands here from the verify-email redirect, their session
  // was minted BEFORE email_verified_at was stamped — so emailVerified is
  // still false in the cached payload. Refresh once so the resend banner
  // disappears alongside the success notice.
  useEffect(() => {
    if (verifyNotice?.kind === 'success') void refreshSession();
  }, [verifyNotice, refreshSession]);

  const currentTier: TierId = useMemo(
    () => normalizeTier(authSession?.user?.tier),
    [authSession?.user?.tier],
  );
  const isAuthed = !!authSession?.authenticated;
  // True only when there's an actual Stripe subscription on file. Grandfathered
  // tier=basic|pro users (without a Stripe sub) are false — so the CTA routes
  // to checkout (which works) instead of portal (which 400s on missing
  // stripe_customer_id).
  const hasActiveSubscription = !!authSession?.user?.hasActiveSubscription;
  // Banner only shows when we have a definitive false. While the session is
  // loading, emailVerified is undefined; rendering the banner then would
  // flash it for everyone on every pricing-page visit.
  const showVerifyBanner = isAuthed && authSession?.user?.emailVerified === false;

  // Server already gated PROMO_END_AT + coupon configuration; just AND with
  // the currently selected cadence (annual is never eligible per spec).
  const promoActive = serverPromoActive && cadence === 'monthly';

  const registerHref = '/register?next=/pricing';

  const callBilling = useCallback(
    async (path: '/api/billing/checkout' | '/api/billing/portal', body?: object) => {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        throw new Error('Could not obtain CSRF token. Refresh and try again.');
      }
      const response = await fetch(path, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/json',
          'x-csrf-token': csrf.csrfToken,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        code?: string;
        message?: string;
      };
      if (!response.ok || !payload.url) {
        const thrown = new Error(payload.message ?? payload.error ?? 'Billing request failed');
        if (payload.code) (thrown as Error & { code?: string }).code = payload.code;
        throw thrown;
      }
      window.location.href = payload.url;
    },
    [],
  );

  const handleSubscribe = useCallback(
    async (tier: BillableTier) => {
      if (!isAuthed) {
        router.push(registerHref);
        return;
      }
      if (currentTier === 'admin') {
        setError('Admin accounts cannot subscribe.');
        return;
      }
      setError(null);
      setBusyTier(tier);
      try {
        if (hasActiveSubscription) {
          await callBilling('/api/billing/portal');
        } else {
          await callBilling('/api/billing/checkout', { tier, cadence });
        }
      } catch (err) {
        const code = (err as Error & { code?: string })?.code;
        if (code === 'EMAIL_NOT_VERIFIED') {
          // Refresh in case verification just happened in another tab — if
          // it did, the banner above will be gone too and the user can retry.
          void refreshSession();
          setError('Please verify your email first — use the Resend button in the banner above.');
        } else {
          setError(err instanceof Error ? err.message : 'Something went wrong.');
        }
        setBusyTier(null);
      }
    },
    [callBilling, cadence, currentTier, hasActiveSubscription, isAuthed, refreshSession, router],
  );

  const handlePortal = useCallback(async () => {
    setError(null);
    setBusyTier('portal');
    try {
      await callBilling('/api/billing/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      setBusyTier(null);
    }
  }, [callBilling]);

  const actionFor = useCallback(
    (tier: BillableTier): TierAction => {
      const label = tier === 'basic' ? 'Basic' : 'Pro';
      const trialLabel = `Start ${TRIAL_DAYS}-day free trial`;
      if (authLoading) return { kind: 'link', href: registerHref, label: trialLabel };
      if (!isAuthed) {
        return { kind: 'link', href: registerHref, label: trialLabel };
      }
      if (currentTier === 'admin') return { kind: 'current', label: 'Admin (no subscription)' };

      if (hasActiveSubscription) {
        // Real subscriber: the tier truly reflects which plan they're on.
        if (currentTier === tier) return { kind: 'current', label: 'Current Plan' };
        return { kind: 'portal', label: `Switch to ${label}` };
      }

      // No active Stripe sub — public OR grandfathered. Either way, "Start
      // trial" is the only action that makes sense; portal would 400. The
      // server suppresses the trial for grandfathered users with prior paid
      // history, but they're rare enough that the label still reads true.
      return { kind: 'subscribe', tier, label: trialLabel };
    },
    [authLoading, currentTier, hasActiveSubscription, isAuthed],
  );

  const basicHighlights: string[] = [];
  if (promoActive) basicHighlights.push('Limited Time');
  if (cadence === 'annual') basicHighlights.push('Save 57%');

  const proHighlights: string[] = ['Most Popular'];
  if (promoActive) proHighlights.push('Limited Time');
  if (cadence === 'annual') proHighlights.push('Save 58%');

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      <nav
        className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-between px-4 sm:px-8 h-14 sm:h-16"
        style={{
          background: `${isDark ? 'var(--color-bg)' : 'var(--color-bg)'}ee`,
          borderBottom: `1px solid ${C.border}`,
          backdropFilter: 'blur(20px)',
        }}
      >
        <Link href="/" className="h-full flex items-center overflow-hidden flex-shrink-0" style={{ textDecoration: 'none', lineHeight: 0 }}>
          <img src="/title.svg" alt="ZeroGEX" className="h-[130%] sm:h-[150%] w-auto block" style={{ maxHeight: 'none', objectFit: 'contain' }} />
        </Link>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(isDark ? 'light' : 'dark')}
            className="w-8 h-8 sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-[10px]"
            style={{
              background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
              border: `1px solid ${C.border}`,
              cursor: 'pointer',
              color: C.muted,
            }}
          >
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <Link href="/about" style={{ textDecoration: 'none' }}>
            <button
              style={{
                background: isDark ? `${C.card}cc` : 'var(--bg-hover)',
                border: `1px solid ${C.border}`,
                borderRadius: 10,
                padding: '8px 14px',
                fontSize: 13,
                fontWeight: 700,
                color: C.light,
                cursor: 'pointer',
              }}
            >
              About
            </button>
          </Link>
        </div>
      </nav>

      <section style={{ minHeight: '100vh', padding: '120px 24px 84px', position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            backgroundImage: `
              linear-gradient(var(--border-subtle) 1px, transparent 1px),
              linear-gradient(90deg, var(--border-subtle) 1px, transparent 1px)
            `,
            backgroundSize: '62px 62px',
            pointerEvents: 'none',
          }}
        />
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: C.amber,
                border: `1px solid ${C.amber}55`,
                borderRadius: 999,
                background: `${C.amber}12`,
                padding: '5px 14px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              <Sparkles size={14} /> Pricing
            </div>
            <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
              Choose Your Plan
            </h1>
            <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 18, lineHeight: 1.7 }}>
              Every plan starts with a {TRIAL_DAYS}-day free trial — full access now, no charge until day {TRIAL_DAYS}.
              Upgrades, downgrades, and cancellations are pro-rated automatically through the Stripe-hosted billing portal.
              Cancel anytime — no email or support request required.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <CadenceToggle cadence={cadence} setCadence={setCadence} />
          </div>

          {referralPresent && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--color-brand-primary)',
                color: 'var(--color-brand-primary)',
                background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.1))',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              🎉 A friend referred you — your discount is applied automatically at checkout.
            </div>
          )}

          {verifyNotice && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 12,
                border: `1px solid var(${verifyNotice.kind === 'success' ? '--color-bull' : '--color-bear'})`,
                color: `var(${verifyNotice.kind === 'success' ? '--color-bull' : '--color-bear'})`,
                background: `var(${verifyNotice.kind === 'success' ? '--color-bull-soft' : '--color-bear-soft'})`,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {verifyNotice.message}
            </div>
          )}

          {showVerifyBanner && authSession?.user?.email && (
            <VerifyEmailBanner email={authSession.user.email} />
          )}

          {error && (
            <div
              role="alert"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 12,
                border: '1px solid var(--color-bear)',
                color: 'var(--color-bear)',
                background: 'var(--color-bear-soft)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <TierCard
              title="Basic"
              tier="basic"
              cadence={cadence}
              promoActive={promoActive}
              highlights={basicHighlights}
              accent="var(--color-brand-primary)"
              features={[
                'Real-time metrics and full strategy tools.',
                'Access to Basic Signals.',
                'Designed for disciplined daily execution.',
              ]}
              action={actionFor('basic')}
              busy={busyTier === 'basic' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
            <TierCard
              title="Pro"
              tier="pro"
              cadence={cadence}
              promoActive={promoActive}
              highlights={proHighlights}
              accent="var(--color-brand-accent)"
              features={[
                'Everything included in Basic.',
                'Access to Advanced Signals.',
                'Direct access to ZeroGEX APIs.',
              ]}
              action={actionFor('pro')}
              busy={busyTier === 'pro' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
          </div>

          <section
            style={{
              marginTop: 36,
              maxWidth: 820,
              marginLeft: 'auto',
              marginRight: 'auto',
              background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
              border: `1px solid ${C.border}`,
              borderRadius: 18,
              padding: 28,
            }}
          >
            <h2
              style={{
                margin: 0,
                fontSize: 22,
                fontWeight: 800,
                color: C.light,
                letterSpacing: '-0.3px',
              }}
            >
              Refund &amp; Cancellation Policy
            </h2>
            <div style={{ marginTop: 12, color: C.muted, fontSize: 15, lineHeight: 1.75 }}>
              <p style={{ margin: 0 }}>
                Paid subscriptions are billed in advance on a recurring basis through Stripe. You can
                cancel your subscription at any time from the Stripe-hosted billing portal, accessible
                from your{' '}
                <Link href="/account" style={{ color: C.amber }}>
                  account
                </Link>{' '}
                page.
              </p>
              <ul style={{ paddingLeft: 22, marginTop: 12 }}>
                <li>
                  <strong>{TRIAL_DAYS}-day free trial.</strong> You get full access right away. Your card
                  is collected at signup but isn&rsquo;t charged until the trial ends. Cancel before then
                  and you pay nothing.
                </li>
                <li>
                  <strong>Cancel anytime.</strong> Manage or cancel your plan yourself through the
                  billing portal — no email or support request required.
                </li>
                <li>
                  <strong>No prorated refunds.</strong> Except where required by law, payments are
                  non-refundable, and we do not provide prorated refunds for partial billing periods or
                  unused time.
                </li>
                <li>
                  <strong>Access through the paid period.</strong> When you cancel, your subscription
                  remains active and you keep access to paid features until the end of the billing
                  period you have already paid for. It will not renew after that.
                </li>
              </ul>
            </div>
          </section>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
