/**
 * Shared "this is working, hold on" affordance for the replay routes.
 *
 * The replay pages fetch a whole session's worth of per-minute frames, which
 * routinely runs a few seconds. Every surface that waits on that — the route
 * loading boundaries and the session cards on /replay — says so with the same
 * two marks: a spinner and a sentence. The spinner alone is ambiguous when a
 * page is mostly skeleton bars; the sentence alone reads as static copy.
 *
 * The global `prefers-reduced-motion` rule in globals.css collapses the spin,
 * which is exactly why the text is never optional.
 */

export function Spinner({ size = 12 }: { size?: number }) {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 animate-spin rounded-full border-[1.5px] border-[var(--color-border)] border-t-[var(--accent-2)]"
      style={{ width: size, height: size }}
    />
  );
}

export function LoadingNote({
  children = 'Loading…',
  className = '',
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-2 font-mono text-xs text-[var(--color-text-secondary)] ${className}`}
    >
      <Spinner />
      {children}
    </div>
  );
}
