'use client';

import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Renders a headline value (a metric number, score, or price) that must never
 * wrap mid-digit and must never bleed past its container. The value stays on
 * one line; if it is wider than the available width it is scaled down to fit,
 * down to `minScale`. A no-op (scale 1) whenever the value already fits, so it
 * is safe to wrap around short values too.
 *
 * Why scale rather than reflow: `scrollWidth`/`clientWidth` are unaffected by
 * CSS transforms, so we can measure the natural single-line width regardless of
 * the currently-applied scale and never enter a measure/resize feedback loop.
 * The outer box keeps its natural (unscaled) line-height, so cards in a grid
 * keep a consistent height even when one value shrinks.
 */
export default function AutoFitValue({
  children,
  className,
  style,
  minScale = 0.5,
  origin = 'left center',
  title,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  minScale?: number;
  origin?: string;
  title?: string;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLSpanElement>(null);
  const [scale, setScale] = useState(1);

  // Keep the latest measure closure in a ref so the ResizeObserver (set up once)
  // always calls the current one without being torn down on every render.
  const fitRef = useRef<() => void>(() => {});
  fitRef.current = () => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;
    const avail = outer.clientWidth;
    const natural = inner.scrollWidth; // unaffected by the current transform
    if (!avail || !natural) return;
    const next = natural > avail ? Math.max(minScale, avail / natural) : 1;
    setScale((prev) => (Math.abs(prev - next) > 0.005 ? next : prev));
  };

  // Re-measure after every render (value changes don't resize the container).
  useLayoutEffect(() => {
    fitRef.current();
  });

  // Re-measure when the container itself resizes (responsive grid reflow).
  useLayoutEffect(() => {
    const outer = outerRef.current;
    if (!outer || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => fitRef.current());
    ro.observe(outer);
    return () => ro.disconnect();
  }, []);

  return (
    <div ref={outerRef} className={className} style={{ ...style, overflow: 'hidden' }} title={title}>
      <span
        ref={innerRef}
        style={{
          display: 'inline-block',
          whiteSpace: 'nowrap',
          transformOrigin: origin,
          transform: scale !== 1 ? `scale(${scale})` : undefined,
        }}
      >
        {children}
      </span>
    </div>
  );
}
