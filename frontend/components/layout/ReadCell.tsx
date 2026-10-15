import type { ReactNode } from 'react';

/**
 * One cell of a session read: a label, one mono value and a line of context.
 * Cells sit edge to edge in a single `.zg-panel` whose background shows
 * through 1px gaps as the rules between them ("one border deep"), the strip
 * that heads the Technicals and Flow Analysis pages.
 */
export default function ReadCell({
  label,
  value,
  sub,
  subColor,
  valueColor,
  size = 22,
}: {
  label: ReactNode;
  value: ReactNode;
  sub: ReactNode;
  subColor?: string;
  valueColor?: string;
  size?: number;
}) {
  return (
    <div style={{ background: 'var(--bg-card)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
      <div className="zg-label">{label}</div>
      <div className="zg-metric" style={{ fontSize: size, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: valueColor }}>
        {value}
      </div>
      <div className="zg-mono" style={{ fontSize: 12, color: subColor ?? 'var(--text-muted)' }}>
        {sub}
      </div>
    </div>
  );
}
