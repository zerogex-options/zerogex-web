'use client';

import { useCallback, useEffect, useRef } from 'react';

interface StrikeRangeScrollbarProps {
  visibleDomain: [number, number];
  fullDomain: [number, number];
  onChange: (next: [number, number]) => void;
  className?: string;
}

// Custom horizontal scrollbar that maps a drag-on-thumb to a shift of the
// visible-domain window within the full strike range. Used as a companion
// to the zoom buttons on the strike charts: zoom changes the thumb WIDTH
// (how much of the full range is visible), this scrollbar changes the
// thumb POSITION (where in the full range you're looking). Nothing about
// the chart container resizes — only the XAxis domain shifts — so the
// y-axis stays pinned and there's no layout reflow.
export default function StrikeRangeScrollbar({
  visibleDomain,
  fullDomain,
  onChange,
  className = '',
}: StrikeRangeScrollbarProps) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  // Drag-anchor snapshot taken on mousedown — using deltas from this snapshot
  // (instead of the current visibleDomain) makes the drag feel rigid: a
  // pointer move of 100px always shifts the domain by the same amount, no
  // matter how many re-renders happened in between.
  const dragRef = useRef<{ startClientX: number; startDomainStart: number } | null>(null);

  const [fullStart, fullEnd] = fullDomain;
  const [visStart, visEnd] = visibleDomain;
  const fullWidth = Math.max(1e-9, fullEnd - fullStart);
  const visWidth = Math.max(0, visEnd - visStart);
  const thumbWidthPct = Math.min(100, (visWidth / fullWidth) * 100);
  // Avoid division by zero when fully zoomed out — the thumb just pins to 0%.
  const maxLeftFraction = fullWidth - visWidth > 0 ? (visStart - fullStart) / fullWidth : 0;
  const thumbLeftPct = Math.max(0, Math.min(100 - thumbWidthPct, maxLeftFraction * 100));

  const fullyZoomedOut = thumbWidthPct >= 99.9;

  const applyDelta = useCallback(
    (clientX: number) => {
      const drag = dragRef.current;
      const track = trackRef.current;
      if (!drag || !track) return;
      const rect = track.getBoundingClientRect();
      if (rect.width <= 0) return;
      const deltaPx = clientX - drag.startClientX;
      const deltaStrike = (deltaPx / rect.width) * fullWidth;
      let newStart = drag.startDomainStart + deltaStrike;
      let newEnd = newStart + visWidth;
      if (newStart < fullStart) {
        newStart = fullStart;
        newEnd = newStart + visWidth;
      }
      if (newEnd > fullEnd) {
        newEnd = fullEnd;
        newStart = newEnd - visWidth;
      }
      onChange([newStart, newEnd]);
    },
    [fullStart, fullEnd, fullWidth, visWidth, onChange],
  );

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      if (!dragRef.current) return;
      applyDelta(e.clientX);
    };
    const handleTouch = (e: TouchEvent) => {
      if (!dragRef.current || e.touches.length === 0) return;
      applyDelta(e.touches[0].clientX);
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

  const beginDrag = (clientX: number) => {
    dragRef.current = { startClientX: clientX, startDomainStart: visStart };
  };

  // Clicking the track (but not the thumb) jumps the thumb so its center
  // lands at the click position. Matches familiar browser-scrollbar UX.
  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (fullyZoomedOut) return;
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    if (rect.width <= 0) return;
    const clickFraction = (e.clientX - rect.left) / rect.width;
    const centerStrike = fullStart + clickFraction * fullWidth;
    let newStart = centerStrike - visWidth / 2;
    let newEnd = newStart + visWidth;
    if (newStart < fullStart) {
      newStart = fullStart;
      newEnd = newStart + visWidth;
    }
    if (newEnd > fullEnd) {
      newEnd = fullEnd;
      newStart = newEnd - visWidth;
    }
    onChange([newStart, newEnd]);
  };

  return (
    <div
      ref={trackRef}
      onClick={handleTrackClick}
      className={`relative h-2.5 rounded-full ${className}`}
      style={{
        backgroundColor: 'var(--color-surface-subtle)',
        border: '1px solid var(--color-border)',
        cursor: fullyZoomedOut ? 'default' : 'pointer',
      }}
    >
      <div
        onMouseDown={(e) => {
          e.stopPropagation();
          if (fullyZoomedOut) return;
          beginDrag(e.clientX);
        }}
        onTouchStart={(e) => {
          if (fullyZoomedOut) return;
          if (e.touches.length === 0) return;
          beginDrag(e.touches[0].clientX);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-0 h-full rounded-full"
        style={{
          left: `${thumbLeftPct}%`,
          width: `${thumbWidthPct}%`,
          backgroundColor: 'var(--color-info)',
          opacity: fullyZoomedOut ? 0.35 : 0.85,
          cursor: fullyZoomedOut ? 'default' : 'grab',
          touchAction: 'none',
        }}
      />
    </div>
  );
}
