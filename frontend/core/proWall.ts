// What a Basic member sees on a Pro page: app/unauthorized's 'upgrade' screen.
//
// It used to read like an error: "Upgrade to unlock", a table of raw tier
// names, a "Sign in as a different user" button, and suggestions written for
// visitors who had not signed up. That is the moment a member is most curious
// about Pro, so the screen now says what the page they reached for does, what
// Pro costs next to Basic, exactly what switching would mean for them today,
// and has one button to the switch.
//
// The page descriptions are the help center's own (content/help/platform), so
// the screen promises nothing the product docs don't. The screenshots are real
// product shots from assets/blog, served at /blog/ (make blog-images).
//
// Pure (no env, no DB): the page reads the member's plan and passes it in, and
// tests/proWall.test.ts pins the copy.

import type { BillableTier, BillingCadence } from './billingPlans.ts';
import { LIST_PRICE_USD, MONEY_BACK_GUARANTEE_DAYS, formatPerMonthUsd, formatUsd, perMonthEquivalentUsd } from './billingPlans.ts';
import { isTrialProUpgradeOpen, proSwitchPath, trialProUpgradeOpensAtMs } from './trialProUpgrade.ts';

export type ProPagePitch = {
  // One to three sentences: what the page tells you.
  pitch: string;
  // A real screenshot of the page, when there is one.
  image?: { src: string; alt: string };
  // The help article that explains it, when there is one.
  helpHref?: string;
};

const SIGNALS_HELP = '/help/platform/advanced-signals-dashboard';
const BACKTESTING_HELP = '/help/platform/backtesting';

// Keyed by the route the proxy redirected from (app/unauthorized ?path=).
export const PRO_PAGE_PITCHES: Record<string, ProPagePitch> = {
  '/trade-bias': {
    pitch:
      'Trade Bias folds the Composite Score and the Basic and Advanced signals into one read of dealer positioning and which way the flow leans, with the regime, the bias and the playbook for it on one screen. It describes the market; it does not forecast it.',
    image: { src: '/blog/zerogex-trade-bias.png', alt: 'The Trade Bias page: bias score, live read, regime, bias and playbook cards' },
    helpHref: '/help/platform/signals-overview',
  },
  '/signal-score': {
    pitch:
      'The Composite Score is a 0 to 100 regime score built from six option-structure components: net GEX sign, gamma anchor, put/call ratio, volatility regime, smart-money order-flow imbalance and dealer delta pressure. High readings mean a trend regime where moves can run; low ones mean compression. It tells you the regime, not the direction.',
    image: { src: '/blog/zerogex-msi-regime.png', alt: 'The Composite Score gauge with its score ranges and component contributions' },
    helpHref: '/help/platform/composite-score',
  },
  '/advanced-signals': {
    pitch:
      'The Advanced Signal Dashboard is the trigger grid for all eight Advanced signals: each card shows the score, the level it fires at and whether it has triggered, with a confluence matrix and each signal’s event timeline.',
    helpHref: SIGNALS_HELP,
  },
  '/eod-pressure': {
    pitch:
      'EOD Pressure asks whether the close is getting pinned. Active in the last 90 minutes of the session, it is built from dealer charm at spot, pin gravity, realized volatility and witching flags, and names the price the close may be pulled toward.',
    image: { src: '/blog/zerogex-eod-pressure-charm.png', alt: 'The EOD Pressure page: score, time ramp, pin target, charm at spot and gamma regime' },
    helpHref: SIGNALS_HELP,
  },
  '/gamma-vwap-confluence': {
    pitch:
      'Gamma/VWAP Confluence asks whether key levels are stacking up at one price: the gamma flip, VWAP, max pain, the max-gamma strike and the call wall. In positive gamma its reads are fades; in negative gamma, continuation.',
    helpHref: SIGNALS_HELP,
  },
  '/market-pressure': {
    pitch:
      'The Market Pressure Index asks whether the market is loaded to move. It combines wall pinch, flip proximity, the gamma regime, vanna and charm, premium and smart-money flow skew, IV rank and realized-volatility compression into a loading score and a direction.',
    helpHref: SIGNALS_HELP,
  },
  '/range-break-imminence': {
    pitch:
      'Range Break Imminence asks whether the current range is about to break, from a 20-bar compression read, skew, dealer delta and trap pressure. From 65 it is in the Break Watch band, where the page says to stop blindly fading the range.',
    helpHref: SIGNALS_HELP,
  },
  '/squeeze-setup': {
    pitch:
      'Squeeze Setup asks whether the market is coiled: a multi-day setup detector built from flow, momentum, gamma readiness, distance to the gamma flip and the VIX regime.',
    helpHref: SIGNALS_HELP,
  },
  '/trap-detection': {
    pitch:
      'Trap Detection asks whether a breakout just failed. It flags a break through a wall, VWAP, the gamma flip or the max-gamma strike as likely to fail when dealers are long gamma and gamma is strengthening.',
    helpHref: SIGNALS_HELP,
  },
  '/volatility-expansion': {
    pitch:
      'Volatility Expansion asks whether volatility is about to break out, from net GEX, volatility-normalized momentum and realized volatility.',
    helpHref: SIGNALS_HELP,
  },
  '/0dte-position-imbalance': {
    pitch:
      'The 0DTE Position Imbalance tells you which way 0DTE traders are leaning today, from call/put flow imbalance, the smart-money call/put ratio, the put/call ratio and moneyness, weighted by the hours left to the close.',
    helpHref: SIGNALS_HELP,
  },
  '/trading-signals': {
    pitch:
      'Bot Trading runs the strategies in the ZeroGEX catalog (call-wall fades, put-wall bounces, gamma-flip breaks and more) as bots. Follow one and get its entries and exits in-app or by email.',
  },
  '/backtesting': {
    pitch:
      'Backtesting replays a ZeroGEX strategy, or a rule you build, against historical option data, priced as real option-leg round trips net of slippage and commission, with a risk-adjusted tearsheet, a Monte Carlo outcome cone and results by gamma regime.',
    helpHref: BACKTESTING_HELP,
  },
  '/backtesting/insights': {
    pitch:
      'Pattern Insights shows the measured performance of every strategy in the ZeroGEX catalog, the same strategies Bot Trading and Backtesting use.',
    helpHref: BACKTESTING_HELP,
  },
};

const GENERIC_PITCH: ProPagePitch = {
  pitch:
    'Pro adds Trade Bias and the Composite Score, all eight Advanced Signals, TradeWorkz bots, backtesting and pattern insights, API access, and auto-updating NinjaTrader and Sierra Chart indicators.',
};

export function proPagePitch(path: string | null | undefined): ProPagePitch {
  return (path && PRO_PAGE_PITCHES[path]) || GENERIC_PITCH;
}

// The rest of Pro, listed under the pitch. Mirrors the pricing page's Pro card.
export const PRO_FEATURES: readonly string[] = [
  'Trade Bias and the Composite Score',
  'All eight Advanced Signals, including Squeeze Setup, Trap Detection and EOD Pressure',
  'TradeWorkz: Bot Trading, Backtesting and Pattern Insights',
  'API access: levels, GEX, flow, signals and their history, for your own code',
  'Auto-updating NinjaTrader and Sierra Chart indicators',
];

// ---------------------------------------------------------------------------
// What switching means for this member, today
// ---------------------------------------------------------------------------

export type ProWallTerms =
  // A Basic monthly trial in its last two days: switch and keep the rest free.
  | { kind: 'keep_trial'; trialEndIso: string }
  // A Basic monthly trial before that: switching now starts paying today; from
  // opensAtIso the two-day upgrade keeps the free days.
  | { kind: 'trial_early'; trialEndIso: string; opensAtIso: string; guarantee: boolean }
  // Any other trial (a reactivation trial on a longer plan): starts paying today.
  | { kind: 'trial_other'; guarantee: boolean }
  // A paying Basic member: Stripe prices the switch before anything changes.
  | { kind: 'paid' }
  // The last payment failed: fix the card before switching.
  | { kind: 'past_due' }
  // No subscription on file (a comped or legacy account).
  | { kind: 'none' };

export function proWallTerms(input: {
  // The subscription's status, or null when there is no subscription.
  status: string | null;
  current: { tier: BillableTier; cadence: BillingCadence } | null;
  // When the current period ends (a trial's end, while trialing).
  periodEndIso: string | null;
  // They have already used their one money-back refund.
  guaranteeUsed: boolean;
  nowMs: number;
}): ProWallTerms {
  const { status, periodEndIso } = input;
  if (status === 'trialing') {
    const trialEndMs = periodEndIso ? Date.parse(periodEndIso) : null;
    const basicMonthly = input.current?.tier === 'basic' && input.current.cadence === 'monthly';
    if (basicMonthly && periodEndIso && trialEndMs != null && Number.isFinite(trialEndMs)) {
      if (isTrialProUpgradeOpen({ status, current: input.current, trialEndMs, nowMs: input.nowMs })) {
        return { kind: 'keep_trial', trialEndIso: periodEndIso };
      }
      if (input.nowMs < trialEndMs) {
        return {
          kind: 'trial_early',
          trialEndIso: periodEndIso,
          opensAtIso: new Date(trialProUpgradeOpensAtMs(trialEndMs)).toISOString(),
          guarantee: !input.guaranteeUsed,
        };
      }
    }
    return { kind: 'trial_other', guarantee: !input.guaranteeUsed };
  }
  if (status === 'active') return { kind: 'paid' };
  if (status === 'past_due' || status === 'unpaid') return { kind: 'past_due' };
  return { kind: 'none' };
}

// "November 2 at 7:59 PM EST": New York time, like every billing cutoff the
// site and its emails name.
export function formatEtDateTime(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(new Date(iso));
}

export type ProWallCopy = {
  // "Pro is $59 a month, $20 more than Basic."
  priceLine: string;
  // What switching means for them right now.
  termsLine: string;
  cta: { label: string; href: string };
  // The year-long plan as a monthly figure, or null where it would not help.
  annual: { line: string; href: string } | null;
};

const PRO_MONTHLY = LIST_PRICE_USD.pro.monthly;
const BASIC_MONTHLY = LIST_PRICE_USD.basic.monthly;

export function proWallCopy(terms: ProWallTerms): ProWallCopy {
  const proMonthly = formatUsd(PRO_MONTHLY);
  const basicMonthly = formatUsd(BASIC_MONTHLY);
  const priceLine = `Pro is ${proMonthly} a month, ${formatUsd(PRO_MONTHLY - BASIC_MONTHLY)} more than Basic.`;
  const switchCta = { label: 'Switch to Pro', href: proSwitchPath('locked_page') };
  const guaranteeClause = (covered: boolean) =>
    covered ? `, covered by the ${MONEY_BACK_GUARANTEE_DAYS}-day money-back guarantee` : '';
  const annual = {
    line: `Or pay for a year: Pro annual is ${formatUsd(LIST_PRICE_USD.pro.annual)}, about ${formatPerMonthUsd(
      perMonthEquivalentUsd({ tier: 'pro', cadence: 'annual' }),
    )} a month, which is less than Basic's ${basicMonthly} monthly price.`,
    href: '/pricing?plan=pro&cadence=annual&from=locked_page',
  };

  switch (terms.kind) {
    case 'keep_trial':
      return {
        priceLine,
        termsLine: `Your free trial ends ${formatEtDateTime(terms.trialEndIso)}. Switch now and the rest of it stays free: your first payment becomes Pro's ${proMonthly} instead of Basic's ${basicMonthly}, and you can still cancel any time before then.`,
        cta: switchCta,
        annual: null,
      };
    case 'trial_early':
      return {
        priceLine,
        termsLine: `Switching now ends your free trial and starts Pro at ${proMonthly} today${guaranteeClause(terms.guarantee)}. Or wait: from ${formatEtDateTime(terms.opensAtIso)}, in the last two days of your trial, you can switch and keep those days free.`,
        cta: switchCta,
        annual,
      };
    case 'trial_other':
      return {
        priceLine,
        termsLine: `Switching now ends your free trial and starts Pro today${guaranteeClause(terms.guarantee)}. You'll see the exact amount before you confirm.`,
        cta: switchCta,
        annual,
      };
    case 'paid':
      return {
        priceLine,
        termsLine: "Switch from the pricing page. Stripe shows you the exact amount before anything changes.",
        cta: switchCta,
        annual,
      };
    case 'past_due':
      return {
        priceLine,
        termsLine: "Your last payment didn't go through. Update your card on the Account page first, then you can switch.",
        cta: { label: 'Update your card', href: '/account' },
        annual: null,
      };
    case 'none':
      return {
        priceLine,
        termsLine: 'Compare the plans to pick the one that fits.',
        cta: { label: 'Compare plans', href: '/pricing?plan=pro' },
        annual: null,
      };
  }
}
