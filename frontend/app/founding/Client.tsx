'use client';

import { useCallback, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
import PlanComparison from '@/components/PlanComparison';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import { useTheme } from '@/core/ThemeContext';
import { normalizeTier, TierId } from '@/core/auth';
import { FOUNDING_BILLING_START_LABEL } from '@/core/foundingLockin';
import { useAuthSession } from '@/hooks/useAuthSession';
import { ArrowRight, CheckCircle2, Crown, Loader2, Moon, Sun } from 'lucide-react';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './Client.i18n';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

type BillableTier = 'basic' | 'pro';
type Cadence = 'monthly' | 'annual';

// Display-only pricing. Source of truth is Stripe (price IDs in env).
// Founding intro coupons:
//   basic monthly: $27 off  ($39 -> $12/mo for 12 invoices)
//   basic annual : $79 off  ($199 -> $120/yr for 1 invoice)
//   pro monthly  : $40 off  ($59 -> $19/mo for 12 invoices)
//   pro annual   : $109 off ($299 -> $190/yr for 1 invoice)
// After the intro period the lifetime 25%-off coupon is applied
// automatically by the webhook; post-intro renewal cost shown below.
const FOUNDING = {
  basic: {
    monthly: { rack: 39, intro: 12, postLifetime: 29.25 },
    annual: { rack: 199, intro: 120, perMonth: 10.0, postLifetime: 149.25 },
  },
  pro: {
    monthly: { rack: 59, intro: 19, postLifetime: 44.25 },
    annual: { rack: 299, intro: 190, perMonth: 15.83, postLifetime: 224.25 },
  },
} as const;

type Props = {
  foundingCode: string;
  promoActive: boolean;
  // True when both annual founding coupons are configured server-side.
  // The cadence toggle only renders when true; checkout will still
  // 500 if somehow called with annual cadence and no coupon.
  annualEnabled: boolean;
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
  onSubscribe,
  onPortal,
}: {
  action: TierAction;
  busy: boolean;
  onSubscribe: (tier: BillableTier) => void;
  onPortal: () => void;
}) {
  const baseStyle = {
    marginTop: 22,
    width: '100%',
    padding: '12px 18px',
    fontSize: 14,
  } as const;

  if (action.kind === 'current') {
    return (
      <button
        type="button"
        disabled
        className="zg-btn zg-btn--secondary"
        style={baseStyle as React.CSSProperties}
      >
        {action.label}
      </button>
    );
  }

  if (action.kind === 'link') {
    return (
      <Link href={action.href} style={{ textDecoration: 'none', display: 'block' }}>
        <span className="zg-btn zg-btn--primary" style={baseStyle as React.CSSProperties}>
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
      className="zg-btn zg-btn--primary"
      style={{ ...baseStyle, opacity: busy ? 0.7 : 1, cursor: busy ? 'wait' : 'pointer' }}
    >
      {busy ? <Loader2 size={16} className="animate-spin" /> : action.label}
      {!busy && action.kind === 'subscribe' && <ArrowRight size={16} />}
    </button>
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

function CadenceToggle({
  cadence,
  setCadence,
}: {
  cadence: Cadence;
  setCadence: (c: Cadence) => void;
}) {
  const t = usePageT(dict);
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
        {t('cadenceMonthly')}
      </button>
      <button type="button" style={btn(cadence === 'annual')} onClick={() => setCadence('annual')}>
        {t('cadenceAnnual')}
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
          {t('twoMonthsFree')}
        </span>
      </button>
    </div>
  );
}

function FoundingCard({
  title,
  tier,
  cadence,
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
  features: string[];
  accent: string;
  action: TierAction;
  busy: boolean;
  onSubscribe: (tier: BillableTier) => void;
  onPortal: () => void;
}) {
  const t = usePageT(dict);
  // Bind to the cadence-specific plan inside each branch so TypeScript can
  // narrow the union shape. Pre-binding `plan = FOUNDING[tier][cadence]` and
  // then accessing .perMonth in the annual branch doesn't type-check because
  // the union loses the discriminating cadence info.
  const monthlyPlan = FOUNDING[tier].monthly;
  const annualPlan = FOUNDING[tier].annual;

  return (
    <article
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: `1px solid ${accent}66`,
        borderRadius: 'var(--radius-panel)',
        padding: 28,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.light }}>{title}</h3>
        <Badge accent={accent}>{t('foundingRateBadge')}</Badge>
      </div>

      {cadence === 'monthly' ? (
        <>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontSize: 20,
                color: C.muted,
                textDecoration: 'line-through',
                textDecorationColor: 'var(--color-bear)',
                textDecorationThickness: 3,
              }}
            >
              {formatMoney(monthlyPlan.rack)}
            </span>
            <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>
              {formatMoney(monthlyPlan.intro)}
            </span>
            <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/mo</span>
          </div>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            {t('monthlyIntroPrefix')}{' '}
            <strong style={{ color: C.light }}>{formatMoney(monthlyPlan.postLifetime)}/mo</strong>{' '}
            {t('lifetimeSuffixMonthly')}
          </p>
        </>
      ) : (
        <>
          <div style={{ marginTop: 18, display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <span
              style={{
                fontSize: 20,
                color: C.muted,
                textDecoration: 'line-through',
                textDecorationColor: 'var(--color-bear)',
                textDecorationThickness: 3,
              }}
            >
              {formatMoney(annualPlan.rack)}
            </span>
            <span style={{ fontSize: 36, fontWeight: 900, letterSpacing: '-1px', color: C.light }}>
              {formatMoney(annualPlan.intro)}
            </span>
            <span style={{ fontSize: 14, color: C.muted, fontWeight: 600 }}>/yr</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: C.muted }}>
            {t('annualPerMonthNote', { price: formatMoney(annualPlan.perMonth) })}
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
            {t('annualIntroPrefix')}{' '}
            <strong style={{ color: C.light }}>{formatMoney(annualPlan.postLifetime)}/yr</strong>{' '}
            {t('lifetimeSuffixAnnual')}
          </p>
        </>
      )}

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 12, flex: 1 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55 }}>
            <CheckCircle2 size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>

      <CtaButton action={action} busy={busy} onSubscribe={onSubscribe} onPortal={onPortal} />
    </article>
  );
}

export default function FoundingClient({ foundingCode, annualEnabled }: Props) {
  const t = usePageT(dict);
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const { data: authSession, loading: authLoading, refresh: refreshSession } = useAuthSession();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier: TierId = useMemo(
    () => normalizeTier(authSession?.user?.tier),
    [authSession?.user?.tier],
  );
  const isAuthed = !!authSession?.authenticated;
  const hasActiveSubscription = !!authSession?.user?.hasActiveSubscription;
  // Only render once we know definitively (undefined while loading would
  // flash the banner for verified users).
  const showVerifyBanner = isAuthed && authSession?.user?.emailVerified === false;

  const foundingHref = '/founding';
  const registerHref = `/register?next=${encodeURIComponent(foundingHref)}`;

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
        setError(t('adminNoSubscribeError'));
        return;
      }
      setError(null);
      setBusyTier(tier);
      try {
        if (hasActiveSubscription) {
          await callBilling('/api/billing/portal');
        } else {
          await callBilling('/api/billing/checkout', {
            tier,
            cadence,
            foundingCode,
          });
        }
      } catch (err) {
        const code = (err as Error & { code?: string })?.code;
        if (code === 'EMAIL_NOT_VERIFIED') {
          void refreshSession();
          setError(t('verifyEmailError'));
        } else {
          setError(err instanceof Error ? err.message : t('genericErrorMessage'));
        }
        setBusyTier(null);
      }
    },
    [callBilling, cadence, currentTier, foundingCode, hasActiveSubscription, isAuthed, refreshSession, registerHref, router, t],
  );

  const handlePortal = useCallback(async () => {
    setError(null);
    setBusyTier('portal');
    try {
      await callBilling('/api/billing/portal');
    } catch (err) {
      setError(err instanceof Error ? err.message : t('genericErrorMessage'));
      setBusyTier(null);
    }
  }, [callBilling, t]);

  const actionFor = useCallback(
    (tier: BillableTier): TierAction => {
      const label = tier === 'basic' ? t('basicTitle') : t('proTitle');
      if (authLoading) return { kind: 'link', href: registerHref, label: t('getStarted') };
      if (!isAuthed) {
        return { kind: 'link', href: registerHref, label: t('signUpToActivate') };
      }
      if (currentTier === 'admin') return { kind: 'current', label: t('adminNoSubscription') };

      if (hasActiveSubscription) {
        if (currentTier === tier) return { kind: 'current', label: t('currentPlan') };
        return { kind: 'portal', label: t('switchToPlan', { label }) };
      }
      const plan = FOUNDING[tier][cadence];
      const suffix = cadence === 'monthly' ? '/mo' : '/yr';
      return { kind: 'subscribe', tier, label: t('activatePlan', { label, price: plan.intro, suffix }) };
    },
    [authLoading, cadence, currentTier, hasActiveSubscription, isAuthed, registerHref, t],
  );

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
          <Image src="/title.svg" alt="ZeroGEX" width={300} height={60} priority className="h-[130%] sm:h-[150%] w-auto block" style={{ maxHeight: 'none', objectFit: 'contain' }} />
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
              {t('aboutButton')}
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
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div
              className="zg-eyebrow"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
                color: C.amber,
              }}
            >
              <Crown size={14} /> {t('eyebrow')}
            </div>
            <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 56px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
              {t('heroHeading')}
            </h1>
            <p style={{ margin: '0 auto', maxWidth: 720, color: C.muted, fontSize: 17, lineHeight: 1.7 }}>
              {t('heroIntro', {
                cadencePart: annualEnabled ? t('heroIntroCadencePart') : '',
              })}
            </p>
          </div>

          <div
            style={{
              maxWidth: 720,
              margin: '0 auto 28px',
              padding: '16px 20px',
              borderRadius: 'var(--radius-panel)',
              border: `1px solid ${C.amber}55`,
              background: `${C.amber}10`,
              color: C.light,
              textAlign: 'center',
              lineHeight: 1.6,
            }}
          >
            <div style={{ fontSize: 16, fontWeight: 800, color: C.amber, letterSpacing: '0.04em' }}>
              {t('noChargeToday')}
            </div>
            <div style={{ marginTop: 6, fontSize: 14, color: C.muted }}>
              {t('noChargeBodyPrefix')}{' '}
              <strong style={{ color: C.light }}>{FOUNDING_BILLING_START_LABEL}</strong>. {t('noChargeBodySuffix')}
            </div>
          </div>

          {showVerifyBanner && authSession?.user?.email && (
            <VerifyEmailBanner email={authSession.user.email} />
          )}
          {annualEnabled && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 28 }}>
              <CadenceToggle cadence={cadence} setCadence={setCadence} />
            </div>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18, maxWidth: 820, margin: '0 auto' }}>
            <FoundingCard
              title={t('basicTitle')}
              tier="basic"
              cadence={cadence}
              accent="var(--color-brand-primary)"
              features={[
                t('basicFeature1'),
                t('basicFeature2'),
                t('basicFeature3'),
              ]}
              action={actionFor('basic')}
              busy={busyTier === 'basic' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
            <FoundingCard
              title={t('proTitle')}
              tier="pro"
              cadence={cadence}
              accent="var(--color-brand-accent)"
              features={[
                t('proFeature1'),
                t('proFeature2'),
                t('proFeature3'),
                t('proFeature4'),
              ]}
              action={actionFor('pro')}
              busy={busyTier === 'pro' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
          </div>

          <p
            style={{
              marginTop: 28,
              textAlign: 'center',
              fontSize: 13,
              color: C.muted,
              maxWidth: 720,
              marginLeft: 'auto',
              marginRight: 'auto',
              lineHeight: 1.7,
            }}
          >
            {t('inviteOnlyNoticePrefix')}{' '}
            <Link href="/pricing" style={{ color: C.amber, fontWeight: 700 }}>
              {t('standardPricingLink')}
            </Link>{' '}
            {t('inviteOnlyNoticeSuffix')}
          </p>

          <PlanComparison />

          <Link
            href="/giving"
            style={{
              display: 'block', textDecoration: 'none',
              maxWidth: 820, marginLeft: 'auto', marginRight: 'auto', marginTop: 36,
            }}
          >
            <div className="zg-panel" style={{
              padding: 'clamp(18px, 3vw, 24px)',
              display: 'grid',
              gridTemplateColumns: 'auto 1fr',
              gap: 'clamp(14px, 2.5vw, 20px)',
              alignItems: 'center',
              borderColor: `${C.amber}40`,
            }}>
              <div style={{
                width: 56, height: 56, borderRadius: '50%',
                background: '#ffffff',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 3, flexShrink: 0,
              }}>
                <Image
                  src="/folds-of-honor-proud-supporter.png"
                  alt={t('foldsAlt')}
                  width={50}
                  height={50}
                  style={{ width: 50, height: 50, objectFit: 'contain' }}
                />
              </div>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.amber, letterSpacing: '0.14em', textTransform: 'uppercase', marginBottom: 4 }}>
                  {t('foldsLabel')}
                </div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.55 }}>
                  {t('foldsBodyPrefix')}{' '}
                  <span style={{ color: C.amber, fontWeight: 700 }}>/giving</span>{' '}
                  {t('foldsBodySuffix')}
                </div>
              </div>
            </div>
          </Link>

          <section
            className="zg-panel"
            style={{
              marginTop: 36,
              maxWidth: 820,
              marginLeft: 'auto',
              marginRight: 'auto',
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
              {t('refundHeading')}
            </h2>
            <div style={{ marginTop: 12, color: C.muted, fontSize: 15, lineHeight: 1.75 }}>
              <p style={{ margin: 0 }}>
                {t('refundIntroPart1')}{' '}
                <strong style={{ color: C.light }}>{FOUNDING_BILLING_START_LABEL}</strong>
                {t('refundIntroPart2')}{' '}
                <Link href="/account" style={{ color: C.amber }}>
                  {t('accountLinkLabel')}
                </Link>
                {t('refundIntroPart3', { date: FOUNDING_BILLING_START_LABEL })}
              </p>
              <ul style={{ paddingLeft: 22, marginTop: 12 }}>
                <li>
                  <strong>{t('cancelAnytimeTitle')}</strong> {t('cancelAnytimeBody')}
                </li>
                <li>
                  <strong>{t('noProratedTitle')}</strong> {t('noProratedBody')}
                </li>
                <li>
                  <strong>{t('accessThroughPaidTitle')}</strong> {t('accessThroughPaidBody')}
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
