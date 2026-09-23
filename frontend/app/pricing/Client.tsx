'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
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
import { ArrowRight, CheckCircle2, Loader2, ShieldCheck, Sparkles } from 'lucide-react';
import { usePageT } from '@/core/LanguageContext';
import {
  BILLING_CADENCES,
  formatBilledUsd,
  formatPerMonthUsd,
  maxSavingsPct,
  MONEY_BACK_GUARANTEE_DAYS,
  MONTHLY_PROMO,
  planDisplay,
  planHasFreeTrial,
  type BillingCadence,
} from '@/core/billingPlans';
import { dict } from './Client.i18n';

const C = {
  card: 'var(--color-surface)',
  light: 'var(--color-text-primary)',
  muted: 'var(--color-text-secondary)',
  amber: 'var(--color-brand-primary)',
  border: 'var(--border-default)',
};

type Cadence = BillingCadence;
type BillableTier = 'basic' | 'pro';

// Display mirror of TRIAL_PERIOD_DAYS in
// frontend/app/api/billing/checkout/route.ts. Keep in sync — the server is
// the source of truth for what Stripe actually does.
const TRIAL_DAYS = 7;

// Display mirror of REACTIVATION_TRIAL_DAYS_DEFAULT in
// frontend/app/api/billing/checkout/route.ts — the extended trial a
// ?reactivate=1 visitor (arriving from the second-touch reactivation email) is
// granted server-side. Shown in the hero + plan cards for that visitor so the
// page matches the number the email promised. If an operator overrides
// REACTIVATION_TRIAL_DAYS in .env.local, set NEXT_PUBLIC_REACTIVATION_TRIAL_DAYS
// to the same value so this stays truthful; the raw default keeps the common
// (unset) case correct with no config.
const REACTIVATION_TRIAL_DAYS = (() => {
  const raw = Number(process.env.NEXT_PUBLIC_REACTIVATION_TRIAL_DAYS);
  return Number.isFinite(raw) ? Math.max(TRIAL_DAYS, Math.min(90, Math.floor(raw))) : 30;
})();

// Display-only pricing comes from core/billingPlans.ts (planDisplay), the same
// catalogue checkout and the refund flow read. Stripe remains the source of
// truth for what is charged; scripts/setup-pricing.mts --verify checks the live
// prices and the promo coupon against these numbers before launch.

type Props = {
  // Time-boxed promo eligibility per cadence. Server resolves PROMO_END_AT +
  // coupon configuration (and whether the promo is advertised on that cadence
  // at all — monthly only); client just picks the selected cadence's flag.
  promoActiveByCadence: Record<Cadence, boolean>;
  // Formatted promo deadline ("October 1, 2026"), or null when no promo is
  // active. Used in the banner copy and as a soft urgency cue.
  promoDeadlineLabel: string | null;
  // Cadences whose Stripe prices exist for both tiers. Quarterly stays hidden
  // until its price ids are configured, so the page never offers a plan that
  // cannot check out.
  sellableCadences: Cadence[];
  // The tier:cadence plans that start with a free trial (BILLING_TRIAL_PLANS;
  // Basic monthly by default). Every other plan is sold under the 7-day
  // money-back guarantee. Resolved server-side so the page and checkout agree.
  trialPlanKeys: string[];
  referralEnabled: boolean;
  // True when the persisted zgx_ref cookie is a CAMPAIGN code (business-card /
  // offline collateral) rather than a person-to-person referral. Classified
  // server-side (campaign codes live in STRIPE_CAMPAIGN_* env). Swaps the
  // referral banner for a neutral discount banner.
  campaignActive: boolean;
  // The signed-in member's current plan (tier AND billing period), read
  // server-side from their synced subscription; null when there is none or its
  // price is not one we sell. A card is "Current plan" only when both match.
  currentPlan: { tier: BillableTier; cadence: Cadence } | null;
  // Their subscription's status ('trialing', 'active', ...), or null.
  subscriptionStatus: string | null;
  // They have already used their one money-back refund (this account or email).
  guaranteeUsed: boolean;
};

// What the promo is worth over its whole run: $10 off × 12 months = $120.
const PROMO_TOTAL_SAVINGS_USD = MONTHLY_PROMO.amountOffUsd * MONTHLY_PROMO.months;

// The billing period last picked on this page (a per-browser convenience).
const CADENCE_STORAGE_KEY = 'zgx_pricing_cadence';

type TierAction =
  | { kind: 'link'; href: string; label: string }
  | { kind: 'subscribe'; tier: BillableTier; label: string }
  // Existing subscriber switching to a different tier. Carries the target tier so
  // the server-side change-plan route can upgrade a trialing member in-app (at the
  // promo rate) or hand off to the billing portal for paid/downgrade/cadence moves.
  | { kind: 'portal'; tier: BillableTier; label: string }
  | { kind: 'current'; label: string };

function CtaButton({
  action,
  busy,
  tier,
  onSubscribe,
  onChangePlan,
}: {
  action: TierAction;
  busy: boolean;
  tier: BillableTier;
  onSubscribe: (tier: BillableTier) => void;
  onChangePlan: (tier: BillableTier) => void;
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
        style={{ ...baseStyle, cursor: 'default' }}
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
        <span className="zg-btn zg-btn--primary" style={baseStyle as React.CSSProperties}>
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
    } else onChangePlan(action.tier);
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

// The headline is what the member is actually billed, in whole dollars
// ("$199 /year"); longer plans add their monthly equivalent to the cent in the
// card's accent ("Equivalent to $16.58/mo") so every cadence still compares on
// one axis.
function periodSuffixKey(cadence: Cadence): string {
  return cadence === 'monthly' ? 'perMonthSuffix' : cadence === 'quarterly' ? 'perQuarterSuffix' : 'perYearSuffix';
}

function PriceDisplay({
  cadence,
  tier,
  promoActive,
  accent,
}: {
  cadence: Cadence;
  tier: BillableTier;
  promoActive: boolean;
  accent: string;
}) {
  const t = usePageT(dict);
  const display = planDisplay({ tier, cadence });
  const suffix = (
    <span style={{ fontSize: 15, color: C.muted, fontWeight: 700 }}>{t(periodSuffixKey(cadence))}</span>
  );

  if (cadence === 'monthly' && promoActive && display.promoPrice != null) {
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
            {formatBilledUsd(display.listPrice)}
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
            {formatBilledUsd(display.promoPrice)}
          </span>
          {suffix}
        </div>
        <div style={{ marginTop: 6, fontSize: 13, color: C.muted, fontWeight: 600 }}>
          {t('monthlyPromoNote', {
            months: display.promoPeriods ?? MONTHLY_PROMO.months,
            rack: formatBilledUsd(display.listPrice),
            total: formatBilledUsd(PROMO_TOTAL_SAVINGS_USD),
          })}
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 46, fontWeight: 900, letterSpacing: '-1.5px', lineHeight: 1, color: C.light }}>
          {formatBilledUsd(display.listPrice)}
        </span>
        {suffix}
      </div>
      {cadence !== 'monthly' && (
        <div style={{ marginTop: 8, fontSize: 14, fontWeight: 700, color: accent }}>
          {t('equivalentPerMonth', { price: formatPerMonthUsd(display.perMonth) })}
        </div>
      )}
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
        border: `1px solid color-mix(in srgb, ${accent} 40%, transparent)`,
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
  hasGuarantee,
  trialDays,
  action,
  busy,
  onSubscribe,
  onChangePlan,
}: {
  title: string;
  tier: BillableTier;
  cadence: Cadence;
  promoActive: boolean;
  highlights: string[];
  features: string[];
  accent: string;
  highlighted: boolean;
  // Whether choosing this card starts a free trial: the trial plan for a
  // first-timer (or any plan for a ?reactivate=1 invitee). False for a returning
  // member whose trial is spent, and for every plan sold under the guarantee.
  startsTrial: boolean;
  // Whether this plan is paid up front under the 7-day money-back guarantee.
  // Mutually exclusive with startsTrial; a returning member on the trial plan
  // gets neither and is simply billed.
  hasGuarantee: boolean;
  // Trial length shown in the card note. Standard TRIAL_DAYS for everyone, the
  // extended REACTIVATION_TRIAL_DAYS for a ?reactivate=1 visitor so the card
  // agrees with the hero and the email.
  trialDays: number;
  action: TierAction;
  busy: boolean;
  onSubscribe: (tier: BillableTier) => void;
  onChangePlan: (tier: BillableTier) => void;
}) {
  const t = usePageT(dict);
  return (
    <article
      className="zg-panel zg-pcard"
      style={{
        borderColor: accent,
        borderWidth: highlighted ? 2 : undefined,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: C.light }}>{title}</h3>
        {(highlighted || highlights.length > 0) && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              justifyContent: 'flex-end',
              alignItems: 'center',
              gap: '4px 10px',
            }}
          >
            {highlighted && <Badge accent={accent}>{t('yourPickBadge')}</Badge>}
            {highlights.map((h) => (
              <Badge key={h} accent={accent}>
                {h}
              </Badge>
            ))}
          </div>
        )}
      </div>

      <PriceDisplay cadence={cadence} tier={tier} promoActive={promoActive} accent={accent} />

      {startsTrial && (
        <p style={{ margin: '8px 0 0', fontSize: 12, color: C.muted, lineHeight: 1.55 }}>
          {t('trialDaysNote', { days: trialDays })}
        </p>
      )}
      {hasGuarantee && (
        <p
          style={{
            margin: '8px 0 0',
            fontSize: 12,
            color: C.muted,
            lineHeight: 1.55,
            display: 'flex',
            gap: 6,
            alignItems: 'flex-start',
          }}
        >
          <ShieldCheck size={14} style={{ color: accent, marginTop: 2, flexShrink: 0 }} aria-hidden />
          <span>{t('moneyBackNote', { days: MONEY_BACK_GUARANTEE_DAYS })}</span>
        </p>
      )}

      <Link
        href="/giving"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          margin: '12px 0 0', padding: '3px 12px 3px 3px', borderRadius: 999,
          background: `color-mix(in srgb, ${accent} 8%, transparent)`,
          border: `1px solid color-mix(in srgb, ${accent} 20%, transparent)`,
          color: accent, fontSize: 11, fontWeight: 700,
          letterSpacing: '0.04em', textDecoration: 'none', alignSelf: 'flex-start',
        }}
      >
        <Image
          src="/folds-of-honor-proud-supporter.png"
          alt=""
          width={22}
          height={22}
          style={{
            width: 22, height: 22, borderRadius: '50%',
            background: '#ffffff',
            padding: 1,
          }}
        />
        {t('foldsOfHonorLink')}
      </Link>

      <ul style={{ margin: '20px 0 0', padding: 0, listStyle: 'none', display: 'grid', gap: 12, flex: 1 }}>
        {features.map((feature) => (
          <li key={feature} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', color: C.muted, lineHeight: 1.55 }}>
            <CheckCircle2 size={18} style={{ color: accent, marginTop: 2, flexShrink: 0 }} />
            {feature}
          </li>
        ))}
      </ul>

      <CtaButton action={action} busy={busy} tier={tier} onSubscribe={onSubscribe} onChangePlan={onChangePlan} />
      {(action.kind === 'subscribe' || action.kind === 'link') && (startsTrial || hasGuarantee) && (
        <p style={{ margin: '10px 0 0', fontSize: 12, color: C.muted, textAlign: 'center', fontWeight: 600 }}>
          {startsTrial ? t('noChargeToday') : t('billedTodayNote')}
        </p>
      )}
    </article>
  );
}

// Eye-catching banner shown at the top of the pricing section whenever the
// limited-time promo is live. The shimmer + pulse are CSS-animated (no JS), so
// they animate even before hydration. The figures come from the plan catalogue
// (core/billingPlans.ts), the same numbers the monthly cards show.
function LimitedTimeBanner({ deadlineLabel }: { deadlineLabel: string | null }) {
  const t = usePageT(dict);
  const basic = planDisplay({ tier: 'basic', cadence: 'monthly' }).promoPrice;
  const pro = planDisplay({ tier: 'pro', cadence: 'monthly' }).promoPrice;
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
        {t('limitedTimeOfferLabel')}
      </div>
      <div
        style={{
          marginTop: 6,
          fontSize: 'clamp(20px, 2.6vw, 26px)',
          letterSpacing: '-0.3px',
          lineHeight: 1.2,
        }}
      >
        {t('limitedTimeHeadline', { amount: formatBilledUsd(MONTHLY_PROMO.amountOffUsd), months: MONTHLY_PROMO.months })}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, fontWeight: 700, opacity: 0.9 }}>
        {basic != null && pro != null && (
          <>
            {t('limitedTimePrices', { basic: formatBilledUsd(basic ?? 0), pro: formatBilledUsd(pro ?? 0) })} ·{' '}
          </>
        )}
        <strong style={{ fontWeight: 900 }}>{t('limitedTimeTotal', { total: formatBilledUsd(PROMO_TOTAL_SAVINGS_USD) })}</strong> ·{' '}
        {deadlineLabel ? t('limitedTimeOfferEnds', { deadline: deadlineLabel }) : t('limitedTimeForLimited')}
      </div>
    </div>
  );
}

function CadenceToggle({
  cadence,
  cadences,
  setCadence,
}: {
  cadence: Cadence;
  cadences: Cadence[];
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
      whiteSpace: 'nowrap',
    }) as const;

  const label: Record<Cadence, string> = {
    monthly: t('monthlyToggle'),
    quarterly: t('quarterlyToggle'),
    annual: t('annualToggle'),
  };

  return (
    <div
      role="group"
      style={{
        display: 'inline-flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 4,
        padding: 4,
        borderRadius: 999,
        background: 'var(--bg-hover)',
        border: `1px solid ${C.border}`,
        maxWidth: '100%',
      }}
    >
      {cadences.map((option) => {
        const active = cadence === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            style={btn(active)}
            onClick={() => setCadence(option)}
          >
            {label[option]}
          </button>
        );
      })}
    </div>
  );
}

// The "save up to" figures, moved out of the toggle onto one quiet line under
// it: "Quarterly saves up to 36% · Annual saves up to 58%".
function SavingsHint({ cadences }: { cadences: Cadence[] }) {
  const t = usePageT(dict);
  const label: Record<Cadence, string> = {
    monthly: t('monthlyToggle'),
    quarterly: t('quarterlyToggle'),
    annual: t('annualToggle'),
  };
  const items = cadences
    .map((option) => ({ option, pct: maxSavingsPct(option) }))
    .filter((item): item is { option: Cadence; pct: number } => item.pct != null);
  if (items.length === 0) return null;
  return (
    <p style={{ margin: '12px 0 0', fontSize: 13, color: C.muted, textAlign: 'center', fontWeight: 600 }}>
      {items.map((item, index) => (
        <span key={item.option} style={{ whiteSpace: 'nowrap' }}>
          {index > 0 && <span aria-hidden style={{ margin: '0 10px', opacity: 0.5 }}>·</span>}
          {t('savingsHintLead', { cadence: label[item.option] })}{' '}
          <strong style={{ color: 'var(--color-bull)', fontWeight: 800 }}>{item.pct}%</strong>
        </span>
      ))}
    </p>
  );
}

// Every billing period side by side: what you're billed (whole dollars), what
// it works out to per month (to the cent, in the tier's accent), and the saving
// against paying the monthly list price. A row selects that billing period for
// the cards above.
function BillingComparison({
  cadences,
  cadence,
  setCadence,
  promoActiveByCadence,
}: {
  cadences: Cadence[];
  cadence: Cadence;
  setCadence: (cadence: Cadence) => void;
  promoActiveByCadence: Record<Cadence, boolean>;
}) {
  const t = usePageT(dict);
  const tiers: Array<{ tier: BillableTier; title: string; accent: string }> = [
    { tier: 'basic', title: t('basicTitle'), accent: 'var(--color-brand-primary)' },
    { tier: 'pro', title: t('proTitle'), accent: 'var(--color-brand-accent)' },
  ];
  const rowLabel: Record<Cadence, string> = {
    monthly: t('monthlyToggle'),
    quarterly: t('quarterlyToggle'),
    annual: t('annualToggle'),
  };
  const rowNote: Record<Cadence, string> = {
    monthly: t('billedMonthlyShort'),
    quarterly: t('billedQuarterlyShort'),
    annual: t('billedAnnuallyShort'),
  };
  const cellPad = 'clamp(10px, 2.2vw, 18px)';

  return (
    <section className="zg-panel zgx-billing-compare" style={{ marginTop: 28, padding: 'clamp(16px, 3vw, 28px)' }}>
      <h2 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.light, letterSpacing: '-0.3px' }}>
        {t('compareBillingTitle')}
      </h2>
      <p style={{ margin: '6px 0 0', fontSize: 13, color: C.muted, lineHeight: 1.55 }}>{t('compareBillingSubtitle')}</p>

      <table style={{ width: '100%', marginTop: 18, borderCollapse: 'separate', borderSpacing: 0, tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '30%' }} />
          <col style={{ width: '35%' }} />
          <col style={{ width: '35%' }} />
        </colgroup>
        <thead>
          <tr>
            <th scope="col" style={{ padding: `0 ${cellPad} 10px`, textAlign: 'left' }}>
              <span className="sr-only">{t('compareBillingPeriodColumn')}</span>
            </th>
            {tiers.map(({ tier, title, accent }) => (
              <th
                key={tier}
                scope="col"
                style={{
                  padding: `0 ${cellPad} 10px`,
                  textAlign: 'left',
                  fontSize: 12,
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: accent,
                }}
              >
                {title}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cadences.map((option) => {
            const selected = option === cadence;
            const promo = option === 'monthly' && promoActiveByCadence.monthly;
            const rowBg = selected ? 'color-mix(in srgb, var(--color-brand-primary) 9%, transparent)' : 'transparent';
            const cellStyle: React.CSSProperties = {
              padding: `${cellPad}`,
              verticalAlign: 'top',
              background: rowBg,
              borderTop: `1px solid ${C.border}`,
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            };
            return (
              <tr key={option} onClick={() => setCadence(option)}>
                <th
                  scope="row"
                  style={{
                    ...cellStyle,
                    textAlign: 'left',
                    boxShadow: selected ? 'inset 3px 0 0 var(--color-brand-primary)' : undefined,
                  }}
                >
                  <button
                    type="button"
                    aria-pressed={selected}
                    onClick={(event) => {
                      event.stopPropagation();
                      setCadence(option);
                    }}
                    style={{
                      all: 'unset',
                      cursor: 'pointer',
                      display: 'block',
                      fontSize: 16,
                      fontWeight: 800,
                      color: C.light,
                    }}
                  >
                    {rowLabel[option]}
                  </button>
                  <div style={{ marginTop: 4, fontSize: 12, fontWeight: 600, color: C.muted, lineHeight: 1.4 }}>
                    {rowNote[option]}
                  </div>
                </th>
                {tiers.map(({ tier, accent }) => {
                  const display = planDisplay({ tier, cadence: option });
                  const billed = promo && display.promoPrice != null ? display.promoPrice : display.listPrice;
                  const perMonth = option === 'monthly' ? billed : display.perMonth;
                  return (
                    <td key={tier} style={cellStyle}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 'clamp(22px, 3.4vw, 30px)',
                            fontWeight: 900,
                            letterSpacing: '-0.8px',
                            lineHeight: 1,
                            color: C.light,
                            fontVariantNumeric: 'tabular-nums',
                          }}
                        >
                          {formatBilledUsd(billed)}
                        </span>
                        {promo && display.promoPrice != null && (
                          <span
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: C.muted,
                              textDecoration: 'line-through',
                              textDecorationColor: 'var(--color-bear)',
                              textDecorationThickness: 2,
                            }}
                          >
                            {formatBilledUsd(display.listPrice)}
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          marginTop: 6,
                          fontSize: 14,
                          fontWeight: 800,
                          color: accent,
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatPerMonthUsd(perMonth)}
                        <span style={{ fontWeight: 700, opacity: 0.85 }}>{t('perMonthSuffix')}</span>
                      </div>
                      <div style={{ marginTop: 8, minHeight: 22 }}>
                        {display.savingsPct != null ? (
                          <span
                            style={{
                              display: 'inline-block',
                              fontSize: 11,
                              fontWeight: 800,
                              letterSpacing: '0.08em',
                              textTransform: 'uppercase',
                              padding: '3px 9px',
                              borderRadius: 999,
                              color: 'var(--color-bull)',
                              background: 'var(--color-bull-soft, rgba(34,197,94,0.14))',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {t('saveHighlight', { pct: display.savingsPct })}
                          </span>
                        ) : promo ? (
                          <span style={{ fontSize: 12, fontWeight: 600, color: C.muted, lineHeight: 1.4 }}>
                            {t('comparePromoNote', {
                              months: display.promoPeriods ?? MONTHLY_PROMO.months,
                              rack: formatBilledUsd(display.listPrice),
                            })}
                          </span>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
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
  promoActiveByCadence,
  promoDeadlineLabel,
  sellableCadences,
  trialPlanKeys,
  referralEnabled,
  campaignActive,
  currentPlan,
  subscriptionStatus,
  guaranteeUsed,
}: Props) {
  const t = usePageT(dict);
  const { theme } = useTheme();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: authSession, loading: authLoading, refresh: refreshSession } = useAuthSession();
  // Offered billing periods, in catalogue order. Monthly is always sellable; the
  // guard keeps the toggle sane even if a misconfiguration left it out.
  const cadences = useMemo<Cadence[]>(
    () => BILLING_CADENCES.filter((c) => c === 'monthly' || sellableCadences.includes(c)),
    [sellableCadences],
  );
  // A ?cadence= carried through registration (or linked from elsewhere) opens
  // the page on that billing period, when it is offered; a subscriber otherwise
  // opens on their own, so their current plan is the one marked; anyone else
  // on the period they last picked here (it survives the verify-email link,
  // which opens a fresh /pricing). This subtree is client-rendered, so reading
  // localStorage in the initializer is safe; it may be unavailable, hence the
  // try.
  const [cadence, setCadenceState] = useState<Cadence>(() => {
    const requested = searchParams.get('cadence');
    let remembered: string | null = null;
    try {
      remembered = window.localStorage.getItem(CADENCE_STORAGE_KEY);
    } catch {
      remembered = null;
    }
    return (
      cadences.find((c) => c === requested) ??
      cadences.find((c) => c === currentPlan?.cadence) ??
      cadences.find((c) => c === remembered) ??
      'monthly'
    );
  });
  const setCadence = useCallback((next: Cadence) => {
    setCadenceState(next);
    try {
      window.localStorage.setItem(CADENCE_STORAGE_KEY, next);
    } catch {
      // Storage blocked: the choice simply isn't remembered.
    }
  }, []);
  const [busyTier, setBusyTier] = useState<'basic' | 'pro' | null>(null);
  const [error, setError] = useState<string | null>(null);
  // A trialing member switching onto a plan sold under the guarantee is charged
  // today, so the server prices it first and the page asks before paying.
  // The member confirms the exact amount the server quoted, and the confirm
  // sends it back so the server refuses to charge anything else.
  const [confirmSwitch, setConfirmSwitch] = useState<{
    tier: BillableTier;
    cadence: Cadence;
    amountDue: number;
    amountFormatted: string;
    // Whether this switch is covered by the money-back guarantee (not for a
    // customer who has already used their one refund).
    guarantee: boolean;
    // Set when a confirm came back because the price moved since the quote.
    notice?: string;
  } | null>(null);
  // A switch the bank must approve (3-D Secure) cannot be finished here; the
  // server hands back a billing-portal link that can.
  const [errorPortalUrl, setErrorPortalUrl] = useState<string | null>(null);
  const trialPlans = useMemo(() => new Set(trialPlanKeys), [trialPlanKeys]);
  // A referred visitor carries the zgx_ref cookie set when they landed on the
  // ?ref= link; surface a reminder that their discount applies at checkout.
  // Lazily derived (no effect) — this subtree is client-rendered (it bails out
  // of SSR via useSearchParams), so reading document.cookie here is safe.
  const [hasRefCookie] = useState(
    () => typeof document !== 'undefined' && /(?:^|;\s*)zgx_ref=/.test(document.cookie),
  );
  // Only promise a discount when the program is actually live. A campaign code
  // (business-card ?ref=TARGET) also sets zgx_ref, but it's a coupon — not a
  // person-to-person referral — so it gets the neutral campaign banner instead.
  const referralPresent = hasRefCookie && referralEnabled && !campaignActive;
  const campaignPresent = campaignActive;

  // Derived (not stored) from ?verified=1 / ?verify_error=… so we don't have
  // to setState inside an effect. If the user reloads the page, the param
  // is still present and the banner re-renders — that's the correct read
  // (verified state hasn't regressed; an invalid link is still invalid).
  const verifyNotice = useMemo<{ kind: 'success' | 'error'; message: string } | null>(() => {
    if (searchParams.get('verified') === '1') {
      return { kind: 'success', message: t('verifySuccessMessage') };
    }
    const verifyError = searchParams.get('verify_error');
    if (verifyError === 'expired') {
      return {
        kind: 'error',
        message: t('verifyExpiredMessage'),
      };
    }
    if (verifyError === 'invalid') {
      return {
        kind: 'error',
        message: t('verifyInvalidMessage'),
      };
    }
    // Signaled by /register when Resend errored during signup — the account is
    // fine, the user just needs to click Resend below to actually receive the
    // verification link.
    if (searchParams.get('email_send_failed') === '1') {
      return {
        kind: 'error',
        message: t('verifyEmailSendFailedMessage'),
      };
    }
    return null;
  }, [searchParams, t]);

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
  // ?reactivate=1 is the link in the second-touch reactivation email. Like
  // winback it only signals intent; checkout re-derives the extended-trial
  // entitlement server-side from reactivation_email_sent_at, so the flag alone
  // grants nothing. Paired with trial=1 in the email link, so these visitors
  // also get the trial-continuation hero below.
  const cameFromReactivate = searchParams.get('reactivate') === '1';
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
  // Trial length to show this visitor. A ?reactivate=1 arrival was promised the
  // extended trial in the email, so the hero + trial-eligible plan cards echo
  // that number; everyone else sees the standard 7. The server is still the
  // authority on what actually attaches (it re-checks reactivation eligibility),
  // exactly like the win-back discount banner — display reflects intent.
  const trialDaysDisplay = cameFromReactivate ? REACTIVATION_TRIAL_DAYS : TRIAL_DAYS;
  // Banner only shows when we have a definitive false. While the session is
  // loading, emailVerified is undefined; rendering the banner then would
  // flash it for everyone on every pricing-page visit.
  const showVerifyBanner = isAuthed && authSession?.user?.emailVerified === false;

  // Server already gated PROMO_END_AT + coupon configuration per cadence;
  // just pick the flag matching the user's current cadence selection.
  const promoActive = promoActiveByCadence[cadence] ?? false;
  // For the global banner, true whenever *any* cadence has a live offer —
  // independent of the current toggle so it doesn't flicker on cadence change.
  const anyPromoActive = Object.values(promoActiveByCadence).some(Boolean);

  // Preserve the win-back intent across the auth round-trip: a churned member
  // who clicks the email link while logged out would otherwise land back on a
  // bare /pricing (no ?winback=1) after registering/logging in and silently
  // lose the reactivation discount.
  const registerHref = cameFromWinback
    ? `/register?next=${encodeURIComponent('/pricing?winback=1')}`
    : cameFromReactivate
      ? `/register?next=${encodeURIComponent('/pricing?trial=1&reactivate=1')}`
      : '/register?next=/pricing';

  const callBilling = useCallback(
    async (
      path: '/api/billing/checkout' | '/api/billing/portal' | '/api/billing/change-plan',
      body?: object,
    ) => {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) {
        throw new Error(t('errorCsrfFailed'));
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
        const thrown = new Error(payload.message ?? payload.error ?? t('errorBillingFailed'));
        if (payload.code) (thrown as Error & { code?: string }).code = payload.code;
        throw thrown;
      }
      window.location.href = payload.url;
    },
    [t],
  );

  const handleSubscribe = useCallback(
    async (tier: BillableTier) => {
      if (!isAuthed) {
        router.push(registerHref);
        return;
      }
      if (currentTier === 'admin') {
        setError(t('errorAdminNoSubscribe'));
        return;
      }
      setError(null);
      setErrorPortalUrl(null);
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
            // win-back coupon for eligible churners (verified server-side).
            ...(cameFromWinback ? { winback: true } : {}),
            // Carry the reactivation intent so the server grants the extended
            // trial for an eligible inactive signup (verified server-side).
            ...(cameFromReactivate ? { reactivate: true } : {}),
          });
        }
      } catch (err) {
        const code = (err as Error & { code?: string })?.code;
        if (code === 'EMAIL_NOT_VERIFIED') {
          // Refresh in case verification just happened in another tab — if
          // it did, the banner above will be gone too and the user can retry.
          void refreshSession();
          setError(t('errorVerifyEmailFirst'));
        } else {
          setError(err instanceof Error ? err.message : t('errorSomethingWrong'));
        }
        setBusyTier(null);
      }
    },
    [authSession?.user?.id, callBilling, cadence, cameFromWinback, cameFromReactivate, currentTier, hasActiveSubscription, isAuthed, refreshSession, registerHref, router, t],
  );

  // Existing subscriber switching plan from a card. The server decides: a
  // trialing member moving onto a plan sold under the guarantee is charged
  // TODAY, so the first call only prices it and we ask before paying (the
  // second call carries confirm: true); anything else comes back as a `url` to
  // follow (the dashboard after an in-app switch, or Stripe's portal).
  const requestPlanChange = useCallback(
    async (tier: BillableTier, planCadence: Cadence, confirmAmountDue: number | null) => {
      const csrfResponse = await fetch('/api/auth/csrf', { credentials: 'include' });
      const csrf = (await csrfResponse.json()) as { csrfToken?: string };
      if (!csrf.csrfToken) throw new Error(t('errorCsrfFailed'));
      const response = await fetch('/api/billing/change-plan', {
        method: 'POST',
        credentials: 'include',
        headers: { 'content-type': 'application/json', 'x-csrf-token': csrf.csrfToken },
        body: JSON.stringify({
          tier,
          cadence: planCadence,
          ...(confirmAmountDue != null ? { confirm: true, expectedAmountDue: confirmAmountDue } : {}),
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
        portalUrl?: string;
        confirm?: { amountDue?: number; amountFormatted?: string; guarantee?: boolean };
      };
      // A quote: the first step, or a confirm refused because the price moved
      // (409, with the new quote). Either way the member confirms this amount.
      const quote = payload.confirm;
      if ((response.ok || response.status === 409) && quote && typeof quote.amountDue === 'number' && quote.amountFormatted) {
        setConfirmSwitch({
          tier,
          cadence: planCadence,
          amountDue: quote.amountDue,
          amountFormatted: quote.amountFormatted,
          guarantee: quote.guarantee !== false,
          ...(response.status === 409 && payload.error ? { notice: payload.error } : {}),
        });
        setBusyTier(null);
        return;
      }
      if (!response.ok) {
        const thrown = new Error(payload.error ?? t('errorBillingFailed'));
        if (payload.portalUrl) (thrown as Error & { portalUrl?: string }).portalUrl = payload.portalUrl;
        throw thrown;
      }
      if (!payload.url) throw new Error(t('errorBillingFailed'));
      window.location.href = payload.url;
    },
    [t],
  );

  const handleChangePlan = useCallback(
    async (tier: BillableTier) => {
      setError(null);
      setErrorPortalUrl(null);
      setBusyTier(tier);
      try {
        await requestPlanChange(tier, cadence, null);
      } catch (err) {
        setError(err instanceof Error ? err.message : t('errorSomethingWrong'));
        setBusyTier(null);
      }
    },
    [cadence, requestPlanChange, t],
  );

  const handleConfirmSwitch = useCallback(async () => {
    if (!confirmSwitch) return;
    const { tier, cadence: planCadence, amountDue } = confirmSwitch;
    setError(null);
    setErrorPortalUrl(null);
    setBusyTier(tier);
    setConfirmSwitch(null);
    try {
      await requestPlanChange(tier, planCadence, amountDue);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errorSomethingWrong'));
      setErrorPortalUrl((err as Error & { portalUrl?: string })?.portalUrl ?? null);
      setBusyTier(null);
    }
  }, [confirmSwitch, requestPlanChange, t]);

  const planName = useCallback(
    (tier: BillableTier, planCadence: Cadence) =>
      t('planNameFormat', {
        tier: tier === 'basic' ? t('basicTitle') : t('proTitle'),
        cadence:
          planCadence === 'monthly'
            ? t('cadenceMonthly')
            : planCadence === 'quarterly'
              ? t('cadenceQuarterly')
              : t('cadenceAnnual'),
      }),
    [t],
  );

  // Per card: does choosing it start a free trial, or is it paid up front under
  // the money-back guarantee? Mirrors checkout (the server re-derives both):
  //   • the trial plan, for a first-timer → trial;
  //   • any plan, for a ?reactivate=1 invitee → the extended trial they were
  //     emailed (checkout honors it on every plan);
  //   • every other plan → guarantee;
  //   • the trial plan for a returning member → neither: they are simply billed.
  //   • a subscriber never starts a trial from here;
  //   • the guarantee note appears only where it would actually cover them: a
  //     purchase, or a trialing member's switch (which ends the trial and is
  //     charged in-app) — not a paid member's switch (the guarantee covers a
  //     subscription's first payment only), not the plan they are already on,
  //     and not for someone who has already used their one refund.
  const cardTerms = useCallback(
    (tier: BillableTier) => {
      const planTrials = planHasFreeTrial({ tier, cadence }, trialPlans);
      const isCurrentPlan =
        hasActiveSubscription && currentPlan?.tier === tier && currentPlan?.cadence === cadence;
      const startsTrial = !hasActiveSubscription && !isResubscribe && (planTrials || cameFromReactivate);
      const guaranteeReachable = !hasActiveSubscription || subscriptionStatus === 'trialing';
      const hasGuarantee = !startsTrial && !planTrials && guaranteeReachable && !isCurrentPlan && !guaranteeUsed;
      return { startsTrial, hasGuarantee };
    },
    [
      cadence,
      cameFromReactivate,
      currentPlan,
      guaranteeUsed,
      hasActiveSubscription,
      isResubscribe,
      subscriptionStatus,
      trialPlans,
    ],
  );

  const actionFor = useCallback(
    (tier: BillableTier): TierAction => {
      const label = tier === 'basic' ? t('basicTitle') : t('proTitle');
      // A trial card keeps the word "trial" ("Start Basic Trial"); a card sold
      // under the guarantee says what it is — a subscription, billed today.
      const { startsTrial } = cardTerms(tier);
      const primaryLabel = startsTrial ? t('startTrialLabel', { label }) : t('subscribeToLabel', { label });
      // Tier- and cadence-specific register link so a logged-out plan click
      // returns to the pricing page with THIS plan and billing period selected.
      const registerHref = `/register?next=${encodeURIComponent(`/pricing?trial=1&plan=${tier}&cadence=${cadence}${cameFromReactivate ? '&reactivate=1' : ''}`)}`;
      if (authLoading) return { kind: 'link', href: registerHref, label: primaryLabel };
      if (!isAuthed) {
        return { kind: 'link', href: registerHref, label: primaryLabel };
      }
      if (currentTier === 'admin') return { kind: 'current', label: t('adminNoSubscription') };

      if (hasActiveSubscription) {
        // Current only when tier AND billing period match; with a price we do
        // not map (currentPlan null), fall back to the tier as before.
        const onThisPlan = currentPlan
          ? currentPlan.tier === tier && currentPlan.cadence === cadence
          : currentTier === tier;
        if (onThisPlan) return { kind: 'current', label: t('currentPlanLabel') };
        // Same tier, other billing period: name the period in the button.
        const switchLabel = currentPlan?.tier === tier ? planName(tier, cadence) : label;
        return { kind: 'portal', tier, label: t('switchToLabel', { label: switchLabel }) };
      }

      return { kind: 'subscribe', tier, label: primaryLabel };
    },
    [authLoading, cadence, cameFromReactivate, cardTerms, currentPlan, currentTier, hasActiveSubscription, isAuthed, planName, t],
  );

  // "Limited Time" pill omitted from the per-card highlights when the global
  // banner is already shown above — the banner carries that callout once
  // instead of repeating it twice per card.
  const savingsHighlight = (tier: BillableTier): string[] => {
    const pct = planDisplay({ tier, cadence }).savingsPct;
    return pct != null ? [t('saveHighlight', { pct })] : [];
  };
  const basicHighlights: string[] = savingsHighlight('basic');
  const proHighlights: string[] = [t('mostPopularHighlight'), ...savingsHighlight('pro')];
  const basicTerms = cardTerms('basic');
  const proTerms = cardTerms('pro');

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

      <section className="zg-psec" style={{ minHeight: '100vh', position: 'relative' }}>
        <div style={{ position: 'relative', zIndex: 1, maxWidth: 1200, margin: '0 auto' }}>
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
              <Sparkles size={14} /> {showTrialHero ? t('eyebrowAlmostDone') : t('eyebrowPricing')}
            </div>
            {showTrialHero ? (
              <>
                <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
                  {t('heroTrialTitle')}
                </h1>
                <p style={{ margin: '0 auto 12px', maxWidth: 760, color: C.light, fontSize: 20, lineHeight: 1.6, fontWeight: 600 }}>
                  {t('heroTrialSubtitle', { days: trialDaysDisplay })}
                </p>
                <p style={{ margin: '0 auto 14px', maxWidth: 760, color: C.amber, fontSize: 15, lineHeight: 1.7, fontWeight: 700 }}>
                  {t('heroTrialNoCharge', { days: trialDaysDisplay })}
                </p>
                <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
                  {t('heroTrialBody')}
                </p>
              </>
            ) : (
              <>
                <h1 style={{ margin: '18px 0 14px', fontSize: 'clamp(34px, 5vw, 64px)', lineHeight: 1.08, letterSpacing: '-1.2px' }}>
                  {t('heroTitle')}
                </h1>
                <p style={{ margin: '0 auto 18px', maxWidth: 760, color: C.light, fontSize: 18, lineHeight: 1.7, fontWeight: 500 }}>
                  {t('heroSubtitle')}
                </p>
                <p style={{ margin: '0 auto', maxWidth: 760, color: C.muted, fontSize: 15, lineHeight: 1.7 }}>
                  {t('heroBody', { days: TRIAL_DAYS })}
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
                borderRadius: 'var(--radius-panel)',
                border: `1px solid ${C.border}`,
                background: 'var(--color-surface)',
                textAlign: 'center',
                color: C.light,
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t('checkoutCancelledNotice')}
            </div>
          )}

          {anyPromoActive && <LimitedTimeBanner deadlineLabel={promoDeadlineLabel} />}

          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32 }}>
            <div>
              <CadenceToggle cadence={cadence} cadences={cadences} setCadence={setCadence} />
              <SavingsHint cadences={cadences} />
            </div>
          </div>

          {referralPresent && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-panel)',
                border: '1px solid var(--color-brand-primary)',
                color: 'var(--color-brand-primary)',
                background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.1))',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t('referralAppliedLabel')} &nbsp;{t('referralAppliedBody')}
            </div>
          )}

          {campaignPresent && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-panel)',
                border: '1px solid var(--color-brand-primary)',
                color: 'var(--color-brand-primary)',
                background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.1))',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t('discountAppliedLabel')} &nbsp;{t('discountAppliedBody')}
            </div>
          )}

          {cameFromWinback && isResubscribe && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-panel)',
                border: '1px solid var(--color-brand-primary)',
                color: 'var(--color-brand-primary)',
                background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.1))',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t('winbackWelcome')}
            </div>
          )}

          {cameFromReactivate && showTrialHero && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-panel)',
                border: '1px solid var(--color-brand-primary)',
                color: 'var(--color-brand-primary)',
                background: 'var(--color-brand-primary-soft, rgba(245,180,0,0.1))',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {t('reactivateWelcome', { days: trialDaysDisplay })}
            </div>
          )}

          {verifyNotice && (
            <div
              role="status"
              style={{
                maxWidth: 720,
                margin: '0 auto 24px',
                padding: '12px 16px',
                borderRadius: 'var(--radius-panel)',
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
                borderRadius: 'var(--radius-panel)',
                border: '1px solid var(--color-bear)',
                color: 'var(--color-bear)',
                background: 'var(--color-bear-soft)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {error}
              {errorPortalUrl && (
                <>
                  {' '}
                  <a href={errorPortalUrl} style={{ color: 'inherit', textDecoration: 'underline' }}>
                    {t('errorOpenPortal')}
                  </a>
                </>
              )}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
            <TierCard
              title={t('basicTitle')}
              tier="basic"
              cadence={cadence}
              promoActive={promoActive}
              highlights={basicHighlights}
              highlighted={preselectedPlan === 'basic'}
              startsTrial={basicTerms.startsTrial}
              hasGuarantee={basicTerms.hasGuarantee}
              trialDays={trialDaysDisplay}
              accent="var(--color-brand-primary)"
              features={[
                t('basicFeature1'),
                t('basicFeature2'),
                t('basicFeature3'),
              ]}
              action={actionFor('basic')}
              busy={busyTier === 'basic'}
              onSubscribe={handleSubscribe}
              onChangePlan={handleChangePlan}
            />
            <TierCard
              title={t('proTitle')}
              tier="pro"
              cadence={cadence}
              promoActive={promoActive}
              highlights={proHighlights}
              highlighted={preselectedPlan === 'pro'}
              startsTrial={proTerms.startsTrial}
              hasGuarantee={proTerms.hasGuarantee}
              trialDays={trialDaysDisplay}
              accent="var(--color-brand-accent)"
              features={[
                t('proFeature1'),
                t('proFeature2'),
                t('proFeature3'),
                t('proFeature4'),
              ]}
              action={actionFor('pro')}
              busy={busyTier === 'pro'}
              onSubscribe={handleSubscribe}
              onChangePlan={handleChangePlan}
            />
          </div>

          <BillingComparison
            cadences={cadences}
            cadence={cadence}
            setCadence={setCadence}
            promoActiveByCadence={promoActiveByCadence}
          />

          <PlanComparison />

          <section
            className="zg-panel zg-pcard"
            style={{
              marginTop: 36,
              maxWidth: 820,
              marginLeft: 'auto',
              marginRight: 'auto',
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
              {t('refundPolicyTitle')}
            </h2>
            <div style={{ marginTop: 12, color: C.muted, fontSize: 15, lineHeight: 1.75 }}>
              <p style={{ margin: 0 }}>
                {t('refundPolicyIntro1')}{' '}
                <Link href="/account" style={{ color: C.amber }}>
                  {t('accountLinkText')}
                </Link>{' '}
                {t('refundPolicyIntro2')}
              </p>
              <ul className="zg-policy-list" style={{ marginTop: 12 }}>
                <li>
                  <strong>{t('trialListLabel', { days: TRIAL_DAYS })}</strong> {t('trialListBody')}
                </li>
                <li>
                  <strong>{t('moneyBackListLabel')}</strong> {t('moneyBackListBody')}
                </li>
                <li>
                  <strong>{t('cancelAnytimeLabel')}</strong> {t('cancelAnytimeBody')}
                </li>
                <li>
                  <strong>{t('autoRenewLabel')}</strong> {t('autoRenewBody')}
                </li>
                <li>
                  <strong>{t('planSwitchLabel')}</strong> {t('planSwitchBody')}
                </li>
                <li>
                  <strong>{t('upgradesLabel')}</strong> {t('upgradesBody')}
                </li>
                <li>
                  <strong>{t('noRefundsLabel')}</strong> {t('noRefundsBody')}
                </li>
                <li>
                  <strong>{t('accessThroughLabel')}</strong> {t('accessThroughBody')}
                </li>
              </ul>
            </div>
          </section>
        </div>
      </section>

      {confirmSwitch && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="zgx-confirm-switch-title"
          onClick={() => setConfirmSwitch(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <div
            className="zg-panel"
            onClick={(event) => event.stopPropagation()}
            style={{ maxWidth: 460, width: '100%', padding: 24, background: 'var(--color-surface)' }}
          >
            <h2 id="zgx-confirm-switch-title" style={{ margin: 0, fontSize: 20, fontWeight: 800, color: C.light }}>
              {t('confirmSwitchTitle', { plan: planName(confirmSwitch.tier, confirmSwitch.cadence) })}
            </h2>
            {confirmSwitch.notice && (
              <p role="status" style={{ margin: '12px 0 0', color: C.amber, fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>
                {confirmSwitch.notice}
              </p>
            )}
            <p style={{ margin: '12px 0 0', color: C.light, fontSize: 15, lineHeight: 1.6 }}>
              {t('confirmSwitchBody', { amount: confirmSwitch.amountFormatted })}
            </p>
            {confirmSwitch.guarantee && (
              <p
                style={{
                  margin: '10px 0 0',
                  color: C.muted,
                  fontSize: 13,
                  lineHeight: 1.55,
                  display: 'flex',
                  gap: 6,
                  alignItems: 'flex-start',
                }}
              >
                <ShieldCheck size={14} style={{ color: C.amber, marginTop: 2, flexShrink: 0 }} aria-hidden />
                <span>{t('confirmSwitchGuarantee', { days: MONEY_BACK_GUARANTEE_DAYS })}</span>
              </p>
            )}
            <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="zg-btn zg-btn--primary"
                style={{ flex: 1, padding: '12px 18px', fontSize: 14 }}
                onClick={() => void handleConfirmSwitch()}
              >
                {t('confirmSwitchCta')}
              </button>
              <button
                type="button"
                className="zg-btn zg-btn--secondary"
                style={{ flex: 1, padding: '12px 18px', fontSize: 14 }}
                onClick={() => setConfirmSwitch(null)}
              >
                {t('confirmSwitchCancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer theme={theme} />
    </div>
  );
}
