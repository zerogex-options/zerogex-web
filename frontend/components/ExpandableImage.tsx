'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Image from 'next/image';
import { Expand, ExternalLink, X } from 'lucide-react';

import { lockPageScroll } from '@/core/scrollLock';
import { BLOG_IMAGE_DIMENSIONS } from '@/core/blogImageManifest';

// The reading column is max-w-4xl (896px) with 20 to 24px of padding a side
// (see any education page shell), so the thumbnail renders at about viewport
// minus 40px on a phone and 856px on anything wider. Telling next/image that
// is what lets it serve a copy sized for the column instead of the full
// screenshot.
const THUMBNAIL_SIZES = '(max-width: 896px) calc(100vw - 40px), 856px';

/**
 * An article image that opens larger on click.
 *
 * Article images are mostly product screenshots: a whole page shrunk to the
 * width of the reading column, where the numbers the text refers to are too
 * small to read. Clicking opens the same file as wide as the screen allows (up
 * to its own size) in an overlay that scrolls, because the screenshots are
 * tall: fitting one to the viewport's HEIGHT would show it smaller than the
 * column it came from. Escape, the close button or a click anywhere closes it,
 * and "Open full size" hands the file to the browser's own viewer, which is
 * where a phone can pinch-zoom it.
 *
 * The "Enlarge" badge shows only on hover or keyboard focus. Left on, it sat
 * over the corner of the picture, and a page screenshot keeps its symbol and
 * timestamp exactly there.
 *
 * Portalled to <body> for the reason PageSnapshotButton gives: a fixed overlay
 * rendered inside a filtered or transformed ancestor is clipped to it.
 */
export default function ExpandableImage({ src, alt }: { src: string; alt: string }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const closeRef = useRef<HTMLButtonElement | null>(null);
  // Known for every /blog/*.png (scripts/blog-image-manifest.js reads it off
  // the PNG). With it the thumbnail goes through next/image, which reserves
  // the picture's space before it loads and serves a resized copy. Anything
  // else (an external URL, a file not yet in the manifest) keeps the plain
  // <img>, since next/image refuses to render without a size.
  const dimensions = BLOG_IMAGE_DIMENSIONS[src];

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    if (!open) return;
    const release = lockPageScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    closeRef.current?.focus();
    const trigger = triggerRef.current;
    return () => {
      window.removeEventListener('keydown', onKey);
      release();
      trigger?.focus();
    };
  }, [open, close]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        title="Click to enlarge"
        className="group relative block w-full cursor-zoom-in rounded-2xl p-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[var(--color-warning)]"
        style={{ background: 'none', border: 0 }}
      >
        {dimensions ? (
          // h-auto alongside w-full: without it the height attribute next/image
          // emits would stay in force while the width stretched to the column,
          // and the screenshot would render squashed.
          <Image
            src={src}
            alt={alt}
            width={dimensions.width}
            height={dimensions.height}
            sizes={THUMBNAIL_SIZES}
            className="w-full h-auto rounded-2xl border border-[var(--color-border)]"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={alt}
            loading="lazy"
            className="w-full rounded-2xl border border-[var(--color-border)]"
          />
        )}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
          style={{
            background: 'rgba(0, 12, 20, 0.72)',
            color: '#fff',
            border: '1px solid rgba(255, 255, 255, 0.18)',
          }}
        >
          <Expand size={12} />
          Enlarge
        </span>
        <span className="sr-only">Enlarge image</span>
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-modal="true"
            aria-label={alt ? `Enlarged image: ${alt}` : 'Enlarged image'}
            onClick={close}
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 1000,
              overflowY: 'auto',
              padding: '64px 16px 24px',
              background: 'rgba(0, 12, 20, 0.88)',
              backdropFilter: 'blur(2px)',
              cursor: 'zoom-out',
            }}
          >
            <div
              style={{
                position: 'fixed',
                top: 16,
                right: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: 'var(--bg-card)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-default)',
                }}
              >
                <ExternalLink size={13} />
                Open full size
              </a>
              <button
                ref={closeRef}
                type="button"
                onClick={close}
                className="zg-icon-btn zg-icon-btn--sm"
                aria-label="Close enlarged image"
              >
                <X size={16} />
              </button>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={src}
              alt={alt}
              style={{
                display: 'block',
                margin: '0 auto',
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 12,
                boxShadow: '0 24px 64px rgba(0, 0, 0, 0.45)',
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
