'use client';

/**
 * App-segment error boundary. Catches render errors thrown by any page below
 * the root layout that lacks a closer boundary. Unlike global-error.tsx, the
 * root layout (and its providers, fonts and palette CSS variables) is still
 * mounted here, so the site chrome stays intact and this only replaces the
 * page content — a much softer failure than a full-app white-screen.
 *
 * Themed with the app's CSS custom properties so it matches the active palette
 * in both light and dark.
 */

import { useEffect } from 'react';
import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      console.error('ZeroGEX page error boundary caught:', error);
    } catch {
      /* console unavailable */
    }
    void import('posthog-js')
      .then(({ default: posthog }) => {
        try {
          posthog.captureException?.(error);
        } catch {
          /* swallow */
        }
      })
      .catch(() => {
        /* analytics bundle unavailable — swallow */
      });
  }, [error]);

  return (
    <div
      style={{
        minHeight: '60vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ width: '100%', maxWidth: '30rem', textAlign: 'center' }}>
        <h1
          style={{
            fontSize: '1.4rem',
            fontWeight: 600,
            margin: '0 0 0.75rem',
            color: 'var(--color-text-primary, #1E293B)',
          }}
        >
          This page ran into a problem
        </h1>
        <p
          style={{
            fontSize: '0.95rem',
            lineHeight: 1.6,
            margin: '0 0 1.75rem',
            color: 'var(--color-text-secondary, #64748B)',
          }}
        >
          Something went wrong while loading this view. The rest of the site is
          still available — try again, or head back to the dashboard.
        </p>
        <div
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            style={{
              appearance: 'none',
              border: 'none',
              cursor: 'pointer',
              borderRadius: '0.5rem',
              padding: '0.7rem 1.4rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              color: '#FFFFFF',
              backgroundColor: 'var(--color-accent, #E1554F)',
            }}
          >
            Try again
          </button>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              borderRadius: '0.5rem',
              padding: '0.7rem 1.4rem',
              fontSize: '0.95rem',
              fontWeight: 600,
              textDecoration: 'none',
              color: 'var(--color-text-primary, #1E293B)',
              border: '1px solid var(--color-border, rgba(100, 116, 139, 0.35))',
            }}
          >
            Go to homepage
          </Link>
        </div>
        {error?.digest ? (
          <p
            style={{
              marginTop: '1.75rem',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.72rem',
              color: 'var(--color-text-muted, rgba(100, 116, 139, 0.7))',
            }}
          >
            Reference: {error.digest}
          </p>
        ) : null}
      </div>
    </div>
  );
}
