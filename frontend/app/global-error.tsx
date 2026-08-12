'use client';

/**
 * Last-resort error boundary for the whole app.
 *
 * global-error.tsx is the ONLY boundary that catches errors thrown by the root
 * layout itself — including the context providers it mounts (ThemeProvider,
 * LanguageProvider, …). When it fires, Next.js has torn down the root layout,
 * so this component must render its own <html>/<body> and cannot rely on any
 * provider, CSS variable, or font the layout would normally set. Everything
 * here is therefore self-contained inline styling with system fonts.
 *
 * Without this file, an uncaught render error in a root provider falls through
 * to Next's generic "Application error: a client-side exception has occurred"
 * page (with no branding and no recovery affordance). This replaces that with a
 * branded page that offers a retry and a full reload, and best-effort reports
 * the failure so future occurrences are visible in telemetry.
 */

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    try {
      // Surfaced in the browser console for support triage.
      console.error('ZeroGEX global error boundary caught:', error);
    } catch {
      /* console unavailable — nothing else to do */
    }
    // Best-effort telemetry. Dynamically imported and fully guarded so a
    // failure (or absence) of the analytics layer can never break the error
    // page — the whole point of this boundary is that it must not throw.
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
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          boxSizing: 'border-box',
          backgroundColor: '#031A24',
          color: '#FFF1E6',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
        }}
      >
        <main style={{ width: '100%', maxWidth: '30rem', textAlign: 'center' }}>
          <div
            style={{
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
              fontSize: '0.75rem',
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: '#F4645F',
              marginBottom: '1rem',
            }}
          >
            ZeroGEX
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: '0 0 0.75rem' }}>
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: '0.95rem',
              lineHeight: 1.6,
              color: 'rgba(255, 241, 230, 0.72)',
              margin: '0 0 1.75rem',
            }}
          >
            The page hit an unexpected error and couldn’t finish loading. This is
            usually temporary — please try again, or reload the site.
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
                color: '#1A0B09',
                backgroundColor: '#F4645F',
              }}
            >
              Try again
            </button>
            {/* A full document load (not a soft nav) — the correct recovery
                once the root layout has been torn down and the client router
                can't be trusted. */}
            <button
              type="button"
              onClick={() => {
                try {
                  window.location.assign('/');
                } catch {
                  /* window unavailable — nothing else to do */
                }
              }}
              style={{
                appearance: 'none',
                cursor: 'pointer',
                borderRadius: '0.5rem',
                padding: '0.7rem 1.4rem',
                fontSize: '0.95rem',
                fontWeight: 600,
                color: '#FFF1E6',
                backgroundColor: 'transparent',
                border: '1px solid rgba(255, 241, 230, 0.24)',
              }}
            >
              Reload ZeroGEX
            </button>
          </div>
          {error?.digest ? (
            <p
              style={{
                marginTop: '1.75rem',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: '0.72rem',
                color: 'rgba(255, 241, 230, 0.4)',
              }}
            >
              Reference: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
