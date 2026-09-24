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

/**
 * useMeasuredWidth for a chart that also takes its height from its container
 * (one that fills a flex row, say): the element's CSS width and height, or
 * null on the server and the first client render. The sizes are exact, not
 * rounded, so a chart can floor them and never draw a unit smaller than a px.
 */
export function useMeasuredSize<T extends HTMLElement = HTMLDivElement>(): [
  (el: T | null) => void,
  { w: number; h: number } | null,
] {
  const [el, setEl] = useState<T | null>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    if (!el) return;
    const update = (w: number, h: number) =>
      setSize((cur) => (cur != null && cur.w === w && cur.h === h ? cur : { w, h }));
    update(el.clientWidth, el.clientHeight);
    // The observer's content box is the fractional size the read above rounds.
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width, entry.contentRect.height));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);

  return [setEl, size];
}
