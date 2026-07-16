'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';

type FAQ = {
  id: string;
  q: string;
  a: string;
};

type FAQCategory = {
  id: string;
  title: string;
  blurb: string;
  faqs: FAQ[];
};

const FAQ_DATA: FAQCategory[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    blurb: 'New to ZeroGEX? Start here.',
    faqs: [
      {
        id: 'what-is-zerogex',
        q: 'What is ZeroGEX?',
        a: 'ZeroGEX is a real-time options analytics platform built around dealer positioning. It shows you where dealers are long or short gamma, where the gamma flip sits, where the call and put walls are, and runs a suite of real-time signals on top of all of it. The point is to give you the same lens market makers use to hedge — so you can read intraday price action in those terms.',
      },
      {
        id: 'who-its-for',
        q: 'Who is ZeroGEX built for?',
        a: 'Active intraday traders who trade SPY, SPX, or QQQ and want a structural read of the options market. Day traders, swing traders with intraday timing, quants who want signal data via API, and option-selling strategists for whom dealer positioning is the daily input. We are not a single-name equity research tool.',
      },
      {
        id: 'do-i-need-to-sign-up',
        q: 'Do I need to sign up to use ZeroGEX?',
        a: 'You can browse the marketing site, Education Hub, articles, guides, and the free SPX gamma levels page without an account. The dashboard, signals, metrics, strategy tools, and live bulletin require a paid plan (Basic or Pro). See the Pricing page for the live tier breakdown.',
      },
      {
        id: 'free-trial',
        q: 'Is there a free trial?',
        a: 'Yes. Both Basic and Pro come with a free trial. The trial length is shown on the Pricing page. At the end of the trial, the subscription continues automatically at the rate you signed up at. Cancel before the trial ends to avoid being charged.',
      },
      {
        id: 'first-page',
        q: 'What page should I open first?',
        a: 'The Dashboard. It surfaces the regime label, net GEX, the gamma flip, the walls, max pain, the composite score, and the day\'s trade-bias chip — everything you need to orient. From there, drill into the signal page that matches what you\'re looking for.',
      },
    ],
  },
  {
    id: 'data-refresh',
    title: 'Data &amp; Refresh',
    blurb: 'Coverage, cadence, and how the streaming works.',
    faqs: [
      {
        id: 'symbols',
        q: 'What symbols are currently supported?',
        a: 'ZeroGEX provides full analytics coverage for SPY (S&P 500 ETF), SPX (S&P 500 Index), and QQQ (Nasdaq 100 ETF). These are the three most liquid, most gamma-rich underlyings in the U.S. options market — the instruments where dealer hedging activity has the greatest intraday impact.',
      },
      {
        id: 'single-names',
        q: 'Will you add single-name equities (AAPL, TSLA, NVDA, etc.)?',
        a: 'Not on the roadmap. The dealer-positioning model works best in instruments where institutional options flow dominates the underlying — that is the index complex. Single names have idiosyncratic-news noise that makes the GEX read less reliable.',
      },
      {
        id: 'refresh-cadence',
        q: 'How often does the data refresh?',
        a: 'Quotes and flow refresh every ~1 second during regular hours. Signal scores refresh every 1–5 seconds depending on the signal. The GEX surface refreshes every 5–15 seconds (the chain snapshot is the bottleneck). Everything streams — you do not need to reload the page.',
      },
      {
        id: 'pre-market',
        q: 'Does ZeroGEX show pre-market and after-hours data?',
        a: 'Yes. The price tile shows extended-hours quotes alongside the prior regular-session close for context. Some signals (EOD Pressure, 0DTE Position Imbalance) only compute during the regular session by design.',
      },
      {
        id: 'data-source',
        q: 'Where does the data come from?',
        a: 'ZeroGEX uses OPRA-feed options data (the consolidated U.S. options tape) plus the underlying equity quote feed. Both are professional, institutional-grade real-time data sources. We don\'t disclose specific vendor names publicly.',
      },
      {
        id: 'history-depth',
        q: 'How far back does historical data go?',
        a: 'Quotes and flow have several years of historical bars. Signal scores are backfilled to the inception of each signal. GEX surfaces have daily snapshot history; intraday GEX history is shorter. The Backtesting page surfaces the available range for whatever signal you select.',
      },
    ],
  },
  {
    id: 'signals',
    title: 'Signals',
    blurb: 'How scores work, what triggers mean, and how to use them.',
    faqs: [
      {
        id: 'how-many-signals',
        q: 'How many signals does ZeroGEX run?',
        a: 'Fourteen total — eight Advanced (event-driven, with discrete triggers) and six Basic (continuous, feeding the composite). See the Signals: Explained guide for the full reference matrix.',
      },
      {
        id: 'advanced-vs-basic',
        q: 'What is the difference between Advanced and Basic signals?',
        a: 'Advanced signals ask a sharp situational question and fire a discrete trigger when their score crosses a threshold. Basic signals are continuous reads that feed the composite score with a fixed weight. Advanced signals trigger; Basic signals weight.',
      },
      {
        id: 'score-zero',
        q: 'What does a signal score of 0 mean?',
        a: 'Almost never "neutral market". For most signals it means the data is insufficient or this specific question has no answer right now. Read a 0 as "no read", not "no trade". A truly neutral market typically shows scores meandering around ±0.1, not a clean zero.',
      },
      {
        id: 'composite-score',
        q: 'What is the Composite Score?',
        a: 'The Composite Score (internally MSI) is the blended read across all signals on the active symbol. It lives on the same [-1, +1] line as every individual signal. Positive ⇒ structural bullish lean; negative ⇒ bearish. Magnitude is conviction. Use it as a filter, not a forecast.',
      },
      {
        id: 'signal-alerts',
        q: 'Do I get alerts when signals fire?',
        a: 'In-app, yes. Every trigger lands in the Live Bulletin and lights the corresponding signal card. ZeroGEX does not currently send signal alerts by SMS, push, or email — the in-app log is the system of record. We may add more channels if there is demand.',
      },
      {
        id: 'signal-accuracy',
        q: 'How accurate are the signals?',
        a: 'It depends on the signal, the regime, and how you use it. Signals are not standalone trade tickets — they are filters and triggers inside a process. The Backtesting page lets you replay any signal against historical data with your own rules. We strongly recommend out-of-sample validation before deploying any rule.',
      },
    ],
  },
  {
    id: 'tiers-billing',
    title: 'Tiers &amp; Billing',
    blurb: 'Plans, pricing, refunds, and managing your subscription.',
    faqs: [
      {
        id: 'tiers',
        q: 'What are the tier differences?',
        a: 'Public is the free, browse-only experience (marketing site + education). Basic unlocks the Dashboard, Live Bulletin, all Metrics, Strategy Tools, and all Basic Signals. Pro adds all Advanced Signals, the Composite Score, Backtesting, and API access. The Pricing page has the live breakdown.',
      },
      {
        id: 'monthly-vs-annual',
        q: 'Should I pay monthly or annual?',
        a: 'Annual is meaningfully discounted versus monthly — the exact rate is on the Pricing page. Most active users switch to annual after a couple of months. You can switch in the Stripe billing portal at any time; proration handles the math.',
      },
      {
        id: 'switch-plan',
        q: 'How do I switch my plan (tier or monthly/annual)?',
        a: 'Open the Account page and click "Manage subscription" to open the Stripe billing portal — you can move between Basic and Pro and between monthly and annual right there. Upgrades (and monthly → annual) take effect immediately; downgrades and annual → monthly take effect at the end of your current period, so you keep what you paid for until then. Proration is applied and shows up on your next invoice, not as an upfront charge. If you’re still in your free trial, switching keeps the trial — you won’t be charged until it ends, and then you’re billed the new plan’s rate.',
      },
      {
        id: 'tier-upgrade',
        q: 'How do I upgrade from Basic to Pro?',
        a: 'Open the Account page, click "Manage subscription" to open the Stripe billing portal, and switch tiers there. Tier access updates immediately; the prorated difference is applied to your next invoice.',
      },
      {
        id: 'cancellation',
        q: 'How do I cancel?',
        a: 'Through the Stripe billing portal, accessed from the Account page. Cancellation takes effect at the end of the current billing period — you keep paid access until then. After that, your tier reverts to Public; your account is not deleted.',
      },
      {
        id: 'refunds',
        q: 'Do you offer refunds?',
        a: 'The trial is unconditional — cancel before it ends and you are never charged. Paid subscriptions are billed in advance and not pro-rated on cancellation by default. For exceptions and edge cases, email support@zerogex.io and we will work it out.',
      },
      {
        id: 'billing-issue',
        q: 'My payment failed. What now?',
        a: 'Stripe retries automatically over several days. During the retry window, your subscription is "past due" and paid features stay available. Update the payment method in the portal to resolve. The most common failures are expired cards and address-verification mismatches.',
      },
      {
        id: 'referrals',
        q: 'How does the referral program work?',
        a: 'If enabled for your account, the Account page shows a Referrals panel with your code, link, and standings. Anyone who signs up using your code and converts to a paid plan earns you a credit on your next bill. Credits stack across referrals and apply automatically.',
      },
    ],
  },
  {
    id: 'platform-usage',
    title: 'Using the Platform',
    blurb: 'Practical questions on the daily workflow.',
    faqs: [
      {
        id: 'dashboard-workflow',
        q: 'What is the right workflow for using ZeroGEX during a trading day?',
        a: 'Open the Dashboard first — orient on the regime, the flip, the walls. Open the Live Bulletin in a second tab to catch trigger events as they happen. Drill into the signal or metric page only when a trigger or confluence warrants it. The dashboard is for orientation, not analysis.',
      },
      {
        id: 'multiple-symbols',
        q: 'Can I view multiple symbols at once?',
        a: 'Each browser tab can show one symbol. To view SPY, SPX, and QQQ side-by-side, open three tabs. The symbol picker is in the header.',
      },
      {
        id: 'mobile-support',
        q: 'Does ZeroGEX work on mobile?',
        a: 'Yes — every page is responsive. But the platform is built for desktop. The chart density assumes a wide screen. On mobile, the dashboard works for monitoring; complex multi-chart pages are denser than is ideal.',
      },
      {
        id: 'browser-compat',
        q: 'Which browsers are supported?',
        a: 'Evergreen Chrome, Edge, Firefox, and Safari. Older versions will technically work but will not get the performance optimizations. Aggressive ad blockers and script blockers sometimes break the streaming connection — allowlist zerogex.io if needed.',
      },
      {
        id: 'page-stale',
        q: 'A page looks stale or frozen. What do I do?',
        a: 'Check the connection chip in the header. If it stays red across reloads, hard reload (Cmd+Shift+R / Ctrl+Shift+R). If still stuck, try an incognito window. If still stuck, email support with the page URL, your browser, and the timestamp.',
      },
      {
        id: 'options-calculator',
        q: 'How does the Strategy Builder work?',
        a: 'The Strategy Builder lets you construct any single- or multi-leg options strategy, prices it live with Black-Scholes against the active IV surface, and shows you the greeks plus a P&L scenario surface. It is a research tool, not a broker — you take the structure and put it on yourself.',
      },
    ],
  },
  {
    id: 'account',
    title: 'Account &amp; Sign-in',
    blurb: 'Authentication, passwords, and identity providers.',
    faqs: [
      {
        id: 'forgot-password',
        q: 'I forgot my password.',
        a: 'Use the Forgot Password page. A reset link is emailed; click it and set a new password. If the email does not arrive, check spam. If you signed up with Google or Apple, you do not have a password — sign in with the provider instead.',
      },
      {
        id: 'change-email',
        q: 'Can I change the email on my account?',
        a: 'The email is the account ID and cannot be changed in-app. To change it, email support@zerogex.io with verification of both the old and new addresses.',
      },
      {
        id: 'google-apple',
        q: 'Can I sign in with Google or Apple?',
        a: 'Yes. Both Google and Apple sign-in are supported. You can link multiple providers to the same account from the Account page. If you want a password as a fallback, set one from the Account page too.',
      },
      {
        id: 'two-factor',
        q: 'Does ZeroGEX support two-factor authentication?',
        a: 'For Google and Apple sign-ins, you use the provider\'s 2FA. For password sign-in, 2FA on the ZeroGEX account itself is not currently supported — using Google or Apple is the recommended path for elevated security.',
      },
      {
        id: 'email-verification',
        q: 'I never got the email-verification message.',
        a: 'Check spam first. Click "Resend verification" on the in-app banner. If multiple resends do not arrive, the address may be misspelled or your mail server is rejecting our domain — email support@zerogex.io from the address in question.',
      },
      {
        id: 'delete-account',
        q: 'How do I delete my account?',
        a: 'Email support@zerogex.io. Account deletion cancels any active subscription and removes account data per the Privacy policy. We confirm by email before processing.',
      },
    ],
  },
  {
    id: 'api',
    title: 'API &amp; Developer',
    blurb: 'For when you want the data programmatically.',
    faqs: [
      {
        id: 'api-public',
        q: 'Is the API publicly accessible?',
        a: 'The API documentation is at api.zerogex.io/docs and requires a Pro account. API access — including key generation and usage — is a Pro-tier feature. Public and Basic users do not have programmatic access.',
      },
      {
        id: 'api-docs-format',
        q: 'What format are the API docs in?',
        a: 'OpenAPI 3.0. Both Swagger UI (interactive) and ReDoc (read-only) views are available. Responses are JSON.',
      },
      {
        id: 'api-rate-limits',
        q: 'What are the API rate limits?',
        a: 'Pro accounts get generous per-minute and per-day caps, sufficient for production dashboards and bots that respect normal request hygiene. Over-limit responses return 429 with a Retry-After header.',
      },
      {
        id: 'api-keys',
        q: 'How do I generate an API key?',
        a: 'Open the Account page (Pro users), open the API panel, and generate a key. Copy it immediately — it will not be shown again. Use it as Authorization: Bearer <key>. Rotate keys at any time.',
      },
      {
        id: 'api-streaming',
        q: 'Is there a streaming endpoint or websocket?',
        a: 'Not currently exposed publicly. The web platform uses an internal channel. For most use cases, polling at a sane cadence (every few seconds for live metrics) is sufficient.',
      },
    ],
  },
  {
    id: 'methodology',
    title: 'Methodology',
    blurb: 'How the numbers are actually computed.',
    faqs: [
      {
        id: 'what-is-gex',
        q: 'What is Gamma Exposure (GEX) and why does it matter?',
        a: 'GEX is the aggregate sensitivity of options dealers\' delta hedges to price moves in the underlying. When dealers are long gamma (positive net GEX at spot), they sell rallies and buy dips — a dampening effect on volatility. When they\'re short gamma, they chase price — an amplifying effect. Knowing the GEX regime tells you whether the market is likely to mean-revert or trend.',
      },
      {
        id: 'gamma-flip',
        q: 'How is the Gamma Flip level calculated?',
        a: 'The flip is the level at which the dealer gamma curve crosses zero — calculated from a spot-shift dealer gamma profile, not a cumulative-net-GEX approximation. Above the flip, dealer hedging is stabilizing; below it, amplifying. See the Gamma Flip Calculation guide for the full methodology.',
      },
      {
        id: 'walls-explained',
        q: 'What are the call wall and put wall?',
        a: 'The strikes with the largest call gamma and put gamma respectively. They tend to act as intraday resistance and support, especially in positive gamma. The walls migrate intraday as flow comes in — watching the migration is informative on its own.',
      },
      {
        id: 'max-pain-reliability',
        q: 'What is Max Pain, and how reliable is it?',
        a: 'Max pain is the strike that minimizes total option-buyer payout at expiration. It is most reliable in the final 24–48 hours before a meaningful expiry, especially for 0DTE on SPX. The honest read is that the "gamma magnet" — the wall structure — usually drives the pin, not the buyer-payout argument by itself. See the Max Pain article for the deep dive.',
      },
      {
        id: 'flow-explained',
        q: 'What is "premium-weighted" flow?',
        a: 'Premium-weighted flow multiplies contract volume by premium paid. It is the conviction read — a trader paying $500/contract is making a real bet; a trader scalping $0.05 lotto tickets is not. Raw volume treats them the same; premium-weighted flow does not.',
      },
      {
        id: 'pricing-model',
        q: 'What pricing model does the Strategy Builder use?',
        a: 'Black-Scholes with the live implied volatility surface. For SPX (European exercise) no adjustment is applied. For SPY and QQQ (American exercise) we add an early-exercise premium on deep-ITM legs near expiry.',
      },
    ],
  },
  {
    id: 'support',
    title: 'Support &amp; Contact',
    blurb: 'How to reach us when you need a human.',
    faqs: [
      {
        id: 'how-to-contact',
        q: 'How do I get help?',
        a: 'Email support@zerogex.io. We answer fast — usually the same trading day. Include the page URL you were on, a screenshot if relevant, your browser and OS, and (for billing) your account email.',
      },
      {
        id: 'feature-requests',
        q: 'Do you take feature requests?',
        a: 'Yes. Email support@zerogex.io with the request and how you would use it. We prioritize against the existing roadmap.',
      },
      {
        id: 'bug-reports',
        q: 'I think I found a bug.',
        a: 'Email support@zerogex.io with the page, the steps to reproduce, the expected vs actual behavior, browser, OS, and an approximate timestamp. The more specific the report, the faster we can chase it.',
      },
      {
        id: 'phishing',
        q: 'I got a suspicious email claiming to be from ZeroGEX.',
        a: 'We send from zerogex.io and noreply@zerogex.io (and occasionally support@zerogex.io). We will never ask for your password or session token by email. If something looks off, forward it to support@zerogex.io and we will confirm or flag.',
      },
    ],
  },
];

function FAQItem({ faq, anchorId }: { faq: FAQ; anchorId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      id={anchorId}
      className="rounded-xl border border-[var(--color-border)] transition hover:border-[var(--color-warning-soft)]"
    >
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left"
        type="button"
      >
        <span className="text-[15px] font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: faq.q }} />
        {open ? (
          <ChevronUp size={18} className="flex-shrink-0 text-[var(--color-warning)]" />
        ) : (
          <ChevronDown size={18} className="flex-shrink-0 text-[var(--color-text-secondary)]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <p className="text-sm leading-7 text-[var(--color-text-secondary)]" dangerouslySetInnerHTML={{ __html: faq.a }} />
        </div>
      )}
    </div>
  );
}

export default function FAQsClient() {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_DATA;
    return FAQ_DATA.map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter((f) => f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q)),
    })).filter((cat) => cat.faqs.length > 0);
  }, [query]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/help" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        <ArrowLeft size={14} />
        Back to Help Center
      </Link>

      <div className="zg-feature-shell mb-8 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <HelpCircle size={14} />
          FAQs
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">Frequently Asked Questions</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          Plain-English answers to the questions traders ask most often. Use the search box to jump
          straight to a question, or browse by category.
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-4 py-2.5">
          <Search size={16} className="text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search FAQs..."
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="zg-feature-shell p-8 text-center">
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">No FAQs match your search.</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            Try a different query, or{' '}
            <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
              email support
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {filtered.map((cat) => (
            <section key={cat.id} id={cat.id}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: cat.title }} />
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{cat.blurb}</p>
              </div>
              <div className="space-y-3">
                {cat.faqs.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} anchorId={faq.id} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="zg-feature-shell mt-10 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Didn&apos;t find your answer?</h2>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
          Real questions don&apos;t always fit a category. Email{' '}
          <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
            support@zerogex.io
          </a>{' '}
          — we usually answer the same trading day.
        </p>
      </div>
    </div>
  );
}
