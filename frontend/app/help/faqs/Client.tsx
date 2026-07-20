'use client';

import Link from 'next/link';
import { useState, useMemo } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './Client.i18n';

type FAQ = {
  id: string;
  qKey: string;
  aKey: string;
};

type FAQCategory = {
  id: string;
  titleKey: string;
  blurbKey: string;
  faqs: FAQ[];
};

const FAQ_DATA: FAQCategory[] = [
  {
    id: 'getting-started',
    titleKey: 'gettingStartedTitle',
    blurbKey: 'gettingStartedBlurb',
    faqs: [
      { id: 'what-is-zerogex', qKey: 'whatIsZerogexQ', aKey: 'whatIsZerogexA' },
      { id: 'who-its-for', qKey: 'whoItsForQ', aKey: 'whoItsForA' },
      { id: 'do-i-need-to-sign-up', qKey: 'doINeedToSignUpQ', aKey: 'doINeedToSignUpA' },
      { id: 'free-trial', qKey: 'freeTrialQ', aKey: 'freeTrialA' },
      { id: 'first-page', qKey: 'firstPageQ', aKey: 'firstPageA' },
    ],
  },
  {
    id: 'data-refresh',
    titleKey: 'dataRefreshTitle',
    blurbKey: 'dataRefreshBlurb',
    faqs: [
      { id: 'symbols', qKey: 'symbolsQ', aKey: 'symbolsA' },
      { id: 'single-names', qKey: 'singleNamesQ', aKey: 'singleNamesA' },
      { id: 'futures', qKey: 'futuresQ', aKey: 'futuresA' },
      { id: 'refresh-cadence', qKey: 'refreshCadenceQ', aKey: 'refreshCadenceA' },
      { id: 'pre-market', qKey: 'preMarketQ', aKey: 'preMarketA' },
      { id: 'data-source', qKey: 'dataSourceQ', aKey: 'dataSourceA' },
      { id: 'history-depth', qKey: 'historyDepthQ', aKey: 'historyDepthA' },
    ],
  },
  {
    id: 'signals',
    titleKey: 'signalsCatTitle',
    blurbKey: 'signalsCatBlurb',
    faqs: [
      { id: 'how-many-signals', qKey: 'howManySignalsQ', aKey: 'howManySignalsA' },
      { id: 'advanced-vs-basic', qKey: 'advancedVsBasicQ', aKey: 'advancedVsBasicA' },
      { id: 'score-zero', qKey: 'scoreZeroQ', aKey: 'scoreZeroA' },
      { id: 'composite-score', qKey: 'compositeScoreQ', aKey: 'compositeScoreA' },
      { id: 'signal-alerts', qKey: 'signalAlertsQ', aKey: 'signalAlertsA' },
      { id: 'signal-accuracy', qKey: 'signalAccuracyQ', aKey: 'signalAccuracyA' },
    ],
  },
  {
    id: 'tiers-billing',
    titleKey: 'tiersBillingTitle',
    blurbKey: 'tiersBillingBlurb',
    faqs: [
      { id: 'tiers', qKey: 'tiersQ', aKey: 'tiersA' },
      { id: 'monthly-vs-annual', qKey: 'monthlyVsAnnualQ', aKey: 'monthlyVsAnnualA' },
      { id: 'switch-plan', qKey: 'switchPlanQ', aKey: 'switchPlanA' },
      { id: 'tier-upgrade', qKey: 'tierUpgradeQ', aKey: 'tierUpgradeA' },
      { id: 'cancellation', qKey: 'cancellationQ', aKey: 'cancellationA' },
      { id: 'refunds', qKey: 'refundsQ', aKey: 'refundsA' },
      { id: 'billing-issue', qKey: 'billingIssueQ', aKey: 'billingIssueA' },
      { id: 'referrals', qKey: 'referralsQ', aKey: 'referralsA' },
    ],
  },
  {
    id: 'platform-usage',
    titleKey: 'platformUsageTitle',
    blurbKey: 'platformUsageBlurb',
    faqs: [
      { id: 'dashboard-workflow', qKey: 'dashboardWorkflowQ', aKey: 'dashboardWorkflowA' },
      { id: 'multiple-symbols', qKey: 'multipleSymbolsQ', aKey: 'multipleSymbolsA' },
      { id: 'mobile-support', qKey: 'mobileSupportQ', aKey: 'mobileSupportA' },
      { id: 'browser-compat', qKey: 'browserCompatQ', aKey: 'browserCompatA' },
      { id: 'page-stale', qKey: 'pageStaleQ', aKey: 'pageStaleA' },
      { id: 'options-calculator', qKey: 'optionsCalculatorQ', aKey: 'optionsCalculatorA' },
    ],
  },
  {
    id: 'account',
    titleKey: 'accountTitle',
    blurbKey: 'accountBlurb',
    faqs: [
      { id: 'forgot-password', qKey: 'forgotPasswordQ', aKey: 'forgotPasswordA' },
      { id: 'change-email', qKey: 'changeEmailQ', aKey: 'changeEmailA' },
      { id: 'google-apple', qKey: 'googleAppleQ', aKey: 'googleAppleA' },
      { id: 'two-factor', qKey: 'twoFactorQ', aKey: 'twoFactorA' },
      { id: 'email-verification', qKey: 'emailVerificationQ', aKey: 'emailVerificationA' },
      { id: 'delete-account', qKey: 'deleteAccountQ', aKey: 'deleteAccountA' },
    ],
  },
  {
    id: 'api',
    titleKey: 'apiTitle',
    blurbKey: 'apiBlurb',
    faqs: [
      { id: 'api-public', qKey: 'apiPublicQ', aKey: 'apiPublicA' },
      { id: 'api-docs-format', qKey: 'apiDocsFormatQ', aKey: 'apiDocsFormatA' },
      { id: 'api-rate-limits', qKey: 'apiRateLimitsQ', aKey: 'apiRateLimitsA' },
      { id: 'api-keys', qKey: 'apiKeysQ', aKey: 'apiKeysA' },
      { id: 'api-streaming', qKey: 'apiStreamingQ', aKey: 'apiStreamingA' },
    ],
  },
  {
    id: 'methodology',
    titleKey: 'methodologyTitle',
    blurbKey: 'methodologyBlurb',
    faqs: [
      { id: 'what-is-gex', qKey: 'whatIsGexQ', aKey: 'whatIsGexA' },
      { id: 'gamma-flip', qKey: 'gammaFlipQ', aKey: 'gammaFlipA' },
      { id: 'walls-explained', qKey: 'wallsExplainedQ', aKey: 'wallsExplainedA' },
      { id: 'max-pain-reliability', qKey: 'maxPainReliabilityQ', aKey: 'maxPainReliabilityA' },
      { id: 'flow-explained', qKey: 'flowExplainedQ', aKey: 'flowExplainedA' },
      { id: 'pricing-model', qKey: 'pricingModelQ', aKey: 'pricingModelA' },
    ],
  },
  {
    id: 'support',
    titleKey: 'supportTitle',
    blurbKey: 'supportBlurb',
    faqs: [
      { id: 'how-to-contact', qKey: 'howToContactQ', aKey: 'howToContactA' },
      { id: 'feature-requests', qKey: 'featureRequestsQ', aKey: 'featureRequestsA' },
      { id: 'bug-reports', qKey: 'bugReportsQ', aKey: 'bugReportsA' },
      { id: 'phishing', qKey: 'phishingQ', aKey: 'phishingA' },
    ],
  },
];

function FAQItem({ faq, anchorId, question, answer }: { faq: FAQ; anchorId: string; question: string; answer: string }) {
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
        <span className="text-[15px] font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: question }} />
        {open ? (
          <ChevronUp size={18} className="flex-shrink-0 text-[var(--color-warning)]" />
        ) : (
          <ChevronDown size={18} className="flex-shrink-0 text-[var(--color-text-secondary)]" />
        )}
      </button>
      {open && (
        <div className="border-t border-[var(--color-border)] px-5 py-4">
          <p className="text-sm leading-7 text-[var(--color-text-secondary)]" dangerouslySetInnerHTML={{ __html: answer }} />
        </div>
      )}
    </div>
  );
}

export default function FAQsClient() {
  const t = usePageT(dict);
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return FAQ_DATA;
    return FAQ_DATA.map((cat) => ({
      ...cat,
      faqs: cat.faqs.filter(
        (f) => t(f.qKey).toLowerCase().includes(q) || t(f.aKey).toLowerCase().includes(q)
      ),
    })).filter((cat) => cat.faqs.length > 0);
  }, [query, t]);

  return (
    <div className="mx-auto max-w-4xl px-6 py-12">
      <Link href="/help" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        <ArrowLeft size={14} />
        {t('backToHelp')}
      </Link>

      <div className="zg-feature-shell mb-8 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <HelpCircle size={14} />
          {t('faqsBadge')}
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">{t('heading')}</h1>
        <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('description')}
        </p>

        <div className="mt-6 flex items-center gap-3 rounded-lg border border-[var(--color-border)] bg-[var(--bg-card)] px-4 py-2.5">
          <Search size={16} className="text-[var(--color-text-secondary)]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="flex-1 bg-transparent text-sm text-[var(--color-text-primary)] placeholder-[var(--color-text-secondary)] outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="zg-feature-shell p-8 text-center">
          <p className="mb-3 text-sm text-[var(--color-text-secondary)]">{t('noMatch')}</p>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {t('tryDifferent')}{' '}
            <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
              {t('emailSupport')}
            </a>
            .
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {filtered.map((cat) => (
            <section key={cat.id} id={cat.id}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: t(cat.titleKey) }} />
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{t(cat.blurbKey)}</p>
              </div>
              <div className="space-y-3">
                {cat.faqs.map((faq) => (
                  <FAQItem key={faq.id} faq={faq} anchorId={faq.id} question={t(faq.qKey)} answer={t(faq.aKey)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <div className="zg-feature-shell mt-10 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">{t('didntFind')}</h2>
        <p className="text-sm leading-7 text-[var(--color-text-secondary)]">
          {t('realQuestions')}{' '}
          <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
            support@zerogex.io
          </a>{' '}
          {t('usuallyAnswer')}
        </p>
      </div>
    </div>
  );
}
