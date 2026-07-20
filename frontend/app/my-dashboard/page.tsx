'use client';

/**
 * My Dashboard — a customizable board a member assembles from the pieces of the
 * site they have access to under their plan. Layout persists per-member in the
 * browser; widgets are tier-gated (Pro-only pieces show an upgrade prompt for
 * Basic members). Reordering is drag-and-drop on desktop and button-driven on
 * touch.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutGrid,
  Pencil,
  Check,
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
  emptyLayout,
  loadLayout,
  moveWidget,
  removeWidget,
  resizeWidget,
  saveLayout,
  toggleWidget,
  type DashboardLayout,
  type WidgetSize,
} from '@/core/myDashboardLayout';
import {
  PRESETS,
  WIDGET_IDS,
  getWidget,
  type DashboardPreset,
  type WidgetDef,
} from './registry';
import { MyDashboardDataProvider, type FeedKey } from './DashboardData';
import DashboardGrid from './DashboardGrid';
import AddWidgetGallery from './AddWidgetGallery';

export default function MyDashboardPage() {
  const t = usePageT(dict);
  const { data: authSession, loading: authLoading } = useAuthSession();
  const { symbol } = useTimeframe();
  const tier = authSession?.user?.tier ?? 'public';
  const hasPro = hasTierAccess(normalizeTier(tier), 'pro');
  const scope = authSession?.user?.id ?? null;

  const [hydrated, setHydrated] = useState(false);
  const [layout, setLayout] = useState<DashboardLayout>(emptyLayout);
  const [editing, setEditing] = useState(false);
  const [galleryOpen, setGalleryOpen] = useState(false);
  // Switching symbol re-fetches every widget's data, so key the error
  // boundaries on it — a widget that errored on the old symbol gets a fresh
  // mount and retries automatically. Derived (no effect) so it stays clear of
  // the set-state-in-effect lint rule.
  const resetKey = symbol;

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

  const activeFeeds = useMemo<Set<FeedKey>>(() => {
    const set = new Set<FeedKey>();
    for (const w of layout.widgets) {
      getWidget(w.widgetId)?.feeds.forEach((f) => set.add(f));
    }
    return set;
  }, [layout.widgets]);

  const presentIds = useMemo(() => new Set(layout.widgets.map((w) => w.widgetId)), [layout.widgets]);

  const handleToggle = useCallback((widget: WidgetDef) => {
    setLayout((l) => toggleWidget(l, widget.id, widget.defaultSize));
  }, []);
  const handleRemove = useCallback((id: string) => {
    setLayout((l) => removeWidget(l, id));
  }, []);
  const handleResize = useCallback((id: string, size: WidgetSize) => {
    setLayout((l) => resizeWidget(l, id, size));
  }, []);
  const handleReorder = useCallback((from: number, to: number) => {
    setLayout((l) => moveWidget(l, from, to));
  }, []);

  const applyPreset = useCallback(
    (preset: DashboardPreset) => {
      let next = emptyLayout();
      for (const w of preset.widgets) {
        const def = getWidget(w.widgetId);
        if (!def) continue;
        // Skip Pro widgets a Basic member can't use, so a preset never seeds a
        // board full of locked tiles.
        if (def.tier === 'pro' && !hasPro) continue;
        next = addWidget(next, w.widgetId, w.size);
      }
      setLayout(next);
      setEditing(false);
      setGalleryOpen(false);
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

  const isEmpty = layout.widgets.length === 0;

  return (
    <PageShell width="wide">
      <Header
        editing={editing}
        isEmpty={isEmpty}
        onToggleEdit={() => setEditing((e) => !e)}
        onOpenGallery={() => setGalleryOpen(true)}
        onReset={handleReset}
      />

      {!hydrated ? (
        <BoardSkeleton />
      ) : isEmpty ? (
        <EmptyState
          hasPro={hasPro}
          presets={PRESETS}
          onApplyPreset={applyPreset}
          onOpenGallery={() => setGalleryOpen(true)}
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
              {t('editingHint')}
            </div>
          )}
          <MyDashboardDataProvider activeFeeds={activeFeeds}>
            <DashboardGrid
              items={layout.widgets}
              editing={editing}
              hasPro={hasPro}
              resetKey={resetKey}
              onReorder={handleReorder}
              onRemove={handleRemove}
              onResize={handleResize}
            />
          </MyDashboardDataProvider>
        </>
      )}

      <AddWidgetGallery
        open={galleryOpen}
        onClose={() => setGalleryOpen(false)}
        hasPro={hasPro}
        presentIds={presentIds}
        onToggle={handleToggle}
      />
    </PageShell>
  );
}

// ── Header ────────────────────────────────────────────────────────────────────

function Header({
  editing,
  isEmpty,
  onToggleEdit,
  onOpenGallery,
  onReset,
}: {
  editing: boolean;
  isEmpty: boolean;
  onToggleEdit: () => void;
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
