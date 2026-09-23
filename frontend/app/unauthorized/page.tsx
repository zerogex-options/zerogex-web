import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowRight, BarChart2, BookOpen, RotateCcw, Sparkles } from 'lucide-react';

import { navItemLabel } from '@/core/navigation';
import { requireSession } from '@/core/serverAuth';
import { skuHasFreeTrial } from '@/core/stripe';
import { pricingHrefFor, resolveWall } from '@/core/returningMember';
import { getChurnContext } from '@/core/returningMemberServer';
import { selectHighlightsSince } from '@/core/winbackHighlights';
import { loadWinbackHighlights } from '@/core/winbackHighlightsServer';

export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

// Reads the session cookie to tell a returning member from a newcomer, so it can
// never be statically rendered or cached across visitors.
export const dynamic = 'force-dynamic';

type UnauthorizedPageProps = {
  searchParams: Promise<{
    required?: string;
    current?: string;
    path?: string;
  }>;
};

export default async function UnauthorizedPage({ searchParams }: UnauthorizedPageProps) {
  const params = await searchParams;

  // The session — not `?current=` — decides what this visitor is shown. The
  // querystring is set by proxy.ts but is trivially editable by the visitor, and
  // the whole point of this page is to make an honest promise about what
  // checkout will do next. That answer has to come from the same place checkout
  // reads it. `?required=` is still taken at face value: it only picks which
  // plan the copy names, and the middleware is what actually enforces access.
  const actor = await requireSession();
  const required = params.required ?? 'basic';
  const wall = resolveWall({
    sessionTier: actor?.user.tier ?? null,
    requiredTier: required,
    hasPriorPaid: actor ? actor.user.hasPriorPaid : null,
    foundingMember: actor?.user.foundingMember ?? false,
  });

  const current = actor?.user.tier ?? params.current ?? 'public';
  const tierLabel = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
  const requiredLabel = required === 'pro' ? 'Pro' : 'Basic';
  // Name the page they were actually reaching for, straight from the menu, so
  // renaming a feature renames this sentence too. Undefined for anything not in
  // the menu — we then say nothing rather than printing a raw path at them.
  const wantedLabel = navItemLabel(params.path);

  // ---------------------------------------------------------------------------
  // Returning member: they have paid before, so checkout will NOT give them a
  // trial. This screen exists because the newcomer screen below promised them
  // one anyway — "7-day free trial, no charge until day 7" — and then handed
  // them to a checkout that charges immediately.
  // ---------------------------------------------------------------------------
  // `actor` is necessarily non-null here — resolveWall only returns 'returning'
  // for hasPriorPaid === true, which we pass as null without a session — but the
  // compiler can't see through that, and a guard beats a non-null assertion.
  if (wall.audience === 'returning' && actor) {
    const churn = getChurnContext(actor.user.id);
    const all = loadWinbackHighlights();
    // Only what shipped after they left, newest first. freshCount is what keeps
    // the heading honest: a member who left last week is not told a lot has
    // changed, because for them it hasn't.
    const selection = all ? selectHighlightsSince(all, churn.churnedAt, { minItems: 3 }) : null;
    const hasFresh = (selection?.freshCount ?? 0) > 0;

    return (
      <main className="min-h-screen px-6 py-12 flex items-start justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <div className="w-full max-w-xl space-y-6">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">
              <RotateCcw size={13} /> Welcome back
            </div>
            <h1 className="text-3xl font-bold">Your account is still here</h1>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              {wantedLabel
                ? `You were reaching for ${wantedLabel}, which is included with ${requiredLabel}.`
                : `That page is included with ${requiredLabel}.`}{' '}
              Everything you had is exactly where you left it — your layouts, symbols and settings
              are all still on your account.
            </p>

            {wall.showFoundingRestore && (
              <p className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">
                You&rsquo;re a Founding Member. That rate is still yours and applies automatically
                when you resubscribe — founding pricing closed to new members, but never to you.
              </p>
            )}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={pricingHrefFor(wall, required === 'pro' ? 'pro' : 'basic')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 font-semibold text-[var(--text-inverse)]"
              >
                Resubscribe to {requiredLabel} <ArrowRight size={16} />
              </Link>
              <Link
                href={pricingHrefFor(wall)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-brand-primary)] px-5 py-3 font-semibold text-[var(--color-brand-primary)]"
              >
                Compare plans <ArrowRight size={16} />
              </Link>
            </div>

            <p className="mt-5">
              <Link
                href="/spx-gamma-levels"
                className="text-sm font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-brand-primary)] hover:underline"
              >
                Or keep using the free delayed levels
              </Link>
            </p>
          </section>

          {selection && selection.items.length > 0 && (
            <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
              <h2 className="text-lg font-semibold">
                {hasFresh ? 'Shipped since you left' : 'Recently shipped'}
              </h2>
              <ul className="mt-4 space-y-3 text-sm leading-6 text-[var(--color-text-secondary)]">
                {selection.items.map((h) => (
                  <li key={h.title}>
                    <strong className="text-[var(--color-text-primary)]">{h.title}</strong> &mdash;{' '}
                    {h.body}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </main>
    );
  }

  // ---------------------------------------------------------------------------
  // Newcomer: logged in, never paid, hitting a paid page — the post-registration
  // "account exists but no trial started" case, and the biggest funnel leak.
  // The trial line renders only when we POSITIVELY know they're eligible
  // (wall.promiseTrial); an unresolved session gets the same screen with neutral
  // copy rather than a promise we can't stand behind.
  // ---------------------------------------------------------------------------
  if (wall.audience === 'newcomer') {
    // Only Basic monthly trials by default (core/billingPlans.ts); Pro is paid up
    // front under the 7-day money-back guarantee. Read from the same policy
    // checkout enforces, so this screen can never promise a Pro trial checkout
    // would not grant.
    const proTrials = skuHasFreeTrial({ tier: 'pro', cadence: 'monthly' });
    return (
      <main className="min-h-screen px-6 py-12 flex items-start justify-center bg-[var(--color-bg)] text-[var(--color-text-primary)]">
        <div className="w-full max-w-xl">
          <section className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-8 shadow-xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-brand-primary)]/40 bg-[var(--color-brand-primary)]/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-[var(--color-brand-primary)]">
              <Sparkles size={13} /> {wall.promiseTrial ? 'Start your trial' : 'Choose a plan'}
            </div>
            <h1 className="text-3xl font-bold">
              {wall.promiseTrial ? 'Start your ZeroGEX trial' : 'Unlock ZeroGEX'}
            </h1>
            <p className="mt-3 text-[var(--color-text-secondary)]">
              {wantedLabel
                ? `Your account is ready. ${wantedLabel} is included with ${requiredLabel} — choose a plan to unlock it and the live dashboard.`
                : 'Your account is ready. Choose a plan to unlock the live dashboard.'}
            </p>
            {wall.promiseTrial && (
              <p className="mt-4 rounded-lg border border-[var(--color-brand-primary)]/30 bg-[var(--color-brand-primary)]/10 px-4 py-3 text-sm font-semibold text-[var(--color-text-primary)]">
                {proTrials
                  ? '7-day free trial. No charge until day 7. Cancel anytime.'
                  : '7-day free trial on Basic monthly · 7-day money-back guarantee on every other plan.'}
              </p>
            )}
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Link
                href={pricingHrefFor(wall, 'basic')}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-brand-primary)] px-5 py-3 font-semibold text-[var(--text-inverse)]"
              >
                {wall.promiseTrial ? 'Start Basic Trial' : 'Get Basic'} <ArrowRight size={16} />
              </Link>
              <Link
                href={pricingHrefFor(wall, 'pro')}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-brand-primary)] px-5 py-3 font-semibold text-[var(--color-brand-primary)]"
              >
                {wall.promiseTrial && proTrials ? 'Start Pro Trial' : 'Get Pro'} <ArrowRight size={16} />
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

  const needsUpgrade = wall.audience === 'upgrade';
  let heading: string;
  let message: string;
  if (needsUpgrade) {
    heading = 'Upgrade to unlock';
    message = wantedLabel
      ? `${wantedLabel} is not included with your ${tierLabel(current)} plan. Upgrade to ${tierLabel(required)} to unlock it.`
      : `Your current ${tierLabel(current)} plan does not include this page. Upgrade to ${tierLabel(required)} to unlock it.`;
  } else {
    heading = 'Access denied';
    message = 'Your current tier does not grant permission for this page.';
  }

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
            {needsUpgrade ? (
              <>
                <Link href="/pricing" className="rounded-lg bg-[var(--color-brand-primary)] px-4 py-2 text-[var(--text-inverse)] font-semibold">
                  Upgrade your plan
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
              Net GEX, the gamma flip, call and put walls, max pain for SPX, SPY, QQQ, and NDX — 15-min delayed, no signup, no card.
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
