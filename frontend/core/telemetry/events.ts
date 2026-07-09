// Canonical analytics event names — the single source of truth shared by the
// client (posthog-client) and server (posthog-server) so a funnel step is
// spelled identically wherever it fires. Keep these stable: renaming an event
// breaks historical funnels in PostHog.
//
// The conversion funnel, in order:
//   signup → first_value → checkout_started → trial_started → subscription_paid
// plus the churn signal: subscription_cancelled.
//
// This module is environment-agnostic (no 'use client', no node imports) so it
// can be imported from both browser components and server route handlers.

export const TelemetryEvent = {
  /** Account created (client, fired on successful /api/auth/register). */
  Signup: 'signup',
  /** First time a user sees core analytics — the "aha" (client, GEX load). */
  FirstValue: 'first_value',
  /** Subscribe clicked → redirecting to Stripe Checkout (client, pricing). */
  CheckoutStarted: 'checkout_started',
  /** Subscription entered a trial (server, Stripe webhook). */
  TrialStarted: 'trial_started',
  /** Subscription became active/paying — incl. trial→paid (server, webhook). */
  SubscriptionPaid: 'subscription_paid',
  /** Subscription ended → tier reset to public; the churn event (server). */
  SubscriptionCancelled: 'subscription_cancelled',
  /** Action Card permalink share button clicked (client, /cards/[id]). */
  CardShareClicked: 'card_share_clicked',
  /** Daily Scorecard permalink share button clicked (client, /scorecard/[date]). */
  ScorecardShareClicked: 'scorecard_share_clicked',
  /** Gamma Forecast Card permalink share button clicked (client, /forecast/[date]). */
  ForecastShareClicked: 'forecast_share_clicked',
  /** GEX Replay snapshot share button clicked (client, /replay/[date]). */
  ReplayShareClicked: 'replay_share_clicked',
  /** Free gamma-levels daily snapshot share/copy button clicked (client,
   *  /spx-gamma-levels + /spy-gamma-levels + /qqq-gamma-levels). The `channel`
   *  property records the surface: copy | x | reddit | stocktwits | native. */
  GammaLevelsShareClicked: 'gamma_levels_share_clicked',
  /** Free TradingView Pine indicator copied / downloaded / opened (client,
   *  /spx-gamma-levels + /spy-gamma-levels + /qqq-gamma-levels). */
  TradingViewIndicatorClicked: 'tradingview_indicator_clicked',
  /** Social crawler fetched an opengraph-image (server, one per URL per cache TTL). */
  OgPreviewed: 'og_previewed',

  // ── Paid-traffic conversion funnel ────────────────────────────────────────
  // The free gamma-levels pages double as the paid-X landing page. These events
  // trace a paid visitor from landing → trial CTA → checkout. Each carries the
  // primary `symbol` and, when present on the URL, the standard UTM params
  // (utm_source / utm_medium / utm_campaign / utm_content) via readUtmParams().
  //
  // Funnel: paid_landing_view → trial_cta_click / compare_plans_click /
  //         dashboard_preview_cta_click → signup_page_view →
  //         [account_created = `signup`] → pricing_page_view →
  //         checkout_started → [trial_started = `trial_started`] →
  //         subscription_paid.
  // Note: account_created is the existing `signup` event (fired on register)
  // and trial_started is the existing server-side `trial_started` event, so we
  // don't duplicate them here.

  /** Paid landing page viewed — top of the paid-traffic funnel (client,
   *  /spx-gamma-levels + /spy-gamma-levels + /qqq-gamma-levels). */
  PaidLandingView: 'paid_landing_view',
  /** A "Start free trial" CTA was clicked (client). The `location` property
   *  records which surface fired it: paid_landing_hero | dashboard_preview |
   *  paid_landing_footer | sticky_bar | home_hero | site_header. */
  TrialCtaClick: 'trial_cta_click',
  /** A "Compare plans" CTA was clicked (client). Same `location` convention. */
  ComparePlansClick: 'compare_plans_click',
  /** The CTA inside the live-dashboard product preview was clicked (client). */
  DashboardPreviewCtaClick: 'dashboard_preview_cta_click',
  /** The signup/register page was viewed (client, /register). Fires alongside
   *  the pageview so the funnel step is explicit and UTM-attributable. This is
   *  the funnel's `register_page_view` step. */
  SignupPageView: 'signup_page_view',
  /** The pricing / trial plan-selection page was viewed (client, /pricing).
   *  Fires on mount with any UTM still on the URL, so the paid funnel has an
   *  explicit pricing step between signup and checkout_started. */
  PricingPageView: 'pricing_page_view',
} as const;

export type TelemetryEventName = (typeof TelemetryEvent)[keyof typeof TelemetryEvent];
