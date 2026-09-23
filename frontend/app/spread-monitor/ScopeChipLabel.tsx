import { scopeLabel } from '@/core/spreadMonitor';

/**
 * A DTE-scope chip's label: "Through 7DTE" from `sm` up, "≤7DTE" on a phone,
 * where the four long labels plus the band chips wrapped the page's filter row
 * into three ragged lines. Both spans are always rendered; CSS picks one, so
 * there is no layout shift while the viewport hook settles.
 */
export default function ScopeChipLabel({ dte }: { dte: number }) {
  return (
    <>
      <span className="sm:hidden">{dte === 0 ? '0DTE' : `≤${dte}DTE`}</span>
      <span className="hidden sm:inline">{scopeLabel(dte)}</span>
    </>
  );
}
