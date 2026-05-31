'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import Footer from '@/components/Footer';
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

const TIER_RANK: Record<TierId, number> = {
  public: 0,
  basic: 10,
  pro: 20,
  admin: 30,
};

type Props = {
  accessKey: string;
  // True when PROMO_END_AT is in the future AND a monthly promo coupon is
  // configured. Computed server-side so the client never calls Date.now()
  // during render. Monthly-cadence gating is still applied below.
  promoActive: boolean;
  foundingCodeConfigured: boolean;
};

type TierAction =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'subscribe'; tier: BillableTier; label: string }
  | { kind: 'portal'; label: string }
  | { kind: 'current'; label: string };

function formatMoney(amount: number): string {
  return Number.isInteger(amount)
    ? `$${amount}`
    : `$${amount.toFixed(2)}`;
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

export default function PreviewClient({ accessKey, promoActive: serverPromoActive, foundingCodeConfigured }: Props) {
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const isDark = theme === 'dark';
  const { data: authSession, loading: authLoading } = useAuthSession();
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [foundingCode, setFoundingCode] = useState('');
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | 'portal' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentTier: TierId = useMemo(
    () => normalizeTier(authSession?.user?.tier),
    [authSession?.user?.tier],
  );
  const isAuthed = !!authSession?.authenticated;
  // hasPaidSubscription includes basic, not just pro: a basic subscriber
  // clicking Pro should land in the portal (which knows how to swap prices),
  // not /api/billing/checkout (which 409s if the user already has a sub).
  const hasPaidSubscription = currentTier === 'basic' || currentTier === 'pro';

  // Server already verified PROMO_END_AT is in the future at request time;
  // here we just gate on the cadence the user has selected.
  const promoActive = serverPromoActive && cadence === 'monthly';

  const previewHref = `/preview?key=${encodeURIComponent(accessKey)}`;
  const registerHref = `/register?next=${encodeURIComponent(previewHref)}`;

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
      const payload = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !payload.url) {
        throw new Error(payload.error ?? 'Billing request failed');
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
        if (hasPaidSubscription) {
          await callBilling('/api/billing/portal');
        } else {
          const trimmedCode = foundingCode.trim();
          await callBilling('/api/billing/checkout', {
            tier,
            cadence,
            ...(trimmedCode.length > 0 ? { foundingCode: trimmedCode } : {}),
          });
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setBusyTier(null);
      }
    },
    [
      callBilling,
      cadence,
      currentTier,
      foundingCode,
      hasPaidSubscription,
      isAuthed,
      registerHref,
      router,
    ],
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
      if (authLoading) return { kind: 'link', href: registerHref, label: 'Get Started' };
      if (!isAuthed) {
        return { kind: 'link', href: registerHref, label: 'Sign up to subscribe' };
      }
      if (currentTier === 'admin') return { kind: 'current', label: 'Admin (no subscription)' };
      if (currentTier === tier) return { kind: 'current', label: 'Current Plan' };
      if (TIER_RANK[currentTier] > TIER_RANK[tier]) {
        return { kind: 'portal', label: 'Manage Subscription' };
      }
      if (hasPaidSubscription) {
        return { kind: 'portal', label: `Switch to ${label}` };
      }
      return { kind: 'subscribe', tier, label: `Subscribe to ${label}` };
    },
    [authLoading, currentTier, hasPaidSubscription, isAuthed, registerHref],
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
              <Sparkles size={14} /> Early Access
            </div>
            <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
              Choose Your Plan
            </h1>
            <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 18, lineHeight: 1.7 }}>
              You&rsquo;re looking at an invite-only preview of ZeroGEX paid plans.
              Upgrades, downgrades, and cancellations are pro-rated automatically through the billing portal.
            </p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <CadenceToggle cadence={cadence} setCadence={setCadence} />
          </div>

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

          {foundingCodeConfigured && (
            <section
              style={{
                marginTop: 36,
                maxWidth: 720,
                marginLeft: 'auto',
                marginRight: 'auto',
                background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
                border: `1px solid ${C.border}`,
                borderRadius: 18,
                padding: 24,
              }}
            >
              <h2
                style={{
                  margin: 0,
                  fontSize: 18,
                  fontWeight: 800,
                  color: C.light,
                  letterSpacing: '-0.2px',
                }}
              >
                Founding member?
              </h2>
              <p style={{ margin: '8px 0 14px', fontSize: 14, color: C.muted, lineHeight: 1.6 }}>
                If you have a founding-member code, enter it below before clicking subscribe.
                Eligible accounts pay <strong style={{ color: C.light }}>${DISPLAY.basic.monthly.founding}/mo</strong> for Basic
                or <strong style={{ color: C.light }}>${DISPLAY.pro.monthly.founding}/mo</strong> for Pro for the first 12 months
                (monthly billing only).
              </p>
              <input
                type="text"
                value={foundingCode}
                onChange={(e) => setFoundingCode(e.target.value)}
                placeholder="FOUNDING25"
                spellCheck={false}
                autoCapitalize="characters"
                autoCorrect="off"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: `1px solid ${C.border}`,
                  background: 'var(--color-bg)',
                  color: C.light,
                  fontSize: 14,
                  fontFamily: 'inherit',
                  letterSpacing: '0.04em',
                }}
              />
              {cadence === 'annual' && foundingCode.trim().length > 0 && (
                <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-bear)' }}>
                  The founding rate applies to monthly billing only — switch back to Monthly to use this code.
                </p>
              )}
            </section>
          )}

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

          <p
            style={{
              marginTop: 24,
              textAlign: 'center',
              fontSize: 12,
              color: C.muted,
              letterSpacing: '0.04em',
            }}
          >
            Invite-only preview. Not currently linked from any public page.
          </p>
        </div>
      </section>

      <Footer theme={theme} />
    </div>
  );
}
