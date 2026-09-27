import Link from 'next/link';
import { ArrowLeft, ArrowRight, PlayCircle, Clock } from 'lucide-react';
import { liveQuickStartTracks, type Walkthrough } from '@/core/quickStarts';

export const metadata = {
  title: 'ZeroGEX Quick Starts: Short Video Walkthroughs',
  description:
    'Short, focused video walkthroughs for the ZeroGEX platform, now being recorded - reading the dashboard, using signals, building a strategy, and more.',
  alternates: { canonical: '/help/quickstarts' },
};

// The written guides that cover the same ground the Onboarding videos will, in
// the order a new member needs them. Shown in place of the video library until
// the first walkthrough is published.
const WRITTEN_GUIDES = [
  { href: '/help/platform/getting-started', label: 'Getting Started', note: 'Your first session, step by step.' },
  { href: '/help/platform/dashboard', label: 'Reading the Dashboard', note: 'What each part of the main page tells you.' },
  { href: '/help/platform', label: 'Platform Guide', note: 'Every page, covered in writing.' },
  { href: '/help/faqs', label: 'FAQs', note: 'The questions new members ask most.' },
];

function levelStyle(level: Walkthrough['level']) {
  switch (level) {
    case 'New trader':
      return 'border-[var(--color-bull)] text-[var(--color-bull)] bg-[var(--color-bull-soft)]';
    case 'Returning':
      return 'border-[var(--color-warning)] text-[var(--color-warning)] bg-[var(--color-warning-soft)]';
    case 'Advanced':
      return 'border-[var(--color-info)] text-[var(--color-info)] bg-[var(--color-info-soft)]';
  }
}

// Only published walkthroughs reach this card (liveQuickStartTracks requires
// status 'live' and an href), so there is no placeholder state to render.
function WalkthroughCard({ wt }: { wt: Walkthrough }) {
  return (
    <div
      id={wt.id}
      className="zg-feature-shell group flex flex-col overflow-hidden transition hover:border-[var(--color-warning-soft)]"
    >
      <div className="relative flex aspect-video items-center justify-center border-b border-[var(--color-border)] bg-gradient-to-br from-[var(--color-warning-soft)] via-[var(--bg-card)] to-[var(--color-info-soft)]">
        <span className="inline-flex h-16 w-16 items-center justify-center rounded-full border border-[var(--color-warning-soft)] bg-[var(--bg-card)] text-[var(--color-warning)] shadow-sm">
          <PlayCircle size={32} />
        </span>
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-[var(--color-border)] bg-[var(--bg-card)] px-2.5 py-1 text-[10px] font-semibold text-[var(--color-text-secondary)]">
          <Clock size={10} />
          {wt.duration}
        </div>
      </div>
      <div className="flex flex-1 flex-col p-5">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${levelStyle(wt.level)}`}>
            {wt.level}
          </span>
          <span className="rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
            {wt.tag}
          </span>
        </div>
        <h3 className="mb-2 text-base font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: wt.title }} />
        <p className="mb-4 flex-1 text-sm leading-6 text-[var(--color-text-secondary)]" dangerouslySetInnerHTML={{ __html: wt.blurb }} />
        {wt.href && (
          <Link
            href={wt.href}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]"
          >
            Watch
            <ArrowRight size={14} />
          </Link>
        )}
      </div>
    </div>
  );
}

export default function QuickStartsPage() {
  const tracks = liveQuickStartTracks();
  const liveCount = tracks.reduce((sum, t) => sum + t.walkthroughs.length, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/help" className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]">
        <ArrowLeft size={14} />
        Back to Help Center
      </Link>

      <div className="zg-feature-shell mb-10 p-8">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--color-warning)]">
          <PlayCircle size={14} />
          Quick Starts
        </div>
        <h1 className="mb-3 text-3xl font-bold text-[var(--color-text-primary)]">Quick Start Walkthroughs</h1>
        {liveCount > 0 ? (
          <>
            <p className="mb-6 max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
              Short, focused video walkthroughs&nbsp;- most run under 3 minutes&nbsp;- that show you exactly how
              to read a chart, run a screen, or configure a feature. New ones appear here as they&apos;re published.
            </p>
            <div className="flex flex-wrap gap-3 text-xs">
              <div className="rounded-full border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-1.5 font-semibold text-[var(--color-text-secondary)]">
                {liveCount} {liveCount === 1 ? 'walkthrough' : 'walkthroughs'}
              </div>
              <div className="rounded-full border border-[var(--color-border)] bg-[var(--bg-card)] px-3 py-1.5 font-semibold text-[var(--color-text-secondary)]">
                {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
              </div>
            </div>
          </>
        ) : (
          <p className="max-w-2xl text-sm leading-7 text-[var(--color-text-secondary)]">
            Short video walkthroughs of the platform are being recorded and will appear here as they&apos;re
            published. Until then, these written guides cover the same ground.
          </p>
        )}
      </div>

      {liveCount > 0 ? (
        <div className="space-y-10">
          {tracks.map((track) => (
            <section key={track.id} id={track.id}>
              <div className="mb-4">
                <h2 className="text-xl font-semibold text-[var(--color-text-primary)]" dangerouslySetInnerHTML={{ __html: track.title }} />
                <p className="mt-1 text-sm text-[var(--color-text-secondary)]">{track.blurb}</p>
              </div>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {track.walkthroughs.map((wt) => (
                  <WalkthroughCard key={wt.id} wt={wt} />
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {WRITTEN_GUIDES.map((guide) => (
            <Link
              key={guide.href}
              href={guide.href}
              className="zg-feature-shell group flex items-start justify-between gap-3 p-5 transition hover:border-[var(--color-warning-soft)]"
            >
              <span>
                <span className="block text-base font-semibold text-[var(--color-text-primary)]">{guide.label}</span>
                <span className="mt-1 block text-sm text-[var(--color-text-secondary)]">{guide.note}</span>
              </span>
              <ArrowRight size={16} className="mt-1 shrink-0 text-[var(--color-warning)]" />
            </Link>
          ))}
        </div>
      )}

      <div className="zg-feature-shell mt-12 p-6">
        <h2 className="mb-2 text-lg font-semibold text-[var(--color-text-primary)]">Want a walkthrough we haven&apos;t recorded?</h2>
        <p className="mb-4 text-sm leading-7 text-[var(--color-text-secondary)]">
          Email{' '}
          <a className="font-semibold text-[var(--color-warning)] hover:text-[var(--heat-low)]" href="mailto:support@zerogex.io">
            support@zerogex.io
          </a>{' '}
          and tell us what would be useful. Requested topics jump the queue.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/help/platform"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-warning-soft)] bg-[var(--color-warning-soft)] px-4 py-2 text-sm font-semibold text-[var(--heat-low)]"
          >
            Platform Guide
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/help/faqs"
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
          >
            FAQs
            <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </div>
  );
}
