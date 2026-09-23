'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, X } from 'lucide-react';
import { capture } from '@/core/telemetry/posthog-client';
import { TelemetryEvent } from '@/core/telemetry/events';
import { readUtmParams } from '@/core/telemetry/utm';

// Requirement #3 — a sticky bottom CTA bar that keeps the next action obvious
// without being intrusive. It:
//   • stays hidden until the visitor has scrolled past the first viewport (so
//     it never covers the levels the moment they land),
//   • is dismissible, and remembers the dismissal for the browsing session,
//   • sits below the fixed site header (z-index) and above page content.
// Shown on all viewports but sized compactly; it matters most on mobile.
//
// Visibility is driven by an IntersectionObserver watching a positioned
// sentinel rather than scroll offsets: IntersectionObserver measures against
// the viewport regardless of which element actually scrolls, so it held up
// when this site scrolled on <body> and holds up now that the document does.

const DISMISS_KEY = 'zgx.stickyTrialDismissed';

export default function StickyTrialBar({ symbol }: { symbol: string }) {
  // Starts hidden; only ever renders after the sentinel scrolls out of view, so
  // nothing paints during SSR/first paint and there's no flash.
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Read the session dismissal locally (no setState here). If already
    // dismissed we never observe, so the bar stays hidden.
    let alreadyDismissed = false;
    try {
      alreadyDismissed = window.sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      // sessionStorage unavailable (private mode) — treat as not dismissed.
    }
    if (alreadyDismissed) return;

    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    // Show once the sentinel (at ~60% of the first viewport, absolutely
    // positioned in the document) has scrolled above the viewport's top edge.
    const io = new IntersectionObserver((entries) => {
      const entry = entries[0];
      setVisible(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    io.observe(sentinel);
    return () => io.disconnect();
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, '1');
    } catch {
      // In-memory state below still hides it for this view.
    }
  };

  if (dismissed) return null;

  return (
    <>
      {/* Positioned relative to <body> (globals.css: body{position:relative}),
          so it sits at 60% of a viewport height down the document regardless of
          where this component renders in the tree. */}
      <div
        ref={sentinelRef}
        aria-hidden="true"
        style={{ position: 'absolute', top: '60vh', left: 0, width: 1, height: 1, pointerEvents: 'none' }}
      />
      {visible && (
    <div
      role="region"
      aria-label="Get started with ZeroGEX"
      className="zgx-sticky-trial"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px max(16px, env(safe-area-inset-left)) calc(10px + env(safe-area-inset-bottom))',
        background: 'color-mix(in srgb, var(--color-surface) 92%, transparent)',
        borderTop: '1px solid color-mix(in srgb, var(--color-brand-primary) 27%, transparent)',
        boxShadow: '0 -8px 32px rgba(0,0,0,0.28)',
      }}
    >
      {/* The pitch line is dropped on a phone: beside the CTA it had ~120px,
          and wrapped to six lines — a bar a fifth of the screen tall covering
          the levels it was advertising. The button carries the message there. */}
      <p
        className="hidden sm:block"
        style={{
          margin: 0,
          flex: 1,
          minWidth: 0,
          fontSize: 13.5,
          fontWeight: 600,
          lineHeight: 1.35,
          color: 'var(--color-text-primary)',
        }}
      >
        Live SPX/SPY/QQQ/NDX gamma levels{' '}
        <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
          &mdash; delayed here, real-time inside ZeroGEX
        </span>
      </p>

      <Link
        href="/register"
        onClick={() => capture(TelemetryEvent.TrialCtaClick, { location: 'sticky_bar', symbol, ...readUtmParams() })}
        className="zg-btn zg-btn--primary flex-1 sm:flex-none"
        style={{
          flexShrink: 0,
          padding: '10px 16px',
          minHeight: 44,
          fontSize: 13.5,
          whiteSpace: 'nowrap',
        }}
      >
        {/* The pitch line is hidden on a phone, so the phone label carries it. */}
        <span className="sm:hidden">Get real-time levels</span>
        <span className="hidden sm:inline">Get Started</span> <ArrowRight size={15} />
      </Link>

      <button
        type="button"
        onClick={handleDismiss}
        aria-label="Dismiss"
        style={{
          flexShrink: 0,
          width: 40,
          height: 40,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: '1px solid var(--border-default)',
          background: 'transparent',
          color: 'var(--color-text-secondary)',
          cursor: 'pointer',
        }}
      >
        <X size={16} />
      </button>
        </div>
      )}
    </>
  );
}
