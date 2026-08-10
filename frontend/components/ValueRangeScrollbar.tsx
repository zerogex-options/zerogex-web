'use client';

import { useCallback, useEffect, useRef } from 'react';

interface ValueRangeScrollbarProps {
  /** Visible value window in normalized units, inside the full [-1, 1] extent. */
  visibleNorm: [number, number];
  onChange: (next: [number, number]) => void;
  className?: string;
}

// The full normalized value extent both charts' y-window is carved from.
const FULL_LO = -1;
const FULL_HI = 1;
const FULL_SPAN = FULL_HI - FULL_LO; // 2

// Vertical companion to StrikeRangeScrollbar: maps a drag-on-thumb to a shift
// of the visible value window within the full [-1, 1] range. The value axis
// points UP (higher value = higher on screen), so the thumb's TOP edge tracks
// the window's upper bound. Zoom changes the thumb HEIGHT (how much of the
// range is visible); this scrollbar changes its POSITION (where in the range
// you're looking). Nothing about the chart resizes — only the shared y-window
// shifts — so there's no layout reflow.
export default function ValueRangeScrollbar({
  visibleNorm,
  onChange,
  className = '',
}: ValueRangeScrollbarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Drag-anchor snapshot taken on mousedown — deltas from this snapshot (rather
  // than the live window) keep the drag rigid across re-renders.
  const dragRef = useRef<{ startClientY: number; startLo: number } | null>(null);

  const [visLo, visHi] = visibleNorm;
  const visSpan = Math.max(0, visHi - visLo);
  const thumbHeightPct = Math.min(100, (visSpan / FULL_SPAN) * 100);
  // Top of the thumb = the window's upper bound (higher value sits higher up).
  const thumbTopPct = Math.max(
    0,
    Math.min(100 - thumbHeightPct, ((FULL_HI - visHi) / FULL_SPAN) * 100),
  );

  const fullyZoomedOut = thumbHeightPct >= 99.9;

  const applyDelta = useCallback(
    (clientY: number) => {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track) return;
      const rect = track.getBoundingClientRect();
      if (rect.height <= 0) return;
      const deltaPx = clientY - drag.startClientY;
      // Dragging DOWN the screen moves the window toward LOWER values.
      const deltaNorm = -(deltaPx / rect.height) * FULL_SPAN;
      let newLo = drag.startLo + deltaNorm;
      let newHi = newLo + visSpan;
      if (newLo < FULL_LO) {
        newLo = FULL_LO;
        newHi = newLo + visSpan;
      }
      if (newHi > FULL_HI) {
        newHi = FULL_HI;
        newLo = newHi - visSpan;
      }
      onChange([newLo, newHi]);
    },
    [visSpan, onChange],
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (dragRef.current) applyDelta(e.clientY);
    };
    const handleTouch = (e: TouchEvent) => {
      if (dragRef.current && e.touches.length > 0) applyDelta(e.touches[0].clientY);
    };
    const handleEnd = () => {
      dragRef.current = null;
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleEnd);
    window.addEventListener('touchmove', handleTouch, { passive: true });
    window.addEventListener('touchend', handleEnd);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouch);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [applyDelta]);

  const beginDrag = (clientY: number) => {
    dragRef.current = { startClientY: clientY, startLo: visLo };
  };

  // Clicking the track (but not the thumb) centers the window's value at the
  // click position — familiar scrollbar behavior.
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (fullyZoomedOut) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.height <= 0) return;
    const clickFraction = (e.clientY - rect.top) / rect.height;
    const centerValue = FULL_HI - clickFraction * FULL_SPAN;
    let newLo = centerValue - visSpan / 2;
    let newHi = newLo + visSpan;
    if (newLo < FULL_LO) {
      newLo = FULL_LO;
      newHi = newLo + visSpan;
    }
    if (newHi > FULL_HI) {
      newHi = FULL_HI;
      newLo = newHi - visSpan;
    }
    onChange([newLo, newHi]);
  };

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      className={`relative w-2.5 h-full rounded-full ${className}`}
      style={{
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
        cursor: fullyZoomedOut ? 'default' : 'pointer',
      }}
    >
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          if (!fullyZoomedOut) beginDrag(e.clientY);
        }}
        onTouchStart={(e) => {
          if (fullyZoomedOut) return;
          if (e.touches.length === 0) return;
          beginDrag(e.touches[0].clientY);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute left-0 w-full rounded-full"
        style={{
          top: `${thumbTopPct}%`,
          height: `${thumbHeightPct}%`,
          backgroundColor: 'var(--color-info)',
          opacity: fullyZoomedOut ? 0.35 : 0.85,
          cursor: fullyZoomedOut ? 'default' : 'grab',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
