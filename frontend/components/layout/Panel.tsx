import type { CSSProperties, ReactNode } from 'react';

/**
 * The one bordered surface per zone (`.zg-panel`: flat --bg-card + a single
 * hairline, 2px radius, no glow, no gradient). "One border deep" — never nest
 * a Panel inside another Panel; group leaf tiles inside a single Panel and
 * separate them with rules.
 */
export default function Panel({
  padded = true,
  className = '',
  style,
  children,
}: {
  padded?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div className={`zg-panel ${padded ? 'p-5' : ''} ${className}`} style={style}>
      {children}
    </div>
  );
}
