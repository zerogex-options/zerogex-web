"use client";

import { useCallback, useSyncExternalStore } from "react";

// Both hooks read a media query through useSyncExternalStore, with `false` as
// the server snapshot. That is what makes them hydration-safe: React renders
// the hydration pass with the server's value and re-renders straight after with
// the real one. Seeding a useState from matchMedia instead (as this hook used
// to) made a phone's first client render disagree with the server HTML — React
// reported a hydration mismatch on every page that used it, and did not patch
// the mismatched attributes, so a chart could keep its desktop height on a
// phone until something else happened to re-render it.
function useMediaQuery(query: string): boolean {
  const subscribe = useCallback(
    (onChange: () => void) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    [query],
  );
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false,
  );
}

/** Returns true when the viewport width is below the given breakpoint (default 768px). */
export function useIsMobile(breakpoint = 768): boolean {
  return useMediaQuery(`(max-width: ${breakpoint - 1}px)`);
}

/**
 * True when the primary pointer is a finger (phones, tablets) rather than a
 * mouse or trackpad. For layouts that should follow the input, not the width:
 * a tablet in landscape is as wide as a small laptop but still has no hover and
 * no scroll wheel.
 */
export function useCoarsePointer(): boolean {
  return useMediaQuery("(pointer: coarse)");
}
