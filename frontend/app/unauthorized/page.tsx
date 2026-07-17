import Link from 'next/link';
import { ArrowRight, BarChart2, BookOpen, Sparkles } from 'lucide-react';

type UnauthorizedPageProps = {
  searchParams: Promise<{
    required?: string;
    current?: string;
    path?: string;
  }>;
};

export default async function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const params = await searchParams;

  const current = params.current ?? 'public';
  const required = params.required ?? 'basic';
  // Logged-in Public users hitting a paid page are the conversion-funnel case
  // we land here for most often: the obvious next step is /pricing, not the
  // login form they're already authenticated to.
  const needsSubscription = current === 'public' && (required === 'basic' || required === 'pro');
  // Basic subscriber hitting a Pro-only page: route them to /pricing for an
  // upgrade rather than the generic "access denied" with no next step.
  const needsUpgrade = current === 'basic' && required === 'pro';
  const tierLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

  // Logged-in, no subscription: the post-registration "account exists but no
  // trial started" case — the biggest funnel leak. Show a dedicated trial-start
  // unlock screen rather than the generic access-denied layout, and never bounce
  // to the free levels page.
  if (needsSubscription) {
    return (
      <main className="min-h-screen px-6 py-12 flex items-start justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <div className="w-full max-w-xl">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">
              <Sparkles size={13} /> Start your trial
            </div>
            <h1 className="text-3xl font-bold">Start your ZeroGEX trial</h1>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              Your account is ready. Choose a plan to unlock the live dashboard.
            </p>
            <p className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">
              7-day free trial. No charge until day 7. Cancel anytime.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href="/pricing?trial=1&plan=basic"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 font-semibold text-[var(--text-inverse)]"
              >
                Start Basic Trial <ArrowRight size={16} />
              </Link>
              <Link
                href="/pricing?trial=1&plan=pro"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-brand-primary)] px-5 py-3 font-semibold text-[var(--color-brand-primary)]"
              >
                Start Pro Trial <ArrowRight size={16} />
              </Link>
            </div>
            <p className="mt-5">
              <Link
                href="/spx-gamma-levels"
                className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] hover:underline"
              >
                View Free Delayed Levels
              </Link>
            </p>
          </section>
        </div>
      </main>
    );
  }

  let heading: string;
  let message: string;
  if (needsSubscription) {
    heading = 'Subscribe to unlock';
    message = `This page is included with the ${required === 'pro' ? 'Pro' : 'Basic'} plan. Pick a plan to unlock it and the rest of the paid features.`;
  } else if (needsUpgrade) {
    heading = 'Upgrade to unlock';
    message = `Your current ${tierLabel(current)} plan does not include this page. Upgrade to ${tierLabel(required)} to unlock it.`;
  } else {
    heading = 'Access denied';
    message = 'Your current tier does not grant permission for this page.';
  }

  const showPricingCta = needsSubscription || needsUpgrade;

  return (
    <main className="min-h-screen px-6 py-12 flex items-start justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
      <div className="w-full max-w-3xl space-y-6">
        <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
          <h1 className="text-3xl font-bold">{heading}</h1>
          <p className="mt-4 text-[var(--color-text-secondary)]">{message}</p>

          <dl className="mt-6 space-y-2 text-sm">
            <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <dt className="text-[var(--color-text-secondary)]">Requested path</dt>
              <dd className="font-medium">{params.path ?? 'Unknown'}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <dt className="text-[var(--color-text-secondary)]">Current tier</dt>
              <dd className="font-medium">{current}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[var(--color-border)] pb-2">
              <dt className="text-[var(--color-text-secondary)]">Required tier</dt>
              <dd className="font-medium">{required}</dd>
            </div>
          </dl>

          <div className="mt-8 flex flex-wrap items-center gap-4 text-sm">
            {showPricingCta ? (
              <>
                <Link href="/pricing" className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-[var(--text-inverse)] font-semibold">
                  {needsUpgrade ? 'Upgrade your plan' : 'See pricing'}
                </Link>
                <Link href="/login" className="text-[var(--color-brand-primary)] hover:underline">
                  Sign in as a different user
                </Link>
                <Link href="/" className="text-[var(--color-brand-primary)] hover:underline">
                  Back to Landing
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-[var(--text-inverse)] font-semibold">
                  Sign in as a different user
                </Link>
                <Link href="/" className="text-[var(--color-brand-primary)] hover:underline">
                  Back to Landing
                </Link>
              </>
            )}
          </div>
        </section>

        {/* Conversion-funnel CTAs — surface the free Gamma Levels pages and the education
            stack so visitors who hit this page from a paid-tier deep link have
            an obvious next step that isn't "go away." */}
        <section className="grid gap-4 sm:grid-cols-3">
          <Link
            href="/spx-gamma-levels"
            className="zg-feature-shell group flex h-full flex-col p-5 transition hover:border-[var(--color-warning-soft)]"
          >
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
              <BarChart2 size={18} />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
              Try the free Gamma Levels
            </h2>
            <p className="mb-4 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              Net GEX, the gamma flip, call and put walls, max pain for SPX, SPY, and QQQ — daily, no signup, no card.
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
              Open Gamma Levels <ArrowRight size={14} />
            </span>
          </Link>

          <Link
            href="/education/gamma-exposure-explained"
            className="zg-feature-shell group flex h-full flex-col p-5 transition hover:border-[var(--color-warning-soft)]"
          >
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
              <BookOpen size={18} />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
              Start with the GEX guide
            </h2>
            <p className="mb-4 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              The pillar piece — what gamma exposure is, the flip, the walls, and how to read the regime intraday.
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
              Read the pillar <ArrowRight size={14} />
            </span>
          </Link>

          <Link
            href="/real-time-gex-0dte"
            className="zg-feature-shell group flex h-full flex-col p-5 transition hover:border-[var(--color-warning-soft)]"
          >
            <div className="mb-3 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] text-[var(--color-warning)]">
              <Sparkles size={18} />
            </div>
            <h2 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]">
              See what Pro includes
            </h2>
            <p className="mb-4 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]">
              Real-time dealer book, live regime reads, and the Advanced Signal stack built for 0DTE traders.
            </p>
            <span className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] transition group-hover:text-[var(--heat-low)]">
              Tour the product <ArrowRight size={14} />
            </span>
          </Link>
        </section>
      </div>
    </main>
  );
}
