'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { usePathname } from 'next/navigation';
import { Camera, Check, Copy, Download, X } from 'lucide-react';

import { useTimeframe } from '@/core/TimeframeContext';
import { navItemLabel } from '@/core/navigation';
import { etTodayDateKey } from '@/core/utils';
import {
  capturePageSnapshot,
  copyBlobToClipboard,
  downloadBlob,
  resolveSnapshotTitle,
  snapshotFileName,
} from '@/core/pageSnapshot';

/**
 * The camera in the app header — one PNG of whatever page you are on.
 *
 * It sits in the header rather than on each page for the reason every other
 * piece of app chrome does: a control that exists on 39 pages and is wired up
 * on 10 of them is worse than one that exists everywhere, and the capture
 * target is `<main>`, which the layout guarantees on every page that has app
 * chrome. Nothing has to be added to a page for its snapshot to work, and
 * nothing can be forgotten when a page is added.
 *
 * The result is shown before it is saved. A page capture has more ways to come
 * out wrong than a chart export does — a lazy image that had not loaded, a
 * panel still showing its spinner — and a preview costs one click against a
 * reader who otherwise finds out by opening the file.
 */

// Routes where the header's global underlying is not what the page is about.
// Printing "SPY · Account" on a billing page is not a small blemish: it reads
// as a data point, and it isn't one.
const SYMBOL_AGNOSTIC_ROUTES = [
  '/account',
  '/admin',
  '/articles',
  '/education',
  '/guides',
  '/help',
  '/integrations',
  '/mcp',
  '/methodology',
  '/pricing',
  '/search',
];

function symbolApplies(pathname: string | null): boolean {
  if (!pathname) return false;
  return !SYMBOL_AGNOSTIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
}

type Phase = 'idle' | 'working' | 'ready' | 'error';

export default function PageSnapshotButton({
  compact = false,
  label: tileLabel,
}: {
  compact?: boolean;
  /** Renders the trigger as a labelled tile (the mobile menu sheet). */
  label?: string;
}) {
  const pathname = usePathname();
  const { symbol } = useTimeframe();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<{ url: string; blob: Blob; fileName: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const downloadRef = useRef<HTMLButtonElement | null>(null);

  // An object URL outlives the component unless it is revoked, and a reader who
  // snapshots a dozen pages in a session would pin a dozen PNGs in memory.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview.url);
    };
  }, [preview]);

  const close = useCallback(() => {
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    setCopied(false);
    setPhase('idle');
  }, []);

  useEffect(() => {
    if (!preview) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    downloadRef.current?.focus();
    return () => window.removeEventListener('keydown', onKey);
  }, [preview, close]);

  const capture = async () => {
    if (phase === 'working') return;
    setPhase('working');
    try {
      // `main h1, main h2` rather than `main h1`: the shared PageHeader renders
      // its title as an <h2> (the <h1> is the page's SEO heading, which a tool
      // page often does not have at all).
      const heading = document.querySelector('main h1, main h2');
      const title = resolveSnapshotTitle({
        headingText: heading?.textContent,
        navLabel: navItemLabel(pathname),
        documentTitle: document.title,
      });
      const applies = symbolApplies(pathname);
      const blob = await capturePageSnapshot({
        title,
        symbol: applies ? symbol : null,
        permalink: `zerogex.io${pathname === '/' ? '' : (pathname ?? '')}`,
      });
      setPreview({
        url: URL.createObjectURL(blob),
        blob,
        fileName: snapshotFileName(pathname, applies ? symbol : null, etTodayDateKey()),
      });
      setPhase('ready');
    } catch (err) {
      console.error('Failed to capture page snapshot', err);
      setPhase('error');
      setTimeout(() => setPhase('idle'), 2500);
    }
  };

  const label =
    phase === 'working'
      ? 'Capturing this page…'
      : phase === 'error'
        ? 'Snapshot failed\u00a0- try again'
        : 'Snapshot this page as an image';

  return (
    <>
      <button
        type="button"
        onClick={capture}
        className={tileLabel ? 'zg-msheet-tool' : `zg-icon-btn${compact ? ' zg-icon-btn--sm' : ''}`}
        title={label}
        aria-label={label}
        disabled={phase === 'working'}
        style={{
          cursor: phase === 'working' ? 'progress' : 'pointer',
          opacity: phase === 'working' ? 0.55 : 1,
          borderColor: phase === 'error' ? 'var(--color-bear)' : undefined,
          color: phase === 'error' ? 'var(--color-bear)' : undefined,
        }}
      >
        <Camera size={tileLabel ? 20 : compact ? 16 : 18} />
        {tileLabel && <span>{tileLabel}</span>}
      </button>

      {/* Portalled to <body>. The button lives in the app header, which paints
          itself with backdrop-filter — and a filtered element is a containing
          block for its fixed-position descendants, so an overlay rendered in
          place is clipped to the header bar rather than covering the page. */}
      {preview && createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Page snapshot"
          onClick={close}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 24,
            background: 'rgba(0, 12, 20, 0.72)',
            backdropFilter: 'blur(2px)',
          }}
        >
          <div
            onClick={(event) => event.stopPropagation()}
            style={{
              display: 'flex',
              flexDirection: 'column',
              maxWidth: 'min(1040px, 100%)',
              maxHeight: '100%',
              borderRadius: 14,
              overflow: 'hidden',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                padding: '12px 16px',
                borderBottom: '1px solid var(--border-default)',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-primary)' }}>
                  Page snapshot
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 11,
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {preview.fileName}
                </div>
              </div>
              <button
                type="button"
                onClick={close}
                className="zg-icon-btn zg-icon-btn--sm"
                aria-label="Close snapshot preview"
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ overflow: 'auto', padding: 16, background: 'var(--bg-subtle)' }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- a blob: URL
                  of a canvas we just produced; next/image would only proxy it. */}
              <img
                src={preview.url}
                alt="Snapshot of the current page"
                style={{ display: 'block', width: '100%', height: 'auto', borderRadius: 6 }}
              />
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 8,
                padding: '12px 16px',
                borderTop: '1px solid var(--border-default)',
              }}
            >
              <button
                type="button"
                onClick={async () => {
                  const ok = await copyBlobToClipboard(preview.blob);
                  setCopied(ok);
                  if (ok) setTimeout(() => setCopied(false), 2000);
                }}
                className="zg-btn zg-btn--ghost"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied' : 'Copy image'}
              </button>
              <button
                ref={downloadRef}
                type="button"
                onClick={() => {
                  downloadBlob(preview.blob, preview.fileName);
                  close();
                }}
                className="zg-btn zg-btn--primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Download size={14} />
                Download PNG
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
