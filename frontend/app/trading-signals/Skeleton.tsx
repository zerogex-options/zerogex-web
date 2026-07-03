'use client';

/**
 * Content-shape skeleton primitives for the TradeWorkz dashboard.
 *
 * We use skeleton blocks instead of a full-page spinner because the page has
 * many independent async surfaces (summary, leaderboard, roster). A single
 * spinner would hide meaningful progressive rendering; skeletons show where
 * each surface will resolve so the user's eye already knows the layout.
 */

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  radius?: string | number;
  className?: string;
}

export function Skeleton({ width, height = 12, radius = 4, className = '' }: SkeletonProps) {
  return (
    <div
      className={`tw-skel ${className}`}
      style={{
        width: typeof width === 'number' ? `${width}px` : width ?? '100%',
        height: typeof height === 'number' ? `${height}px` : height,
        borderRadius: typeof radius === 'number' ? `${radius}px` : radius,
      }}
    />
  );
}

export function SummarySkeleton() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="p-6 rounded-2xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Skeleton width="40%" height={10} />
          <div className="mt-3">
            <Skeleton width="65%" height={22} />
          </div>
          <div className="mt-3">
            <Skeleton width="55%" height={10} />
          </div>
        </div>
      ))}
      <style jsx global>{`
        .tw-skel {
          background: linear-gradient(
            90deg,
            var(--color-border) 0%,
            var(--color-surface-subtle) 50%,
            var(--color-border) 100%
          );
          background-size: 200% 100%;
          animation: tw-shimmer 1.4s linear infinite;
        }
        @keyframes tw-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

export function LeaderboardSkeleton({ rows = 9 }: { rows?: number }) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--color-surface)',
        border: '1px solid var(--color-border)',
      }}
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="px-4 py-3 flex items-center gap-4 border-b border-[var(--color-border)]/40 last:border-b-0"
        >
          <Skeleton width={20} height={20} radius="50%" />
          <div className="flex-1 min-w-0">
            <Skeleton width="42%" height={12} />
            <div className="mt-2">
              <Skeleton width="70%" height={9} />
            </div>
          </div>
          <Skeleton width={96} height={22} radius={6} />
          <Skeleton width={64} height={14} />
          <Skeleton width={64} height={14} />
        </div>
      ))}
    </div>
  );
}

export function RosterSkeleton({ count = 9 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-5 rounded-2xl"
          style={{
            backgroundColor: 'var(--color-surface)',
            border: '1px solid var(--color-border)',
          }}
        >
          <Skeleton width="55%" height={16} />
          <div className="mt-3">
            <Skeleton width="80%" height={10} />
          </div>
          <div className="mt-5">
            <Skeleton height={60} radius={8} />
          </div>
          <div className="grid grid-cols-4 gap-3 mt-4">
            {[0, 1, 2, 3].map((j) => (
              <div key={j}>
                <Skeleton width="50%" height={8} />
                <div className="mt-2">
                  <Skeleton width="70%" height={12} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
