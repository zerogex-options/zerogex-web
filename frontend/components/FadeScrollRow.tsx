'use client';

import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

import { useIsMobile } from '@/hooks/useIsMobile';

/**
 * A horizontally scrollable row (filter chips, DTE pills) whose clipped ends
 * fade out, so a phone reader can see there is more to swipe to instead of a
 * chip sliced off at the card edge.
 *
 * The fade follows the scroll position — no left fade at the start, no right
 * fade at the end, none at all while everything fits — so a row that happens
 * to fit looks exactly like a plain flex row. It is applied on phones only
 * unless `desktopFade` is set: several desktop rows already scroll sideways
 * and were designed without one.
 *
 * Layout stays the caller's: pass the row's own classes (flex, gap, overflow)
 * in `className`; this only adds the mask.
 */
export default function FadeScrollRow({
  className,
  style,
  children,
  fade = 22,
  desktopFade = false,
}: {
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  /** Width of each faded end, px. */
  fade?: number;
  desktopFade?: boolean;
}) {
  const isMobile = useIsMobile();
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setEdges((cur) => (cur.left === left && cur.right === right ? cur : { left, right }));
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    update();
    // The row resizes with the card, and its chips arrive after the first
    // paint (they load), so both the box and its contents are watched.
    const ro = new ResizeObserver(update);
    ro.observe(el);
    const mo = new MutationObserver(update);
    mo.observe(el, { childList: true, subtree: true, characterData: true });
    return () => {
      ro.disconnect();
      mo.disconnect();
    };
  }, [update]);

  const active = (isMobile || desktopFade) && (edges.left || edges.right);
  const mask = active
    ? `linear-gradient(to right, ${edges.left ? 'transparent' : '#000'} 0, #000 ${edges.left ? fade : 0}px, #000 calc(100% - ${edges.right ? fade : 0}px), ${edges.right ? 'transparent' : '#000'} 100%)`
    : undefined;

  return (
    <div
      ref={ref}
      onScroll={update}
      className={className}
      style={mask ? { ...style, maskImage: mask, WebkitMaskImage: mask } : style}
    >
      {children}
    </div>
  );
}
