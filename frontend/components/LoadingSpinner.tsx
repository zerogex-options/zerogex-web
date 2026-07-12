/**
 * Loading spinner component
 */

export default function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'h-6 w-6',
    md: 'h-12 w-12',
    lg: 'h-16 w-16'
  };

  return (
    <div className="flex items-center justify-center p-8">
      <div className={`animate-spin rounded-full border-b-2 border-[var(--accent-2)] ${sizeClasses[size]}`}></div>
    </div>
  );
}

export function LoadingCard() {
  // Ruled skeleton in the flat-panel language: a kicker line, an oversized
  // value line, and a caption line — reads as an instrument warming up, not a
  // spinner in a box.
  return (
    <div className="zg-panel p-5 h-full">
      <div className="zg-skeleton-line" style={{ width: '42%', height: 10, marginBottom: 18 }} />
      <div className="zg-skeleton-line" style={{ width: '68%', height: 26, marginBottom: 12 }} />
      <div className="zg-skeleton-line" style={{ width: '52%', height: 10 }} />
    </div>
  );
}
