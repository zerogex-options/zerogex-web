'use client';

import { WALL_DEPTH_SHORT, useWallDepth } from '@/core/WallDepthContext';
import { WALL_DEPTH_MAX, WALL_DEPTH_MIN, type WallDepth } from '@/core/wallLadder';

/**
 * How many Call/Put Walls per side the gamma surfaces draw — C1 only (the
 * primary walls, as it has always been), +C2, or +C3.
 *
 * A segmented control rather than a set of checkboxes because the levels are
 * cumulative: C2 always implies C1, so independent toggles would offer states
 * that don't exist. The button labels are the ladder's own names (C1/C2/C3),
 * which are also the labels drawn on the charts — so the control names the
 * thing it turns on rather than describing it.
 *
 * The preference is site-wide (core/WallDepthContext), so this control is the
 * same switch wherever it appears: a board with the Gamma Chart, the Strike
 * Profile and the Gamma Ladder side by side can never disagree with itself
 * about which walls exist.
 */
export default function WallDepthToggle({ className = '' }: { className?: string }) {
  const { wallDepth, setWallDepth } = useWallDepth();
  const depths = Array.from(
    { length: WALL_DEPTH_MAX - WALL_DEPTH_MIN + 1 },
    (_, i) => (WALL_DEPTH_MIN + i) as WallDepth,
  );

  return (
    <div
      className={`inline-flex items-center gap-1 ${className}`}
      role="group"
      aria-label="Call/Put wall depth"
    >
      <span className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Walls
      </span>
      <div
        className="inline-flex rounded overflow-hidden"
        style={{ border: '1px solid var(--border-default)' }}
      >
        {depths.map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setWallDepth(d)}
            aria-pressed={wallDepth === d}
            title={
              d === WALL_DEPTH_MIN
                ? 'Draw the Call Wall and Put Wall only'
                : `Also draw the secondary walls down to C${d} · P${d}`
            }
            className="px-1.5 py-0.5 text-[10px] font-mono"
            style={{
              background: wallDepth === d ? 'var(--color-info-soft)' : 'var(--bg-subtle)',
              color: wallDepth === d ? 'var(--text-primary)' : 'var(--text-muted)',
              fontWeight: wallDepth === d ? 700 : 500,
              cursor: 'pointer',
            }}
          >
            {WALL_DEPTH_SHORT[d]}
          </button>
        ))}
      </div>
    </div>
  );
}
