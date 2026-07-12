'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import Footer from '@/components/Footer';
import LandingHeader from '@/components/LandingHeader';
import PlanComparison from '@/components/PlanComparison';
import VerifyEmailBanner from '@/components/VerifyEmailBanner';
import { useTheme } from '@/core/ThemeContext';
import { normalizeTier, TierId } from '@/core/auth';
import { useAuthSession } from '@/hooks/useAuthSession';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';
import { trackTwitter } from '@/core/telemetry/twitter-client';
import { TwitterEvent } from '@/core/telemetry/twitter-events';
import { ArrowRight, CheckCircle2, Heart, Loader2, Sparkles } from 'lucide-react';

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
// the price IDs + coupons configured in env; if those drift from these numbers
// the UI will show stale prices until this constant is updated.
//
// Promo durations:
//   monthly -> first 6 invoices at the promo rate (Stripe coupon duration =
//              repeating, duration_in_months = 6), then renews at rack.
//   annual  -> first annual invoice at the promo rate (Stripe coupon duration
//              = once), then renews at rack.
const DISPLAY = {
  basic: {
    monthly: { rack: 39, promo: 19, founding: 12 },
    annual: {
      rack: 199,
      promo: 150,
      perMonth: 16.58,
      promoPerMonth: 12.5,
      savingsPct: 57,
    },
  },
  pro: {
    monthly: { rack: 59, promo: 29, founding: 19 },
    annual: {
      rack: 299,
      promo: 229,
      perMonth: 24.92,
      promoPerMonth: 19.08,
      savingsPct: 58,
    },
  },
} as const;

type Props = {
  // Time-boxed promo eligibility per cadence. Server resolves PROMO_END_AT +
  // coupon configuration; client just AND-gates with the selected cadence.
  promoMonthlyActive: boolean;
  promoAnnualActive: boolean;
  // Formatted promo deadline ("August 15, 2026"), or null when no promo is
  // active. Used in the banner copy and as a soft urgency cue.
  promoDeadlineLabel: string | null;
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
  tier,
  onSubscribe,
  onPortal,
}: {
  action: TierAction;
  busy: boolean;
  accent: string;
  tier: BillableTier;
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
    // Logged-out visitor: the trial CTA routes through /register. Record the
    // plan-trial click before we navigate so the funnel captures intent even
    // when the visitor never reaches Stripe.
    return (
      <Link
        href={action.href}
        style={{ textDecoration: 'none', display: 'block' }}
        onClick={() => capture(TelemetryEvent.PlanTrialCtaClick, { selected_plan: tier, ...readUtmParams() })}
      >
        <span style={baseStyle as React.CSSProperties}>
          {action.label} <ArrowRight size={16} />
        </span>
      </Link>
    );
  }

  const handleClick = () => {
    if (busy) return;
    if (action.kind === 'subscribe') {
      // Funnel: plan trial CTA clicked, just before checkout is created.
      capture(TelemetryEvent.PlanTrialCtaClick, { selected_plan: action.tier, ...readUtmParams() });
      onSubscribe(action.tier);
    } else onPortal();
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
    const { rack, perMonth, promo, promoPerMonth } = DISPLAY[tier].annual;
    if (promoActive) {
      return (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <span
              style={{
                fontSize: 22,
                color: C.muted,
                textDecoration: 'line-through',
                fontWeight: 700,
              }}
            >
              {formatMoney(rack)}
            </span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 900,
                letterSpacing: '-1.5px',
                lineHeight: 1,
                color: 'var(--color-brand-primary)',
                textShadow: '0 0 24px var(--color-brand-primary-soft, rgba(245,180,0,0.35))',
              }}
            >
              {formatMoney(promo)}
            </span>
            <span style={{ fontSize: 14, color: C.muted, fontWeight: 700 }}>/year</span>
          </div>
          <div style={{ marginTop: 6, fontSize: 13, color: C.muted, fontWeight: 600 }}>
            ≈ {formatMoney(promoPerMonth)}/mo first year, then {formatMoney(rack)}/yr.
          </div>
        </div>
      );
    }
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
      <div style={{ marginTop: 18 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span
            style={{
              fontSize: 22,
              color: C.muted,
              textDecoration: 'line-through',
              textDecorationColor: 'var(--color-bear)',
              textDecorationThickness: 3,
              fontWeight: 700,
            }}
          >
            {formatMoney(rack)}
          </span>
          <span
            style={{
              fontSize: 52,
              fontWeight: 900,
              letterSpacing: '-1.5px',
              lineHeight: 1,
              color: 'var(--color-brand-primary)',
              textShadow: '0 0 24px var(--color-brand-primary-soft, rgba(245,180,0,0.35))',
            }}
          >
            {formatMoney(promo)}
          </span>
          <span style={{ fontSize: 14, color: C.muted, fontWeight: 700 }}>/mo</span>
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: C.muted, fontWeight: 600 }}>
          First 6 months at this rate, then {formatMoney(rack)}/mo.
        </div>
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
  highlighted,
  startsTrial,
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
  highlighted: boolean;
  // False for a returning member whose free trial is already spent — the card
  // then drops the "free trial" / "No charge today" copy (they're billed now).
  startsTrial: boolean;
  action: TierAction;
  busy: boolean;
  onSubscribe: (tier: BillableTier) => void;
  onPortal: () => void;
}) {
  return (
    <article
      style={{
        background: `linear-gradient(145deg, ${C.card} 0%, var(--bg-active) 100%)`,
        border: highlighted ? `2px solid ${accent}` : `1px solid ${accent}66`,
        borderRadius: 18,
        padding: 28,
        boxShadow: highlighted
          ? `0 0 0 3px ${accent}33, 0 16px 48px ${accent}45`
          : `0 12px 40px ${accent}20`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.light }}>{title}</h3>
        {(highlighted || highlights.length > 0) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {highlighted && <Badge accent={accent}>Your pick</Badge>}
            {highlights.map((h) => (
              <Badge key={h} accent={accent}>
                {h}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <PriceDisplay cadence={cadence} tier={tier} promoActive={promoActive} />

      {startsTrial && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          {TRIAL_DAYS}-day free trial — cancel anytime before it ends and you won&rsquo;t be charged.
        </p>
      )}

      <Link
        href="/giving"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          margin: '12px 0 0', padding: '4px 10px', borderRadius: 999,
          background: `${accent}14`, border: `1px solid ${accent}33`,
          color: accent, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.04em', textDecoration: 'none', alignSelf: 'flex-start',
        }}
      >
        <Heart size={11} /> Includes 3% donation to Folds of Honor
      </Link>

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 12, flex: 1 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55 }}>
            <CheckCircle2 size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>

      <CtaButton action={action} busy={busy} accent={accent} tier={tier} onSubscribe={onSubscribe} onPortal={onPortal} />
      {startsTrial && (action.kind === 'subscribe' || action.kind === 'link') && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: C.muted, textAlign: 'center', fontWeight: 600 }}>
          No charge today.
        </p>
      )}
    </article>
  );
}

// Eye-catching banner shown at the top of the pricing section whenever ANY
// cadence has an active limited-time offer. The shimmer + pulse are
// CSS-animated (no JS), so they animate even before hydration. Keep the copy
// short — the cards below carry the per-tier specifics.
function LimitedTimeBanner({ deadlineLabel }: { deadlineLabel: string | null }) {
  return (
    <div
      role="status"
      aria-label="Limited time offer"
      style={{
        position: 'relative',
        maxWidth: 820,
        margin: '0 auto 28px',
        padding: '18px 22px',
        borderRadius: 16,
        overflow: 'hidden',
        background:
          'linear-gradient(120deg, var(--color-brand-primary) 0%, var(--heat-mid) 35%, var(--color-accent-hot) 70%, var(--heat-mid) 100%)',
        backgroundSize: '220% 100%',
        animation: 'zgxPromoShine 4s linear infinite, zgxPromoPulse 2.4s ease-in-out infinite',
        boxShadow:
          '0 0 0 1px rgba(255,255,255,0.18) inset, 0 14px 50px color-mix(in srgb, var(--color-brand-primary) 45%, transparent)',
        color: 'var(--text-inverse)',
        textAlign: 'center',
        fontWeight: 900,
      }}
    >
      <div
        style={{
          fontSize: 12,
          letterSpacing: '0.32em',
          textTransform: 'uppercase',
          opacity: 0.92,
        }}
      >
        [ LIMITED-TIME OFFER ]
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 'clamp(20px, 2.6vw, 26px)',
          letterSpacing: '-0.3px',
          lineHeight: 1.2,
        }}
      >
        Save up to 51% — Basic from <span style={{ textDecoration: 'underline' }}>$19/mo</span>,
        Pro from <span style={{ textDecoration: 'underline' }}>$29/mo</span>.
      </div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
        First 6 months on monthly · First year on annual ·{' '}
        {deadlineLabel ? `Offer ends ${deadlineLabel}` : 'For a limited time'}
      </div>
    </div>
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

function PricingClientInner({
  promoMonthlyActive,
  promoAnnualActive,
  promoDeadlineLabel,
  referralEnabled,
}: Props) {
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
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
    // Signaled by /register when Resend errored during signup — the account is
    // fine, the user just needs to click Resend below to actually receive the
    // verification link.
    if (searchParams.get('email_send_failed') === '1') {
      return {
        kind: 'error',
        message:
          'Your account is ready, but we couldn’t send the verification email. Use Resend below to try again.',
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

  // Trial-continuation context. ?trial=1 is set after registration and by every
  // signed-in trial CTA (header / home hero / unlock screen), so pricing can
  // greet the visitor mid-flow with the "You're almost done" hero. ?source=
  // registration marks the immediate register→pricing hop; ?checkout_cancelled=1
  // (or the legacy checkout=cancelled) comes back from an abandoned Stripe session.
  const cameFromTrialCta = searchParams.get('trial') === '1';
  const cameFromRegistration = searchParams.get('source') === 'registration';
  // ?winback=1 is the link in the ~1-month win-back email. It tells checkout to
  // attempt the automated win-back coupon; the server re-verifies the account is
  // actually a churned, emailed member before attaching it, so this flag alone
  // grants nothing.
  const cameFromWinback = searchParams.get('winback') === '1';
  const checkoutCancelled =
    searchParams.get('checkout_cancelled') === '1' || searchParams.get('checkout') === 'cancelled';
  // Plan the visitor pre-picked upstream (e.g. "Start Pro Trial" on the unlock
  // screen → /pricing?plan=pro). Highlights that card so the choice carries
  // through instead of dropping them onto an undifferentiated two-card page.
  const rawPlan = searchParams.get('plan');
  const preselectedPlan: BillableTier | null =
    rawPlan === 'basic' || rawPlan === 'pro' ? rawPlan : null;

  // Funnel: pricing / trial page viewed. Fires once on mount with any UTM still
  // on the URL. When the visitor just registered we ALSO fire the dedicated
  // after-register step so the register→pricing drop-off is measurable on its
  // own; a bounced checkout fires checkout_cancelled.
  useEffect(() => {
    const utm = readUtmParams();
    capture(TelemetryEvent.PricingPageView, { ...utm, preselected_plan: preselectedPlan });
    trackTwitter(TwitterEvent.pricingView);
    if (cameFromRegistration) capture(TelemetryEvent.PricingPageViewAfterRegister, { ...utm });
    if (checkoutCancelled) capture(TelemetryEvent.CheckoutCancelled, { ...utm });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
  // Returning member with prior paid history but no active sub. Checkout
  // suppresses the free trial for them (immediate charge), so the UI must not
  // promise "trial" / "no charge today" — it shows resubscribe copy instead.
  const isResubscribe = isAuthed && !hasActiveSubscription && !!authSession?.user?.hasPriorPaid;
  // Show the trial-continuation hero only to visitors who can actually start a
  // trial: not existing subscribers (stale ?trial=1 link) and not returning
  // members whose trial is already spent.
  const showTrialHero = cameFromTrialCta && !hasActiveSubscription && !isResubscribe;
  // Banner only shows when we have a definitive false. While the session is
  // loading, emailVerified is undefined; rendering the banner then would
  // flash it for everyone on every pricing-page visit.
  const showVerifyBanner = isAuthed && authSession?.user?.emailVerified === false;

  // Server already gated PROMO_END_AT + coupon configuration per cadence;
  // just pick the flag matching the user's current cadence selection.
  const promoActive =
    cadence === 'monthly' ? promoMonthlyActive : promoAnnualActive;
  // For the global banner, true whenever *any* cadence has a live offer —
  // independent of the current toggle so it doesn't flicker on cadence change.
  const anyPromoActive = promoMonthlyActive || promoAnnualActive;

  // Preserve the win-back intent across the auth round-trip: a churned member
  // who clicks the email link while logged out would otherwise land back on a
  // bare /pricing (no ?winback=1) after registering/logging in and silently
  // lose the reactivation discount.
  const registerHref = cameFromWinback
    ? `/register?next=${encodeURIComponent('/pricing?winback=1')}`
    : '/register?next=/pricing';

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
          // Funnel: intent to subscribe, just before redirect to Stripe.
          capture(TelemetryEvent.CheckoutStarted, {
            tier,
            selected_plan: tier,
            cadence,
            user_id: authSession?.user?.id,
            ...readUtmParams(),
          });
          await callBilling('/api/billing/checkout', {
            tier,
            cadence,
            // Carry the win-back intent through so the server attaches the
            // reactivation coupon for eligible churners (verified server-side).
            ...(cameFromWinback ? { winback: true } : {}),
          });
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
    [authSession?.user?.id, callBilling, cadence, cameFromWinback, currentTier, hasActiveSubscription, isAuthed, refreshSession, router],
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
      // Keep the word "trial" the moment they click through from "Start free
      // trial" — tier-specific so the button reads "Start Basic Trial" /
      // "Start Pro Trial", never "Subscribe" / "Choose plan".
      const trialLabel = `Start ${label} Trial`;
      // Tier-specific register link so a logged-out plan click returns to the
      // trial hero with THIS plan preselected (register carries the plan through).
      const registerTrialHref = `/register?next=${encodeURIComponent(`/pricing?trial=1&plan=${tier}`)}`;
      if (authLoading) return { kind: 'link', href: registerTrialHref, label: trialLabel };
      if (!isAuthed) {
        return { kind: 'link', href: registerTrialHref, label: trialLabel };
      }
      if (currentTier === 'admin') return { kind: 'current', label: 'Admin (no subscription)' };

      if (hasActiveSubscription) {
        // Real subscriber: the tier truly reflects which plan they're on.
        if (currentTier === tier) return { kind: 'current', label: 'Current Plan' };
        return { kind: 'portal', label: `Switch to ${label}` };
      }

      // No active Stripe sub. First-timers get the free trial; a returning
      // member with prior paid history is charged immediately (checkout
      // suppresses the trial), so label it a subscribe, not a trial.
      if (isResubscribe) return { kind: 'subscribe', tier, label: `Subscribe to ${label}` };
      return { kind: 'subscribe', tier, label: trialLabel };
    },
    [authLoading, currentTier, hasActiveSubscription, isAuthed, isResubscribe],
  );

  // "Limited Time" pill omitted from the per-card highlights when the global
  // banner is already shown above — the banner carries that callout once
  // instead of repeating it twice per card.
  const basicHighlights: string[] = [];
  if (cadence === 'annual') basicHighlights.push('Save 57%');

  const proHighlights: string[] = ['Most Popular'];
  if (cadence === 'annual') proHighlights.push('Save 58%');

  return (
    <div style={{ background: 'transparent', color: C.light, fontFamily: 'DM Sans, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @keyframes zgxPromoShine {
          0% { background-position: 0% 50%; }
          100% { background-position: 220% 50%; }
        }
        @keyframes zgxPromoPulse {
          0%, 100% { box-shadow: 0 0 0 1px rgba(255,255,255,0.18) inset, 0 14px 50px rgba(255, 122, 24, 0.45); }
          50% { box-shadow: 0 0 0 1px rgba(255,255,255,0.28) inset, 0 18px 70px rgba(255, 46, 99, 0.6); }
        }
        @media (prefers-reduced-motion: reduce) {
          [aria-label="Limited time offer"] {
            animation: none !important;
          }
        }
      `}</style>
      <LandingHeader hidePricingButton />

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
              <Sparkles size={14} /> {showTrialHero ? 'Almost done' : 'Pricing'}
            </div>
            {showTrialHero ? (
              <>
                <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
                  You&rsquo;re almost done.
                </h1>
                <p style={{ margin: '0 auto 12px', maxWidth: 760, color: C.light, fontSize: 20, lineHeight: 1.6, fontWeight: 600 }}>
                  Choose your plan to start your {TRIAL_DAYS}-day free trial.
                </p>
                <p style={{ margin: '0 auto 14px', maxWidth: 760, color: C.amber, fontSize: 15, lineHeight: 1.7, fontWeight: 700 }}>
                  No charge until day {TRIAL_DAYS}. Cancel anytime.
                </p>
                <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
                  Your ZeroGEX account is ready. Pick Basic or Pro to unlock live SPY, SPX, and QQQ gamma
                  levels, dealer positioning, flow pressure, and market state signals.
                </p>
              </>
            ) : (
              <>
                <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
                  Trade with a live map of the options levels that matter.
                </h1>
                <p style={{ margin: '0 auto 18px', maxWidth: 760, color: C.light, fontSize: 18, lineHeight: 1.7, fontWeight: 500 }}>
                  ZeroGEX helps SPY/SPX/QQQ traders track gamma exposure, call/put walls, gamma flip,
                  dealer positioning, and flow pressure in real time.
                </p>
                <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
                  {TRIAL_DAYS}-day free trial. Full access now. No charge until day {TRIAL_DAYS}. Cancel anytime —
                  no email or support request required.
                </p>
              </>
            )}
          </div>

          {checkoutCancelled && !hasActiveSubscription && (
            <div
              role="status"
              style={{
                maxWidth: 760,
                margin: '0 auto 28px',
                padding: '14px 18px',
                borderRadius: 12,
                border: `1px solid ${C.border}`,
                background: 'var(--color-surface)',
                textAlign: 'center',
                color: C.light,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              No problem — your trial has not started yet. Choose a plan whenever you&rsquo;re ready.
            </div>
          )}

          {anyPromoActive && <LimitedTimeBanner deadlineLabel={promoDeadlineLabel} />}

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
              [ REFERRAL APPLIED ] &nbsp;A friend referred you — your discount is applied automatically at checkout.
            </div>
          )}

          {cameFromWinback && isResubscribe && (
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
              👋 Welcome back — your win-back discount is applied automatically at checkout.
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
              highlighted={preselectedPlan === 'basic'}
              startsTrial={!isResubscribe}
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
              highlighted={preselectedPlan === 'pro'}
              startsTrial={!isResubscribe}
              accent="var(--color-brand-accent)"
              features={[
                'Everything included in Basic.',
                'Access to Advanced Signals.',
                'Access to Backtesting (Beta).',
                'Direct access to ZeroGEX APIs.',
              ]}
              action={actionFor('pro')}
              busy={busyTier === 'pro' || busyTier === 'portal'}
              onSubscribe={handleSubscribe}
              onPortal={handlePortal}
            />
          </div>

          <PlanComparison />

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
                  <strong>Plan switches during trial.</strong> Changing plans while on the free
                  trial ends the trial early and charges you for the new plan immediately. To keep
                  the trial, wait until it ends before switching plans.
                </li>
                <li>
                  <strong>Upgrades &amp; downgrades on paid plans.</strong> After the trial, switching
                  tiers is pro-rated automatically through the Stripe-hosted billing portal.
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
