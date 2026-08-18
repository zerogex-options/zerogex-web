'use client';

/**
 * My Dashboard — a customizable board a member assembles from the pieces of the
 * site they have access to under their plan. Layout persists per-member in the
 * browser; widgets are tier-gated (Pro-only pieces show an upgrade prompt for
 * Basic members). Reordering is drag-and-drop on desktop and button-driven on
 * touch.
 *
 * The board can be SPLIT into two independent halves. Set one half up, clone it
 * across with one click, then point the copy at a different expiry or a
 * different underlying — the two halves render side by side, each fetching its
 * own data. The scoping mechanism lives in DashboardPane; this file owns the
 * layout state, persistence and the board-level controls.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Pencil,
  Check,
  Columns2,
  Copy,
  Plus,
  RotateCcw,
  Sparkles,
  Lock,
} from 'lucide-react';

import PageShell from '@/components/layout/PageShell';
import { useAuthSession } from '@/hooks/useAuthSession';
import { useTimeframe } from '@/core/TimeframeContext';
import { usePageT } from '@/core/LanguageContext';
import { dict } from './page.i18n';
import { hasTierAccess, normalizeTier } from '@/core/auth';
import { SYMBOLS } from '@/core/symbols';
import {
  addWidget,
  clearLayout,
  clearPane,
  clonePane,
  duplicateWidget,
  emptyLayout,
  getPane,
  isLayoutEmpty,
  loadLayout,
  moveWidget,
  moveWidgetToPane,
  otherPaneId,
  removeAllOfWidget,
  removeWidget,
  resizeWidget,
  saveLayout,
  setPaneExpirations,
  setPaneSymbol,
  setSplit,
  visiblePanes,
  widgetCounts,
  type DashboardLayout,
  type PaneId,
  type WidgetSize,
} from '@/core/myDashboardLayout';
import type { UnderlyingSymbol } from '@/core/symbolPersistence';
import {
  PRESETS,
  WIDGET_IDS,
  getWidget,
  type DashboardPreset,
  type WidgetDef,
} from './registry';
import DashboardPane, { paneLetter } from './DashboardPane';
import AddWidgetGallery from './AddWidgetGallery';

export default function MyDashboardPage() {
  const t = usePageT(dict);
  const { data: authSession, loading: authLoading } = useAuthSession();
  const tier = authSession?.user?.tier ?? 'public';
  const hasPro = hasTierAccess(normalizeTier(tier), 'pro');
  const scope = authSession?.user?.id ?? null;

  const [hydrated, setHydrated] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>(emptyLayout);
  const [editing, setEditing] = useState(false);
  // Which half the add-widget gallery is adding to; null while it's closed. The
  // gallery's counts and its add/remove actions all address that pane, so on a
  // split board "3 placed" means three on THIS side.
  const [galleryPane, setGalleryPane] = useState<PaneId | null>(null);

  // Load the saved board once auth resolves (so we key storage by member id).
  // localStorage is client-only, so this runs post-mount to avoid a hydration
  // mismatch. The state updates happen inside a microtask callback (not the
  // effect body) to satisfy react-hooks/set-state-in-effect.
  useEffect(() => {
    if (authLoading) return;
    let cancelled = false;
    void Promise.resolve().then(() => {
      if (cancelled) return;
      const loaded = loadLayout(scope, WIDGET_IDS);
      setLayout(loaded ?? emptyLayout());
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [authLoading, scope]);

  // Persist on every change once hydrated.
  useEffect(() => {
    if (!hydrated) return;
    saveLayout(layout, scope);
  }, [layout, hydrated, scope]);

  // Copies per widget id in the pane the gallery is targeting — the gallery
  // shows a count and can add another copy.
  const galleryTarget: PaneId = galleryPane ?? 'a';
  const counts = useMemo(
    () => widgetCounts(layout, galleryTarget),
    [layout, galleryTarget],
  );

  const handleAdd = useCallback(
    (widget: WidgetDef) => {
      setLayout((l) => addWidget(l, galleryTarget, widget.id, widget.defaultSize));
    },
    [galleryTarget],
  );
  const handleRemoveAll = useCallback(
    (widget: WidgetDef) => {
      setLayout((l) => removeAllOfWidget(l, widget.id, galleryTarget));
    },
    [galleryTarget],
  );
  const handleRemove = useCallback((instanceId: string) => {
    setLayout((l) => removeWidget(l, instanceId));
  }, []);
  const handleDuplicate = useCallback((instanceId: string) => {
    setLayout((l) => duplicateWidget(l, instanceId));
  }, []);
  const handleResize = useCallback((instanceId: string, size: WidgetSize) => {
    setLayout((l) => resizeWidget(l, instanceId, size));
  }, []);
  const handleReorder = useCallback((paneId: PaneId, from: number, to: number) => {
    setLayout((l) => moveWidget(l, paneId, from, to));
  }, []);
  const handleSendToPane = useCallback((instanceId: string, target: PaneId) => {
    setLayout((l) => moveWidgetToPane(l, instanceId, target));
  }, []);

  // ── Split / per-half controls ──
  const handleToggleSplit = useCallback(() => {
    // Collapsing keeps side B's contents (see setSplit) so the toggle is
    // reversible — nothing is thrown away by going back to one board.
    setLayout((l) => setSplit(l, !l.split));
  }, []);

  const handlePaneSymbol = useCallback((paneId: PaneId, next: UnderlyingSymbol | null) => {
    setLayout((l) => setPaneSymbol(l, paneId, next));
  }, []);

  const handlePaneExpirations = useCallback(
    (paneId: PaneId, next: readonly string[] | null) => {
      setLayout((l) => setPaneExpirations(l, paneId, next));
    },
    [],
  );

  // The headline action: copy this half onto the other one (turning the split on
  // if it wasn't already), so the member can retarget the copy. Confirmed only
  // when the target already holds widgets — the copy replaces them. The confirm
  // runs outside the updater so it can't fire twice under StrictMode.
  const handleClone = useCallback(
    (from: PaneId) => {
      const to = otherPaneId(from);
      if (
        getPane(layout, to).widgets.length > 0 &&
        typeof window !== 'undefined' &&
        !window.confirm(t('confirmCloneSide', { side: paneLetter(to) }))
      ) {
        return;
      }
      setLayout((l) => clonePane(l, from, to));
    },
    [layout, t],
  );

  const handleClearPane = useCallback(
    (paneId: PaneId) => {
      if (
        typeof window !== 'undefined' &&
        !window.confirm(t('confirmClearSide', { side: paneLetter(paneId) }))
      ) {
        return;
      }
      setLayout((l) => clearPane(l, paneId));
    },
    [t],
  );

  const applyPreset = useCallback(
    (preset: DashboardPreset) => {
      // A preset seeds the first half only; cloning it across is the member's
      // next move, not something a preset should decide for them.
      let next = emptyLayout();
      for (const w of preset.widgets) {
        const def = getWidget(w.widgetId);
        if (!def) continue;
        // Skip Pro widgets a Basic member can't use, so a preset never seeds a
        // board full of locked tiles.
        if (def.tier === 'pro' && !hasPro) continue;
        next = addWidget(next, 'a', w.widgetId, w.size);
      }
      setLayout(next);
      setEditing(false);
      setGalleryPane(null);
    },
    [hasPro],
  );

  const handleReset = useCallback(() => {
    if (typeof window !== 'undefined' && !window.confirm(t('confirmResetBoard'))) {
      return;
    }
    clearLayout(scope);
    setLayout(emptyLayout());
    setEditing(false);
  }, [scope, t]);

  const isEmpty = isLayoutEmpty(layout);
  const panes = visiblePanes(layout);

  return (
    <PageShell width="bleed">
      <Header
        editing={editing}
        isEmpty={isEmpty}
        split={layout.split}
        canClone={getPane(layout, 'a').widgets.length > 0}
        onToggleEdit={() => setEditing((e) => !e)}
        onToggleSplit={handleToggleSplit}
        onClone={() => handleClone('a')}
        onOpenGallery={() => setGalleryPane('a')}
        onReset={handleReset}
      />

      {!hydrated ? (
        <BoardSkeleton />
      ) : isEmpty ? (
        <EmptyState
          hasPro={hasPro}
          presets={PRESETS}
          onApplyPreset={applyPreset}
          onOpenGallery={() => setGalleryPane('a')}
        />
      ) : (
        <>
          {editing && (
            <div
              className="mb-4 flex items-center gap-2 rounded-xl border px-4 py-2.5 zg-small"
              style={{
                borderColor: 'var(--color-accent-hot)',
                background: 'var(--color-accent-soft)',
                color: 'var(--text-secondary)',
              }}
            >
              <Sparkles size={14} style={{ color: 'var(--color-accent-hot)' }} />
              {layout.split ? t('editingHintSplit') : t('editingHint')}
            </div>
          )}
          <div className={layout.split ? 'zg-mydash-split' : undefined}>
            {panes.map((pane) => (
              <DashboardPane
                key={pane.id}
                pane={pane}
                split={layout.split}
                editing={editing}
                hasPro={hasPro}
                onSymbolChange={handlePaneSymbol}
                onExpirationsChange={handlePaneExpirations}
                onClone={handleClone}
                onClear={handleClearPane}
                onOpenGallery={setGalleryPane}
                onReorder={handleReorder}
                onRemove={handleRemove}
                onResize={handleResize}
                onDuplicate={handleDuplicate}
                onSendToOtherPane={handleSendToPane}
              />
            ))}
          </div>
        </>
      )}

      <AddWidgetGallery
        open={galleryPane !== null}
        onClose={() => setGalleryPane(null)}
        hasPro={hasPro}
        counts={counts}
        targetLabel={layout.split ? t('sideLabel', { side: paneLetter(galleryTarget) }) : undefined}
        onAdd={handleAdd}
        onRemoveAll={handleRemoveAll}
      />
    </PageShell>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({
  editing,
  isEmpty,
  split,
  canClone,
  onToggleEdit,
  onToggleSplit,
  onClone,
  onOpenGallery,
  onReset,
}: {
  editing: boolean;
  isEmpty: boolean;
  split: boolean;
  /** False when side A has nothing to copy across. */
  canClone: boolean;
  onToggleEdit: () => void;
  onToggleSplit: () => void;
  onClone: () => void;
  onOpenGallery: () => void;
  onReset: () => void;
}) {
  const t = usePageT(dict);
  return (
    <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div>
        <div className="mb-1 flex items-center gap-2">
          <LayoutGrid size={18} style={{ color: 'var(--color-accent-hot)' }} />
          <span className="zg-eyebrow" style={{ color: 'var(--color-accent-hot)' }}>
            {t('yourBoard')}
          </span>
        </div>
        <h1 className="zg-h1">{t('myDashboard')}</h1>
        <p className="zg-small mt-1" style={{ color: 'var(--text-secondary)' }}>
          {t('heroSubtitle')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SymbolToggle />
        {!isEmpty && (
          <>
            {!split && (
              // One click to go from "I've built one board" to "I've got two,
              // and the second one is a copy I can retarget".
              <button
                type="button"
                onClick={onClone}
                disabled={!canClone}
                className="zg-btn zg-btn--secondary"
                title={t('cloneToSecondHalfTitle')}
              >
                <Copy size={15} /> {t('cloneToSecondHalf')}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleSplit}
              aria-pressed={split}
              className={`zg-btn ${split ? 'zg-btn--primary' : 'zg-btn--ghost'}`}
              title={t('splitViewTitle')}
            >
              <Columns2 size={15} /> {t('splitView')}
            </button>
            {editing && (
              <button type="button" onClick={onReset} className="zg-btn zg-btn--ghost" title={t('resetBoardTitle')}>
                <RotateCcw size={15} /> {t('reset')}
              </button>
            )}
            <button
              type="button"
              onClick={onToggleEdit}
              className={`zg-btn ${editing ? 'zg-btn--primary' : 'zg-btn--secondary'}`}
            >
              {editing ? (
                <>
                  <Check size={15} /> {t('done')}
                </>
              ) : (
                <>
                  <Pencil size={15} /> {t('customize')}
                </>
              )}
            </button>
          </>
        )}
        <button type="button" onClick={onOpenGallery} className="zg-btn zg-btn--primary">
          <Plus size={15} /> {t('addWidgets')}
        </button>
      </div>
    </div>
  );
}

// ── Symbol control ─────────────────────────────────────────────────────────────

function SymbolToggle() {
  const t = usePageT(dict);
  const { symbol, setSymbol } = useTimeframe();
  return (
    <div
      className="inline-flex overflow-hidden rounded-lg border"
      style={{ borderColor: 'var(--border-default)' }}
      role="group"
      aria-label={t('underlyingSymbol')}
    >
      {SYMBOLS.map((s) => {
        const active = s === symbol;
        return (
          <button
            key={s}
            type="button"
            onClick={() => setSymbol(s)}
            aria-pressed={active}
            className="px-3 py-2 text-xs font-bold uppercase tracking-wider transition-colors"
            style={{
              background: active ? 'var(--color-warning-soft)' : 'transparent',
              color: active ? 'var(--color-warning)' : 'var(--text-secondary)',
            }}
          >
            {s}
          </button>
        );
      })}
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({
  hasPro,
  presets,
  onApplyPreset,
  onOpenGallery,
}: {
  hasPro: boolean;
  presets: DashboardPreset[];
  onApplyPreset: (preset: DashboardPreset) => void;
  onOpenGallery: () => void;
}) {
  const t = usePageT(dict);
  return (
    <div className="zg-panel relative overflow-hidden p-8 md:p-12">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            'radial-gradient(90% 120% at 0% 0%, var(--color-accent-soft) 0%, transparent 45%), radial-gradient(90% 120% at 100% 0%, var(--color-info-soft) 0%, transparent 45%)',
        }}
      />
      <div className="relative">
        <div
          className="mb-5 flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{ background: 'var(--bg-hover)', color: 'var(--color-accent-hot)' }}
        >
          <LayoutGrid size={26} />
        </div>
        <h2 className="zg-h2 mb-2">{t('designYourDashboard')}</h2>
        <p className="zg-lead mb-6 max-w-2xl">
          {t('emptyStateLead')}
        </p>

        <div className="mb-8 flex flex-wrap gap-3">
          <button type="button" onClick={onOpenGallery} className="zg-btn zg-btn--primary">
            <Plus size={16} /> {t('addFirstWidget')}
          </button>
        </div>

        <h3 className="zg-label mb-3">{t('quickStartPresets')}</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {presets.map((preset) => {
            const locked = preset.tier === 'pro' && !hasPro;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="group flex flex-col items-start rounded-xl border p-4 text-left transition-colors"
                style={{ borderColor: 'var(--border-default)', background: 'var(--bg-card)' }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'var(--color-accent-hot)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border-default)';
                }}
              >
                <div className="mb-2 flex w-full items-center justify-between">
                  <Sparkles size={16} style={{ color: 'var(--color-accent-hot)' }} />
                  {preset.tier === 'pro' && (
                    <span
                      className="zg-chip"
                      style={{ ['--chip-color' as string]: 'var(--color-accent-hot)' }}
                    >
                      {locked ? <Lock size={10} /> : null} {t('proChip')}
                    </span>
                  )}
                </div>
                <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {preset.name}
                </span>
                <span className="mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
                  {preset.blurb}
                </span>
                {locked && (
                  <span className="mt-2 text-[11px] font-semibold" style={{ color: 'var(--color-accent-hot)' }}>
                    {t('appliesBasicTierWidgets')}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────────────────────

function BoardSkeleton() {
  return (
    <div className="zg-mydash-grid" aria-hidden>
      {['zg-w-sm', 'zg-w-sm', 'zg-w-sm', 'zg-w-sm', 'zg-w-lg', 'zg-w-md', 'zg-w-md', 'zg-w-sm'].map(
        (cls, i) => (
          <div key={i} className={cls}>
            <div className="zg-panel h-full p-5">
              <div className="zg-skeleton-line mb-3 h-3 w-1/3" />
              <div className="zg-skeleton-line mb-2 h-8 w-2/3" />
              <div className="zg-skeleton-line h-3 w-1/2" />
            </div>
          </div>
        ),
      )}
    </div>
  );
}
