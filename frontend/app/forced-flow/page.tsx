'use client';

import { useTimeframe, type UnderlyingSymbol } from '@/core/TimeframeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';
import ForcedFlowRail from '@/components/ForcedFlowRail';
import ForcedFlowCurveChart from '@/components/ForcedFlowCurveChart';
import CharmIntoCloseChart from '@/components/CharmIntoCloseChart';
import VannaLadderChart from '@/components/VannaLadderChart';
import ForcedFlowSurfaceChart from '@/components/ForcedFlowSurfaceChart';
import ForcedFlowTrackRecord from '@/components/ForcedFlowTrackRecord';

// The on-page selector drives the shared TimeframeContext symbol (same source
// of truth as the global header picker), so switching here stays in lockstep
// with the rest of the app.
const SYMBOLS: UnderlyingSymbol[] = ['SPY', 'SPX', 'QQQ'];

export default function ForcedFlowPage() {
  const { symbol, setSymbol } = useTimeframe();
  const t = usePageT(dict);

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-wrap items-center gap-3 mb-2">
        <h1 className="text-3xl font-bold">{t('heading')}</h1>
        {/* Symbol selector — styled to match the global SymbolPicker. */}
        <div className="flex items-center gap-2" aria-label={t('symbolAriaLabel')}>
          {SYMBOLS.map((s) => {
            const active = s === symbol;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setSymbol(s)}
                aria-pressed={active}
                className="px-3 py-1.5 rounded-lg text-xs font-bold tracking-wider uppercase transition-colors"
                style={{
                  background: active ? 'var(--color-warning-soft)' : 'transparent',
                  border: `1px solid ${active ? 'var(--color-warning)' : 'var(--color-border)'}`,
                  color: active ? 'var(--color-warning)' : 'var(--color-text-secondary)',
                }}
              >
                {s}
              </button>
            );
          })}
        </div>
      </div>

      <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
        <strong>{t('heading')}</strong> {t('descriptionBody')}
      </p>

      {/* Hero row: slim regime rail beside the flagship reprice curve. */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_minmax(0,1fr)] gap-6 mb-6">
        <ForcedFlowRail symbol={symbol} />
        <ForcedFlowCurveChart symbol={symbol} />
      </div>

      {/* Charm into close + vanna ladder side by side. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <CharmIntoCloseChart symbol={symbol} />
        <VannaLadderChart symbol={symbol} />
      </div>

      {/* Full-width spot × time surface. */}
      <div className="mb-6">
        <ForcedFlowSurfaceChart symbol={symbol} />
      </div>

      {/* Track record: does the charm-into-close forecast actually work? */}
      <ForcedFlowTrackRecord symbol={symbol} />
    </div>
  );
}
