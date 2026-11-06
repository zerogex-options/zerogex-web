// What a free member sees on a paid page: app/unauthorized's 'newcomer' screen.
//
// It is the first screen a free member sees after signing in (login lands on
// /dashboard, which is a Basic page), and it used to be a bare card: "Your
// account is ready. Choose a plan", two buttons and a trial line. Nothing said
// what the page they reached for does, what Basic costs, or what comes with it.
// The Basic member reaching a Pro page got that screen in October
// (core/proWall.ts); this is the same treatment for the much larger group that
// has never paid.
//
// The screen now says, for the page they reached for: what it does, in the help
// center's words (content/help/platform), with a real screenshot where the site
// has one; what the plan costs and how the trial works for them (no card, when
// BILLING_NO_CARD_TRIAL is on); the year as a monthly figure; what the plan
// includes; and one button to start.
//
// A free member reaching a Pro page gets that page's Pro pitch (core/proWall.ts),
// Pro's price and terms, and Basic's trial as the way in.
//
// Every line is in the member's language (the `lang` cookie, passed in).
// English is written here; the other languages are in core/basicWall.i18n.ts.
//
// Pure (no env, no DB): the page reads the trial policy and passes it in, and
// tests/basicWall.test.ts pins the copy.

import {
  LIST_PRICE_USD,
  MONEY_BACK_GUARANTEE_DAYS,
  formatPerMonthUsd,
  formatUsd,
  perMonthEquivalentUsd,
} from './billingPlans.ts';
import type { Locale } from './i18n/locales.ts';
import { DEFAULT_LOCALE } from './i18n/locales.ts';
import { BASIC_WALL_TRANSLATIONS } from './basicWall.i18n.ts';
import { OFFER_TRIAL_DAYS } from './promoCodeOffer.ts';
import { proFeatures, proPagePitch, type ProPagePitch } from './proWall.ts';

const SIGNALS_HELP = '/help/platform/basic-signals-dashboard';

// The six Basic signals share one pitch: they are read side by side.
const BASIC_SIGNALS_PITCH: ProPagePitch = {
  pitch:
    'The six Basic signals are continuous reads of the options market, each on a -100 to +100 line with a sparkline and the inputs behind the score, side by side on the Basic Signal Dashboard.',
  helpHref: SIGNALS_HELP,
};

// Keyed by the route the proxy redirected from (app/unauthorized ?path=).
// Screenshots only where the image really is that page (assets/blog, served at
// /blog/ by make blog-images).
export const BASIC_PAGE_PITCHES: Record<string, ProPagePitch> = {
  '/dashboard': {
    pitch:
      'The Main Dashboard is the live, single-screen read of the market for SPX, SPY, QQQ, NDX, ES and NQ: where dealers are positioned (the gamma regime, the gamma flip, the call and put walls) and what the tape is saying (flow and volatility). It is where you get your bearings in 30 seconds before opening any other page.',
    image: {
      src: '/blog/zerogex-dashboard-overview.png',
      alt: 'The key level cards on the Main Dashboard: call wall, put wall, net GEX and the gamma flip',
    },
    helpHref: '/help/platform/dashboard',
  },
  '/my-dashboard': {
    pitch: 'My Dashboard is a board you build yourself from ZeroGEX cards and charts, laid out the way you trade.',
  },
  '/fuseline-radar': {
    pitch:
      'The Fuseline Radar is built around one trade: you set a Fuse, a direction and one or two targets, and it draws your route on the Gamma Chart beside a strike-by-strike ladder of modeled gamma and how it has changed over the last few minutes. It organizes the data around your plan; it is not a trade signal.',
    helpHref: '/help/platform/fuseline-radar',
  },
  '/live-bulletin': {
    pitch:
      'The Live Bulletin is a live dealer-gamma report card for one symbol at a time: the gamma regime, the gamma flip, the pin strike, the call and put walls, max pain, net GEX, an expected-range band and a positioning map, on one card you can download or share.',
    helpHref: '/help/platform/live-bulletin',
  },
  '/gamma-exposure': {
    pitch:
      'Dealer Positioning is the structural map of the options book: net GEX at spot, the gamma flip, the call and put walls, and how dealer gamma spreads across strikes and expirations. Every chart on it answers one question: where are dealers positioned, and what will they have to do as price moves?',
    image: {
      src: '/blog/zerogex-strike-dte-heatmap.png',
      alt: 'The GEX heatmap by strike and days to expiry on the Dealer Positioning page',
    },
    helpHref: '/help/platform/dealer-positioning',
  },
  '/greeks-gex': {
    pitch:
      'GEX Summary puts the headline GEX numbers and the levels they imply on one screen, maps dealer gamma across price and time, and shows how the gamma flip holds up across option horizons and whether today’s dealer gamma is unusual.',
    helpHref: '/help/platform/gex-summary',
  },
  '/gex-strike-profile': {
    pitch:
      'The GEX Strike Profile sets price beside modeled dealer gamma and open positions, strike by strike, with the gamma flip and the call and put walls marked, so you can see the levels price is trading into.',
    image: {
      src: '/blog/zerogex-strike-profile-live.png',
      alt: 'The GEX Strike Profile: price beside gamma and positions by strike, with the gamma flip and the walls marked',
    },
  },
  '/gex-heatmap': {
    pitch:
      'The GEX Heatmap lays dealer gamma out as a grid of strike against session time, so the strikes carrying heavy dealer gamma show up as bright bands.',
  },
  '/gamma-shift': {
    pitch:
      'Gamma Shift shows not where dealer gamma sits but how it changed over a window you pick, split into new positioning and the same contracts re-pricing as price moved, and how much of the book expires at the next close.',
  },
  '/max-pain': {
    pitch:
      'Max Pain shows the strike at each expiration where the most option premium expires worthless, and reads it next to the gamma profile, so you can tell a level that acts as a magnet from a coincidence.',
    helpHref: '/help/platform/max-pain',
  },
  '/flow-analysis': {
    pitch:
      'Flow Analysis is the tape view of the options market: what traded today and which side crossed the spread to trade it, with contracts bought and sold, net premium and the put/call ratio on one clock.',
    helpHref: '/help/platform/flow-analysis',
  },
  '/smart-money': {
    pitch:
      'Smart Money screens for option prints big or unusual enough to be somebody’s position rather than hedging noise, splits them into calls and puts, and shows how the bias builds through the day.',
    helpHref: '/help/platform/smart-money',
  },
  '/hedging-flow': {
    pitch:
      'Hedging Flow estimates the dealer hedging pressure created by today’s option trades and lays it against price: what today’s flow is making dealers do, not just what the standing book implies.',
    image: {
      src: '/blog/zerogex-hedging-flow-spy-2026-09-28-cropped.png',
      alt: 'Hedging Flow on SPY: estimated dealer hedging pressure against price through the session',
    },
    helpHref: '/help/platform/hedging-flow',
  },
  '/forced-flow': {
    pitch:
      'Forced Flow looks forward: from the option book as it stands, how much stock dealers would have to buy or sell to stay hedged if price, time or implied volatility moves, and the zero-flow level where that hedging nets to nothing.',
    helpHref: '/help/platform/forced-flow',
  },
  '/market-tide': {
    pitch:
      'Market Tide reads every index ZeroGEX tracks at once: where market-wide option money is flowing, scored from -100 to +100 and adjusted for the dealer gamma regime that will amplify or absorb it.',
  },
  '/volatility': {
    pitch:
      'Volatility sets put against call implied volatility across strikes, to show which side the market is paying up for, and realized volatility against what the chain is pricing, to show whether that pricing has been earned.',
  },
  '/basic-signals': BASIC_SIGNALS_PITCH,
  '/tape-flow-bias': BASIC_SIGNALS_PITCH,
  '/skew-delta': BASIC_SIGNALS_PITCH,
  '/vanna-charm-flow': BASIC_SIGNALS_PITCH,
  '/dealer-delta-pressure': BASIC_SIGNALS_PITCH,
  '/gex-gradient': BASIC_SIGNALS_PITCH,
  '/positioning-trap': BASIC_SIGNALS_PITCH,
  '/option-contracts': {
    pitch:
      'Live Options Quotes follows one option contract through the session: its last trade price and each minute’s volume, split by whether it traded at the ask, the mid or the bid.',
    helpHref: '/help/platform/option-contracts',
  },
  '/options-calculator': {
    pitch:
      'The Strategy Builder prices a single- or multi-leg options strategy at live quotes and shows its profit or loss at expiration across a range of prices.',
    helpHref: '/help/platform/options-calculator',
  },
  '/premium-heatmap': {
    pitch:
      'Premium Surface maps option premium across strikes and expirations: the time value left in each call or put, or how far price has to move for it to break even at expiration.',
  },
  '/spread-monitor': {
    pitch:
      'The Spread Monitor shows quoted bid/ask width and liquidity across the option chain: whether a market is tradeable, not just what it means.',
    helpHref: '/help/platform/spread-monitor',
  },
  '/intraday-tools': {
    pitch:
      'Technicals is the price-first read of the active symbol: VWAP, the opening range, volume spikes and momentum divergence, drawn against the gamma flip, the walls and the pin.',
    helpHref: '/help/platform/technicals',
  },
  '/pair-comparison': {
    pitch:
      'Pair Comparison sets the dealer-gamma structure of two of SPY, QQQ, SPX and NDX side by side: strike-aligned net GEX ladders centered on spot, with the gamma flip, the call and put walls and max pain marked.',
  },
};

const GENERIC_BASIC_PITCH: ProPagePitch = {
  pitch:
    'Basic is the live ZeroGEX: real-time levels for SPX, SPY, QQQ, NDX, ES and NQ, the Main Dashboard and the Gamma Terminal, every Metrics page, the options flow pages, the six Basic signals and wall alerts.',
};

// The pitch for the Basic page they reached for, in their language: the same
// screenshot and help link, with the words and the alt text translated. A page
// with no translation yet keeps its English pitch.
export function basicPagePitch(path: string | null | undefined, locale: Locale = DEFAULT_LOCALE): ProPagePitch {
  // Own keys only: ?path= is whatever the visitor typed.
  const route = path && Object.prototype.hasOwnProperty.call(BASIC_PAGE_PITCHES, path) ? path : null;
  const english = route ? BASIC_PAGE_PITCHES[route] : GENERIC_BASIC_PITCH;
  if (locale === DEFAULT_LOCALE) return english;
  const text = basicWallText(locale);
  const translated = route ? text.pitches[route] : { pitch: text.genericPitch };
  if (!translated) return english;
  return {
    ...english,
    pitch: translated.pitch,
    ...(english.image ? { image: { src: english.image.src, alt: translated.alt ?? english.image.alt } } : {}),
  };
}

// What Basic includes. The pricing page's Basic card (app/pricing/Client.i18n.ts
// basicFeature1-6), plus wall alerts, which come with every paid plan.
export const BASIC_FEATURES: readonly string[] = [
  'Real-time levels for SPX, SPY, QQQ, NDX, ES and NQ: the gamma flip, call and put walls, and max pain',
  'The Main Dashboard and the live Gamma Terminal, plus My Dashboard to build your own board',
  'Dealer Positioning, GEX Heatmap, GEX Strike Profile, Volatility and every other Metrics page',
  'Options flow: Flow Analysis, Smart Money, Hedging Flow and Market Tide',
  'All six Basic Signals, including Vanna/Charm Flow and Dealer Delta Pressure',
  'Wall alerts when price hits or breaks a call or put wall, in the app and by email',
  'Strategy Builder and Live Options Quotes',
];

// ---------------------------------------------------------------------------
// The words, in one language
// ---------------------------------------------------------------------------

export type Plan = 'Basic' | 'Pro';

export type BasicWallText = {
  labels: {
    // "Main Dashboard is part of Basic"
    heading: (page: string | undefined, plan: Plan) => string;
    // Under the screenshot.
    imageCaption: (page: string | undefined) => string;
    comparePlans: string;
    freeLevels: string;
    // Above BASIC_FEATURES, and above Pro's features for a Pro page.
    basicFeaturesHeading: string;
    proFeaturesHeading: string;
    howItWorks: (page: string | undefined) => string;
    seeAnnual: (plan: Plan) => string;
  };
  copy: {
    // "Basic is $39 a month."
    price: (v: { plan: Plan; amount: string }) => string;
    trialNoCard: (days: number) => string;
    trialCard: (days: number) => string;
    upFront: (days: number) => string;
    // After upFront on a Pro page, when Basic's trial is open to them.
    orBasicTrial: (days: number) => string;
    orBasicTrialNoCard: (days: number) => string;
    // When the session could not be resolved: promise nothing.
    unresolved: string;
    annual: (v: { plan: Plan; annual: string; perMonth: string }) => string;
    startTrial: string;
    getPlan: (plan: Plan) => string;
    startBasicTrial: string;
  };
  // BASIC_FEATURES, in the same order.
  features: readonly string[];
  // Each BASIC_PAGE_PITCHES entry's pitch and screenshot alt text, by route.
  pitches: Readonly<Record<string, { pitch: string; alt?: string }>>;
  genericPitch: string;
};

const ENGLISH: BasicWallText = {
  labels: {
    heading: (page, plan) => `${page ?? 'This page'} is part of ${plan}`,
    imageCaption: (page) => `${page ?? 'ZeroGEX'} on a past session: an example reading, not today’s.`,
    comparePlans: 'Compare plans',
    freeLevels: 'Or keep using the free delayed levels',
    basicFeaturesHeading: 'What Basic includes',
    proFeaturesHeading: 'Everything in Basic, plus',
    howItWorks: (page) => `How ${page ?? 'it'} works`,
    seeAnnual: (plan) => `See ${plan} annual`,
  },
  copy: {
    price: ({ plan, amount }) => `${plan} is ${amount} a month.`,
    trialNoCard: (days) =>
      `Start with a ${days}-day free trial, no card needed. Nothing is charged unless you add a card to keep it.`,
    trialCard: (days) =>
      `Start with a ${days}-day free trial. Nothing is charged until it ends, and you can cancel any time before then.`,
    upFront: (days) => `Paid up front, with a ${days}-day money-back guarantee.`,
    orBasicTrial: (days) => `Or start with Basic’s ${days}-day free trial and switch to Pro from there.`,
    orBasicTrialNoCard: (days) =>
      `Or start with Basic’s ${days}-day free trial, no card needed, and switch to Pro from there.`,
    unresolved: 'Pick a plan on the pricing page to unlock it.',
    annual: ({ plan, annual, perMonth }) => `Or pay for a year: ${plan} annual is ${annual}, about ${perMonth} a month.`,
    startTrial: 'Start your free trial',
    getPlan: (plan) => `Get ${plan}`,
    startBasicTrial: 'Start with the Basic trial',
  },
  features: BASIC_FEATURES,
  pitches: Object.fromEntries(
    Object.entries(BASIC_PAGE_PITCHES).map(([route, p]) => [route, { pitch: p.pitch, alt: p.image?.alt }]),
  ),
  genericPitch: GENERIC_BASIC_PITCH.pitch,
};

function basicWallText(locale: Locale): BasicWallText {
  return locale === 'en' ? ENGLISH : (BASIC_WALL_TRANSLATIONS[locale] ?? ENGLISH);
}

// ---------------------------------------------------------------------------
// The screen
// ---------------------------------------------------------------------------

export type NewcomerWallInput = {
  // The route they reached for (app/unauthorized ?path=).
  path: string | null;
  // Its name the way their menu shows it, or undefined for a path not in it.
  pageLabel: string | undefined;
  // The plan that page needs.
  required: 'basic' | 'pro';
  // We know this account can still take a trial (core/returningMember.ts
  // resolveWall). False when the session could not be read: promise nothing.
  promiseTrial: boolean;
  // Which monthly plans start with a free trial (BILLING_TRIAL_PLANS).
  basicTrial: boolean;
  proTrial: boolean;
  // New trials start without a card (BILLING_NO_CARD_TRIAL, core/noCardTrial.ts).
  noCard: boolean;
  // Where each plan's button goes, and the plain pricing page
  // (core/returningMember.ts pricingHrefFor).
  basicHref: string;
  proHref: string;
  compareHref: string;
};

export type NewcomerWall = {
  plan: Plan;
  heading: string;
  pitch: ProPagePitch;
  imageCaption: string;
  // "Basic is $39 a month."
  priceLine: string;
  // How starting works for them: the trial, or paying up front.
  termsLine: string;
  cta: { label: string; href: string };
  secondary: { label: string; href: string };
  annual: { line: string; label: string; href: string } | null;
  featuresHeading: string;
  features: readonly string[];
  howItWorks: string | null;
  comparePlans: string;
  freeLevels: string;
};

export function newcomerWall(input: NewcomerWallInput, locale: Locale = DEFAULT_LOCALE): NewcomerWall {
  const { labels, copy } = basicWallText(locale);
  const days = OFFER_TRIAL_DAYS;
  const isPro = input.required === 'pro';
  const plan: Plan = isPro ? 'Pro' : 'Basic';
  const tier = isPro ? 'pro' : 'basic';
  const pitch = isPro ? proPagePitch(input.path, locale) : basicPagePitch(input.path, locale);
  const planTrial = isPro ? input.proTrial : input.basicTrial;
  const trialOpen = input.promiseTrial && planTrial;

  const trialLine = input.noCard ? copy.trialNoCard(days) : copy.trialCard(days);
  const termsLine = !input.promiseTrial
    ? copy.unresolved
    : trialOpen
      ? trialLine
      : isPro && input.basicTrial
        ? `${copy.upFront(MONEY_BACK_GUARANTEE_DAYS)} ${input.noCard ? copy.orBasicTrialNoCard(days) : copy.orBasicTrial(days)}`
        : copy.upFront(MONEY_BACK_GUARANTEE_DAYS);

  const href = isPro ? input.proHref : input.basicHref;
  const cta = { label: trialOpen ? copy.startTrial : copy.getPlan(plan), href };
  // On a Pro page, Basic's trial is the other way in; otherwise, the plans.
  const secondary =
    isPro && input.promiseTrial && input.basicTrial && !trialOpen
      ? { label: copy.startBasicTrial, href: input.basicHref }
      : { label: labels.comparePlans, href: input.compareHref };

  return {
    plan,
    heading: labels.heading(input.pageLabel, plan),
    pitch,
    imageCaption: labels.imageCaption(input.pageLabel),
    priceLine: copy.price({ plan, amount: formatUsd(LIST_PRICE_USD[tier].monthly) }),
    termsLine,
    cta,
    secondary,
    annual: {
      line: copy.annual({
        plan,
        annual: formatUsd(LIST_PRICE_USD[tier].annual),
        perMonth: formatPerMonthUsd(perMonthEquivalentUsd({ tier, cadence: 'annual' })),
      }),
      label: labels.seeAnnual(plan),
      // No from=locked_page: that tag records plan switches, and a free member
      // has no plan to switch from.
      href: `/pricing?plan=${tier}&cadence=annual`,
    },
    featuresHeading: isPro ? labels.proFeaturesHeading : labels.basicFeaturesHeading,
    features: isPro ? proFeatures(locale) : basicWallText(locale).features,
    howItWorks: pitch.helpHref ? labels.howItWorks(input.pageLabel) : null,
    comparePlans: labels.comparePlans,
    freeLevels: labels.freeLevels,
  };
}
