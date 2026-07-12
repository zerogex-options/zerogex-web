import type { CSSProperties } from 'react';

/**
 * Registration / crop marks in the four corners of a panel — a technical-
 * drawing signature that marks a surface as a considered object, not a
 * generic card. Neutral by default (structural, not signal), so it never
 * competes with the amber flip or the bull/bear data colors. Parent must be
 * position: relative.
 */
export default function RegistrationCorners({
  color = 'var(--border-strong)',
  size = 9,
  inset = 7,
}: {
  color?: string;
  size?: number;
  inset?: number;
}) {
  const base: CSSProperties = { position: 'absolute', width: size, height: size, pointerEvents: 'none' };
  return (
    <>
      <span aria-hidden style={{ ...base, top: inset, left: inset, borderTop: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
      <span aria-hidden style={{ ...base, top: inset, right: inset, borderTop: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
      <span aria-hidden style={{ ...base, bottom: inset, left: inset, borderBottom: `1px solid ${color}`, borderLeft: `1px solid ${color}` }} />
      <span aria-hidden style={{ ...base, bottom: inset, right: inset, borderBottom: `1px solid ${color}`, borderRight: `1px solid ${color}` }} />
    </>
  );
}
