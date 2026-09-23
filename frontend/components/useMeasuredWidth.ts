'use client';

import { useLayoutEffect, useState } from 'react';

/**
 * The CSS width of an element, measured on the client and kept current with a
 * ResizeObserver — for hand-rolled SVG charts that draw a phone canvas whose
 * viewBox width equals the card's width (1 unit = 1 CSS px, so a 10-unit label
 * is real 10px text), as components/GammaTerminalChart.tsx does.
 *
 * Returns a callback ref (attach it to the element to measure) and the width,
 * which is null on the server and the first client render — callers draw
 * their desktop board until a width arrives. A callback ref rather than a
 * RefObject so an element that mounts late (a chart that first renders an
 * empty state) is still picked up.
 */
export function useMeasuredWidth<T extends HTMLElement = HTMLDivElement>(): [
  (el: T | null) => void,
  number | null,
] {
  const [el, setEl] = useState<T | null>(null);
  const [width, setWidth] = useState<number | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    const measure = () => {
      const next = el.clientWidth;
      setWidth((cur) => (cur != null && Math.abs(cur - next) < 1 ? cur : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return [setEl, width];
}
