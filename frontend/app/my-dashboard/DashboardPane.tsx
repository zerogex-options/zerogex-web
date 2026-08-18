'use client';

/**
 * One half of a split "My Dashboard" board.
 *
 * A pane is a widget grid plus a *data scope*: an optional underlying symbol and
 * an optional expiration selection that override the page-wide ones for every
 * widget inside it. That override is what makes the split worth having — clone
 * the left half to the right, point the copy at next Friday (or at QQQ), and
 * read the two against each other in one view.
 *
 * The override is installed by re-providing two existing contexts rather than
 * threading props through every widget:
 *   • TimeframeSymbolScope re-provides the timeframe context with this pane's
 *     symbol, so every component that calls useTimeframe() — down to the Gamma
 *     Terminal and the strike profile — fetches for it. Its own symbol switcher
 *     retargets the pane instead of the whole site.
 *   • ExpirationScopeContext does the same for useSharedExpirations(), so the
 *     charts' built-in expiration filters read and write this pane's selection
 *     instead of the tab-wide one.
 *
 * WHILE THE BOARD IS SPLIT BOTH SCOPES ARE ALWAYS INSTALLED, even on a half that
 * hasn't been retargeted yet. Two halves that both merely "follow the page" are
 * not independent: changing the expiry (or the symbol) from a chart inside one
 * of them would write the page-wide value and drag the other half along with it,
 * which is exactly what a split board must not do. So a not-yet-pinned half is
 * seeded with the page's CURRENT values and its first change pins that half
 * alone — the other side does not move. An unsplit, unscoped board installs
 * neither scope and behaves exactly as it did before the split existed.
 */

import { useCallback, useMemo, type ReactNode } from 'react';
import { Copy, Eraser, LayoutGrid, Plus } from 'lucide-react';

import ExpirationMultiSelect from '@/components/ExpirationMultiSelect';
import { TimeframeSymbolScope, useTimeframe } from '@/core/TimeframeContext';
import { ExpirationScopeContext, type ExpirationScopeValue } from '@/core/expirationScope';
import { usePageT } from '@/core/LanguageContext';
import { SYMBOLS } from '@/core/symbols';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import { etTodayDateKey } from '@/core/utils';
import { reconcileExpirations } from '@/core/expirationPersistence';
import {
  chartExpirationOptions,
  strikeExpirationOptions,
} from '@/core/gexStrikeCharts';
import { useGEXByStrike } from '@/hooks/useApiData';
import { useSharedExpirations } from '@/hooks/useSharedExpirations';
import type { DashboardPane as DashboardPaneModel, PaneId, WidgetSize } from '@/core/myDashboardLayout';
import { isScoped, otherPaneId } from '@/core/myDashboardLayout';

import { getWidget } from './registry';
import { MyDashboardDataProvider, type FeedKey } from './DashboardData';
import DashboardGrid from './DashboardGrid';
import { dict } from './DashboardPane.i18n';

/** Display letter for a pane id — 'a' → "A". */
export function paneLetter(id: PaneId): string {
  return id.toUpperCase();
}

export type DashboardPaneProps = {
  pane: DashboardPaneModel;
  /** True when both panes render, which is what shows the pane toolbar. */
  split: boolean;
  editing: boolean;
  hasPro: boolean;
  onSymbolChange: (paneId: PaneId, symbol: UnderlyingSymbol | null) => void;
  onExpirationsChange: (paneId: PaneId, expirations: readonly string[] | null) => void;
  onClone: (from: PaneId) => void;
  onClear: (paneId: PaneId) => void;
  onOpenGallery: (paneId: PaneId) => void;
  onReorder: (paneId: PaneId, from: number, to: number) => void;
  onRemove: (instanceId: string) => void;
  onResize: (instanceId: string, size: WidgetSize) => void;
  onDuplicate: (instanceId: string) => void;
  onSendToOtherPane: (instanceId: string, target: PaneId) => void;
};

export default function DashboardPane({
  pane,
  split,
  editing,
  hasPro,
  onSymbolChange,
  onExpirationsChange,
  onClone,
  onClear,
  onOpenGallery,
  onReorder,
  onRemove,
  onResize,
  onDuplicate,
  onSendToOtherPane,
}: DashboardPaneProps) {
  const t = usePageT(dict);
  const { symbol: pageSymbol } = useTimeframe();
  // Read OUTSIDE any expiration scope (this component installs it below), so
  // this is the page-wide selection a not-yet-pinned half starts from.
  const { selection: pageExpirations } = useSharedExpirations();
  const effectiveSymbol = pane.scope.symbol ?? pageSymbol;
  const effectiveExpirations = pane.scope.expirations ?? pageExpirations;
  const other = otherPaneId(pane.id);

  // Only the feeds this pane's own widgets consume are polled live — a split
  // board runs two providers, so gating per pane keeps a chart-only half from
  // opening the 1 Hz quote loop the other half needs.
  const activeFeeds = useMemo<Set<FeedKey>>(() => {
    const set = new Set<FeedKey>();
    for (const w of pane.widgets) {
      getWidget(w.widgetId)?.feeds.forEach((f) => set.add(f));
    }
    return set;
  }, [pane.widgets]);

  const setExpirations = useCallback(
    (next: readonly string[] | null) => onExpirationsChange(pane.id, next),
    [onExpirationsChange, pane.id],
  );

  // Installed whenever this half must be independent: always while the board is
  // split, and otherwise only when the half pins its own expirations. Its setter
  // pins THIS half, so a chart's built-in expiration filter never writes the
  // page-wide selection out from under the other side.
  const expirationScope = useMemo<ExpirationScopeValue | null>(() => {
    if (!split && pane.scope.expirations === null) return null;
    return { selection: effectiveExpirations, setSelection: setExpirations };
  }, [split, pane.scope.expirations, effectiveExpirations, setExpirations]);

  const handlePaneSymbolChange = useCallback(
    (next: UnderlyingSymbol) => onSymbolChange(pane.id, next),
    [onSymbolChange, pane.id],
  );

  return (
    <section
      className="flex min-w-0 flex-col"
      aria-label={t('sideLabel', { side: paneLetter(pane.id) })}
    >
      {(split || isScoped(pane.scope)) && (
        <PaneToolbar
          pane={pane}
          pageSymbol={pageSymbol}
          effectiveSymbol={effectiveSymbol}
          onSymbolChange={onSymbolChange}
          onExpirationsChange={onExpirationsChange}
          onClone={onClone}
          onClear={onClear}
          onOpenGallery={onOpenGallery}
        />
      )}

      {pane.widgets.length === 0 ? (
        <EmptyPane
          paneId={pane.id}
          onClone={onClone}
          onOpenGallery={onOpenGallery}
        />
      ) : (
        <TimeframeSymbolScope
          // While split, even a half that still follows the page gets a concrete
          // symbol scope, so a chart's own symbol switcher pins this half rather
          // than moving the page — and the other side with it.
          symbol={split ? effectiveSymbol : pane.scope.symbol}
          onSymbolChange={handlePaneSymbolChange}
        >
          <ExpirationScopeContext.Provider value={expirationScope}>
            <MyDashboardDataProvider activeFeeds={activeFeeds}>
              <DashboardGrid
                items={pane.widgets}
                editing={editing}
                hasPro={hasPro}
                half={split}
                // Switching this pane's symbol re-fetches every widget in it, so
                // key the error boundaries on the symbol actually in force here:
                // a widget that errored on the old one gets a fresh mount.
                resetKey={effectiveSymbol}
                onReorder={(from, to) => onReorder(pane.id, from, to)}
                onRemove={onRemove}
                onResize={onResize}
                onDuplicate={onDuplicate}
                sendToPane={split ? other : null}
                onSendToPane={onSendToOtherPane}
              />
            </MyDashboardDataProvider>
          </ExpirationScopeContext.Provider>
        </TimeframeSymbolScope>
      )}
    </section>
  );
}

// ── Pane toolbar ─────────────────────────────────────────────────────────────

function PaneToolbar({
  pane,
  pageSymbol,
  effectiveSymbol,
  onSymbolChange,
  onExpirationsChange,
  onClone,
  onClear,
  onOpenGallery,
}: {
  pane: DashboardPaneModel;
  pageSymbol: UnderlyingSymbol;
  effectiveSymbol: UnderlyingSymbol;
  onSymbolChange: (paneId: PaneId, symbol: UnderlyingSymbol | null) => void;
  onExpirationsChange: (paneId: PaneId, expirations: readonly string[] | null) => void;
  onClone: (from: PaneId) => void;
  onClear: (paneId: PaneId) => void;
  onOpenGallery: (paneId: PaneId) => void;
}) {
  const t = usePageT(dict);
  const letter = paneLetter(pane.id);
  const otherLetter = paneLetter(otherPaneId(pane.id));

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2"
      style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
    >
      <span
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-black"
        style={{ background: 'var(--color-accent-soft)', color: 'var(--color-accent-hot)' }}
        aria-hidden
      >
        {letter}
      </span>

      <PaneSymbolSelect
        paneId={pane.id}
        value={pane.scope.symbol}
        pageSymbol={pageSymbol}
        onChange={onSymbolChange}
      />

      <PaneExpirationSelect
        paneId={pane.id}
        symbol={effectiveSymbol}
        pinned={pane.scope.expirations}
        onChange={onExpirationsChange}
      />

      <div className="ml-auto flex items-center gap-1">
        <ToolbarButton
          label={t('addWidgetsToSide', { side: letter })}
          onClick={() => onOpenGallery(pane.id)}
        >
          <Plus size={14} /> {t('addWidgets')}
        </ToolbarButton>
        <ToolbarButton
          label={t('cloneToOtherSideTitle', { side: otherLetter })}
          onClick={() => onClone(pane.id)}
          disabled={pane.widgets.length === 0}
        >
          <Copy size={14} /> {otherLetter}
        </ToolbarButton>
        <ToolbarButton
          label={t('clearSide')}
          onClick={() => onClear(pane.id)}
          disabled={pane.widgets.length === 0}
        >
          <Eraser size={14} />
        </ToolbarButton>
      </div>
    </div>
  );
}

function ToolbarButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[11px] font-bold transition-colors disabled:opacity-40"
      style={{ color: 'var(--text-secondary)' }}
      onMouseEnter={(e) => {
        if (!disabled) e.currentTarget.style.background = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'transparent';
      }}
    >
      {children}
    </button>
  );
}

/** Underlying for this half: the page's pick, or one pinned to the pane. */
function PaneSymbolSelect({
  paneId,
  value,
  pageSymbol,
  onChange,
}: {
  paneId: PaneId;
  value: UnderlyingSymbol | null;
  pageSymbol: UnderlyingSymbol;
  onChange: (paneId: PaneId, symbol: UnderlyingSymbol | null) => void;
}) {
  const t = usePageT(dict);
  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(paneId, e.target.value ? (e.target.value as UnderlyingSymbol) : null)}
      aria-label={t('symbolForSide', { side: paneLetter(paneId) })}
      className="h-7 rounded-md border px-2 text-xs font-bold"
      style={{
        borderColor: 'var(--border-default)',
        background: 'var(--bg-hover)',
        color: value ? 'var(--color-warning)' : 'var(--text-secondary)',
      }}
    >
      <option value="">{t('followPageSymbol', { symbol: pageSymbol })}</option>
      {SYMBOLS.map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}

/**
 * Expirations for this half. The option list is the same current/future
 * universe the strike charts filter by, derived from the by-strike snapshot for
 * THIS pane's symbol — so pinning the pane to QQQ immediately offers QQQ's
 * expirations. Polls slowly: the set of tradeable expirations barely moves
 * intraday, and the charts inside the pane already fetch the live data.
 */
function PaneExpirationSelect({
  paneId,
  symbol,
  pinned,
  onChange,
}: {
  paneId: PaneId;
  symbol: UnderlyingSymbol;
  pinned: string[] | null;
  onChange: (paneId: PaneId, expirations: readonly string[] | null) => void;
}) {
  const t = usePageT(dict);
  // The toolbar renders OUTSIDE its pane's ExpirationScopeContext (it is the
  // control that installs that scope), so this reads the tab-wide selection —
  // exactly what "follow the page" means here.
  const { selection: shared } = useSharedExpirations();
  const { data: gexByStrike } = useGEXByStrike(symbol, 200, 60000, 'impact');
  const todayKey = etTodayDateKey();

  const options = useMemo(
    () => chartExpirationOptions(strikeExpirationOptions(gexByStrike), todayKey),
    [gexByStrike, todayKey],
  );

  // While inheriting, show what the page is actually filtering by, reconciled to
  // this symbol's chain — so switching to a pinned set starts from what's on
  // screen rather than from a stale date the chart already dropped.
  const effective = pinned ?? shared;
  const selected = useMemo(
    () => reconcileExpirations(effective, options),
    [effective, options],
  );

  return (
    <ExpirationMultiSelect
      label={t('expiration')}
      options={options}
      selected={selected}
      onChange={(next) => onChange(paneId, next)}
      inheritOption={{
        label: t('followPageExpirations'),
        active: pinned === null,
        onSelect: () => onChange(paneId, null),
      }}
    />
  );
}

// ── Empty pane ───────────────────────────────────────────────────────────────

function EmptyPane({
  paneId,
  onClone,
  onOpenGallery,
}: {
  paneId: PaneId;
  onClone: (from: PaneId) => void;
  onOpenGallery: (paneId: PaneId) => void;
}) {
  const t = usePageT(dict);
  const other = otherPaneId(paneId);
  return (
    <div
      className="flex h-full min-h-[220px] flex-col items-center justify-center gap-3 rounded-xl border border-dashed p-6 text-center"
      style={{ borderColor: 'var(--border-default)' }}
    >
      <LayoutGrid size={22} style={{ color: 'var(--text-muted)' }} />
      <div>
        <div className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
          {t('emptySideTitle')}
        </div>
        <p className="zg-small mt-1 max-w-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('emptySideLead')}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button type="button" onClick={() => onClone(other)} className="zg-btn zg-btn--secondary">
          <Copy size={14} /> {t('cloneFromOtherSide', { side: paneLetter(other) })}
        </button>
        <button
          type="button"
          onClick={() => onOpenGallery(paneId)}
          className="zg-btn zg-btn--primary"
        >
          <Plus size={14} /> {t('addWidgets')}
        </button>
      </div>
    </div>
  );
}
